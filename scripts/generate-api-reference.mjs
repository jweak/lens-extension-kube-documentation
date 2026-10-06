#!/usr/bin/env node
// Regenerates src/api-reference/generated/kubernetes-api-reference.ts: the Kubernetes API reference
// the extension shows for built-in kinds, for every Kubernetes minor version from
// `oldestKubernetesVersion` up to the release @k8slens/kubernetes-contracts is typed for.
//
// Run it again after a Lens upgrade moves that release, and raise `oldestKubernetesVersion` as old
// releases stop mattering:
//
//   node scripts/generate-api-reference.mjs [directory with swagger-<version>.json files]
//
// OpenAPI documents missing from the directory, or all of them without one, are downloaded from the
// release branches of kubernetes/kubernetes. The links to kubernetes.io's structured reference pages
// are scraped from the site as it is today.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const oldestKubernetesVersion = "1.29";

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = join(projectDirectory, "src/api-reference/generated/kubernetes-api-reference.ts");
const require = createRequire(join(projectDirectory, "package.json"));

const newestKubernetesVersion = require("@k8slens/kubernetes-contracts/package.json").kubernetes.release.replace(/^release-/, "");

const minorOf = (version) => Number(version.split(".")[1]);
const kubernetesVersions = [];

for (let minor = minorOf(newestKubernetesVersion); minor >= minorOf(oldestKubernetesVersion); minor--) {
  kubernetesVersions.push(`1.${minor}`);
}

const loadSwagger = async (kubernetesVersion) => {
  const directory = process.argv[2];

  if (directory) {
    try {
      return JSON.parse(await readFile(join(directory, `swagger-${kubernetesVersion}.json`), "utf8"));
    } catch {
      // Not there: downloaded below.
    }
  }

  const url = `https://raw.githubusercontent.com/kubernetes/kubernetes/release-${kubernetesVersion}/api/openapi-spec/swagger.json`;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Downloading ${url} failed: ${response.status}`);
  }

  return response.json();
};

const refName = (ref) => ref.replace(/^#\/definitions\//, "");

// Keeps what the documentation view renders and drops the rest (patch strategies, list types...).
const trimSchema = (schema, visitRef) => {
  const trimmed = {};

  if (schema.description) trimmed.description = schema.description;
  if (schema.type) trimmed.type = schema.type;
  if (schema.format) trimmed.format = schema.format;

  if (schema.$ref) {
    trimmed.ref = refName(schema.$ref);
    visitRef(trimmed.ref);
  }

  if (schema.items) trimmed.items = trimSchema(schema.items, visitRef);

  if (schema.additionalProperties !== undefined) {
    trimmed.additionalProperties =
      typeof schema.additionalProperties === "object"
        ? trimSchema(schema.additionalProperties, visitRef)
        : schema.additionalProperties;
  }

  if (schema.properties) {
    trimmed.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, property]) => [name, trimSchema(property, visitRef)]),
    );
  }

  if (schema.required?.length) trimmed.required = schema.required;
  if (schema.enum) trimmed.enum = schema.enum;
  if (schema.default !== undefined) trimmed.default = schema.default;

  return trimmed;
};

const toApiVersion = ({ group, version }) => (group ? `${group}/${version}` : version);

// The resources a user can have in a cluster: one kind per definition, lists and the
// apimachinery envelopes (DeleteOptions, WatchEvent, ...) left out.
const getResources = (definitions) =>
  Object.entries(definitions)
    .filter(([name, definition]) => {
      const gvks = definition["x-kubernetes-group-version-kind"];

      return gvks?.length === 1 && !gvks[0].kind.endsWith("List") && !name.startsWith("io.k8s.apimachinery.");
    })
    .map(([name, definition]) => {
      const [gvk] = definition["x-kubernetes-group-version-kind"];

      return { apiVersion: toApiVersion(gvk), kind: gvk.kind, definition: name };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.apiVersion.localeCompare(b.apiVersion));

// The definitions the resources reach, trimmed.
const getReachableDefinitions = (allDefinitions, resources) => {
  const definitions = {};
  const pending = resources.map(({ definition }) => definition);
  const visitRef = (name) => {
    if (!(name in definitions)) {
      pending.push(name);
    }
  };

  while (pending.length > 0) {
    const name = pending.pop();

    if (name in definitions) {
      continue;
    }

    if (!allDefinitions[name]) {
      throw new Error(`Definition ${name} is referenced but missing`);
    }

    definitions[name] = {};
    definitions[name] = trimSchema(allDefinitions[name], visitRef);
  }

  return definitions;
};

const fetchText = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fetching ${url} failed: ${response.status}`);
  }

  return response.text();
};

// kubernetes.io has a structured reference page per kind, e.g. /docs/reference/kubernetes-api/core/pod-v1/.
// Its slug only approximates the kind, so each page is read for the apiVersion and kind it documents.
const scrapeReferencePages = async () => {
  const base = "https://kubernetes.io";
  const index = await fetchText(`${base}/docs/reference/kubernetes-api/`);
  const paths = [...new Set([...index.matchAll(/\/docs\/reference\/kubernetes-api\/[a-z-]+\/[a-z0-9-]+\//g)].map(([path]) => path))];
  const pages = {};

  for (const path of paths) {
    try {
      const page = await fetchText(`${base}${path}`);
      const apiVersion = page.match(/<code>apiVersion: ([^<\s]+)<\/code>/)?.[1];
      const kind = page.match(/<h1[^>]*>([A-Za-z0-9]+)<\/h1>/)?.[1];

      if (apiVersion && kind) {
        pages[`${apiVersion}|${kind}`] = `${base}${path}`;
      } else {
        console.warn(`No apiVersion or kind found on ${path}`);
      }
    } catch (error) {
      console.warn(String(error));
    }
  }

  console.log(`Scraped ${Object.keys(pages).length} reference pages`);

  return Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
};

// Most definitions are the same from one release to the next, so each distinct one is stored once
// and every version names its definitions by their index.
const distinctDefinitions = [];
const indexByContent = new Map();
const indexOf = (definition) => {
  const content = JSON.stringify(definition);

  if (!indexByContent.has(content)) {
    indexByContent.set(content, distinctDefinitions.length);
    distinctDefinitions.push(definition);
  }

  return indexByContent.get(content);
};

const versions = [];

for (const kubernetesVersion of kubernetesVersions) {
  const allDefinitions = (await loadSwagger(kubernetesVersion)).definitions;
  const resources = getResources(allDefinitions);
  const definitions = getReachableDefinitions(allDefinitions, resources);

  versions.push({
    kubernetesVersion,
    resources,
    definitions: Object.fromEntries(
      Object.entries(definitions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, definition]) => [name, indexOf(definition)]),
    ),
  });

  console.log(`Kubernetes ${kubernetesVersion}: ${resources.length} resources, ${Object.keys(definitions).length} definitions`);
}

const referencePages = await scrapeReferencePages();
const data = { versions, definitions: distinctDefinitions, referencePages };
const json = JSON.stringify(data);

const source = `// Generated by scripts/generate-api-reference.mjs from the OpenAPI documents of Kubernetes ${kubernetesVersions.at(-1)} to ${kubernetesVersions[0]}. Do not edit.
// Derived from Kubernetes, Copyright The Kubernetes Authors, licensed under the Apache License 2.0: see NOTICE.
// A string parsed at load, because a literal this large would cost the type checker and the parser far more.
import type { ApiReferenceData } from "../api-reference-data";

export const kubernetesApiReference: ApiReferenceData = JSON.parse(${JSON.stringify(json)});
`;

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, source);

console.log(
  `Wrote Kubernetes ${kubernetesVersions.join(", ")}: ${distinctDefinitions.length} distinct definitions ` +
    `(${(json.length / 1024).toFixed(0)} KB) to ${outputFile}`,
);

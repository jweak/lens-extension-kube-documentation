import type { SchemaNode, SchemaResolver } from "./api-reference-data";
import { getKubernetesReferenceUrl, isKubernetesGroup } from "./built-in-documentation";
import { getConceptUrl } from "./concept-links";
import { fromOpenApiSchema, type OpenApiSchema } from "./openapi-schema";
import { getGroup, getVersion, type ResourceDocumentation } from "./resource-documentation";

/** The OpenAPI v3 document a cluster serves for one API group version, at `/openapi/v3/apis/<group>/<version>`. */
export interface ClusterApiSchema {
  readonly components?: {
    readonly schemas?: Readonly<
      Record<string, OpenApiSchema & { readonly "x-kubernetes-group-version-kind"?: readonly GroupVersionKind[] }>
    >;
  };
}

interface GroupVersionKind {
  readonly group: string;
  readonly version: string;
  readonly kind: string;
}

/** What the cluster said it runs, when it could tell. */
export interface ClusterVersion {
  readonly kubernetesVersion: string;
  readonly gitVersion: string;
}

/** Where a cluster serves the OpenAPI v3 document of an API version: `api/v1` for the core group, `apis/<group>/<version>` for the others. */
export const getClusterApiSchemaPath = (apiVersion: string) =>
  apiVersion.includes("/") ? `/openapi/v3/apis/${apiVersion}` : `/openapi/v3/api/${apiVersion}`;

// Converted when first asked for, and once: a group's document has hundreds of schemas, of which a
// documentation tab shows a few.
const resolvers = new WeakMap<ClusterApiSchema, SchemaResolver>();

// A document serves one API group version, so whether its zero defaults mean anything is the same
// for every schema in it.
const getResolver = (document: ClusterApiSchema, apiVersion: string): SchemaResolver => {
  const existing = resolvers.get(document);

  if (existing) {
    return existing;
  }

  const schemas = document.components?.schemas ?? {};
  const options = { zeroDefaultsMeanNothing: isKubernetesGroup(getGroup(apiVersion)) };
  const converted = new Map<string, SchemaNode | undefined>();
  const resolve: SchemaResolver = (name) => {
    if (!converted.has(name)) {
      converted.set(name, schemas[name] ? fromOpenApiSchema(schemas[name], options) : undefined);
    }

    return converted.get(name);
  };

  resolvers.set(document, resolve);

  return resolve;
};

const documentationCache = new WeakMap<ClusterApiSchema, Map<string, ResourceDocumentation | undefined>>();

/**
 * The documentation of a kind as the API schema a cluster serves for its API version has it: exact
 * for whatever Kubernetes version the cluster runs, custom resources and aggregated APIs included.
 * The same object for the same arguments, so what is derived from it can be cached by it.
 */
export const getClusterSchemaDocumentation = (
  document: ClusterApiSchema,
  apiVersion: string,
  kind: string,
  clusterVersion: ClusterVersion | undefined,
): ResourceDocumentation | undefined => {
  const byKind = documentationCache.get(document) ?? new Map<string, ResourceDocumentation | undefined>();
  const key = `${apiVersion}|${kind}|${clusterVersion?.gitVersion ?? ""}`;

  documentationCache.set(document, byKind);

  if (!byKind.has(key)) {
    const group = getGroup(apiVersion);
    const version = getVersion(apiVersion);
    const schemas = document.components?.schemas ?? {};
    const name = Object.keys(schemas).find((candidate) =>
      schemas[candidate]["x-kubernetes-group-version-kind"]?.some(
        (gvk) => gvk.group === group && gvk.version === version && gvk.kind === kind,
      ),
    );
    const resolve = getResolver(document, apiVersion);
    const schema = name ? resolve(name) : undefined;

    byKind.set(
      key,
      schema && {
        apiVersion,
        kind,
        schema,
        resolve,
        source: { type: "cluster", kubernetesVersion: clusterVersion?.kubernetesVersion, gitVersion: clusterVersion?.gitVersion },
        referenceUrl: clusterVersion ? getKubernetesReferenceUrl(clusterVersion.kubernetesVersion, apiVersion, kind) : undefined,
        conceptUrl: getConceptUrl(apiVersion, kind),
      },
    );
  }

  return byKind.get(key);
};

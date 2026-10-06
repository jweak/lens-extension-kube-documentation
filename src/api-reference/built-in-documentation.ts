import type { ApiReferenceResource, SchemaResolver } from "./api-reference-data";
import { getConceptUrl } from "./concept-links";
import { kubernetesApiReference } from "./generated/kubernetes-api-reference";
import { getGroup, getVersion, type ResourceDocumentation } from "./resource-documentation";

/** The bundled API reference of one Kubernetes minor version. */
export interface KubernetesApiReference {
  readonly kubernetesVersion: string;
  readonly resources: readonly ApiReferenceResource[];
  readonly resolve: SchemaResolver;
  readonly findResource: (apiVersion: string, kind: string) => ApiReferenceResource | undefined;
}

const references: readonly KubernetesApiReference[] = kubernetesApiReference.versions.map((version) => {
  const resourcesByKey = new Map(version.resources.map((resource) => [`${resource.apiVersion}|${resource.kind}`, resource]));

  return {
    kubernetesVersion: version.kubernetesVersion,
    resources: version.resources,
    resolve: (name) => {
      const index = version.definitions[name];

      return index === undefined ? undefined : kubernetesApiReference.definitions[index];
    },
    findResource: (apiVersion, kind) => resourcesByKey.get(`${apiVersion}|${kind}`),
  };
});

/** The Kubernetes versions whose reference is bundled, newest first. */
export const bundledKubernetesVersions = references.map(({ kubernetesVersion }) => kubernetesVersion);

export const newestKubernetesVersion = bundledKubernetesVersions[0];

/** The bundled reference of a Kubernetes version, or of the newest one for a version not bundled. */
export const getApiReference = (kubernetesVersion: string) =>
  references.find((reference) => reference.kubernetesVersion === kubernetesVersion) ?? references[0];

/** Every kind and API version any bundled version documents. */
export const allBuiltInResources: readonly { readonly apiVersion: string; readonly kind: string }[] = [
  ...new Map(
    references.flatMap(({ resources }) => resources).map(({ apiVersion, kind }) => [`${apiVersion}|${kind}`, { apiVersion, kind }]),
  ).values(),
];

/** Whether any bundled version documents the kind in that API version: whether it is Kubernetes' own. */
export const isBuiltIn = (apiVersion: string, kind: string) => references.some((reference) => reference.findResource(apiVersion, kind));

/** The bundled versions documenting the kind in that API version, newest first. */
export const getVersionsDocumenting = (apiVersion: string, kind: string) =>
  references.filter((reference) => reference.findResource(apiVersion, kind)).map(({ kubernetesVersion }) => kubernetesVersion);

// Kubernetes' own order of API versions: GA before beta before alpha, then the higher number first.
const apiVersionRank = (version: string) => {
  const [, major = "0", stability = "", minor = "0"] = /^v(\d+)(?:(alpha|beta)(\d+))?$/.exec(version) ?? [];
  const stabilityRank = stability === "" ? 3 : stability === "beta" ? 2 : 1;

  return stabilityRank * 1e6 + Number(major) * 1e3 + Number(minor);
};

// The same kind in another API version of its group, for an API version the Kubernetes version
// does not have: one the cluster serves from an older or newer release.
const findOtherApiVersion = (reference: KubernetesApiReference, apiVersion: string, kind: string) =>
  reference.resources
    .filter((resource) => resource.kind === kind && getGroup(resource.apiVersion) === getGroup(apiVersion))
    .sort((a, b) => apiVersionRank(getVersion(b.apiVersion)) - apiVersionRank(getVersion(a.apiVersion)))[0];

// The structured page when kubernetes.io has one, which it has only as of the latest release; else
// the single-page reference of the very Kubernetes version, which has an anchor for every kind.
const getReferenceUrl = (kubernetesVersion: string, { apiVersion, kind }: { readonly apiVersion: string; readonly kind: string }) => {
  const page = kubernetesApiReference.referencePages[`${apiVersion}|${kind}`];

  if (page) {
    return page;
  }

  const group = getGroup(apiVersion) || "core";
  const anchor = `${kind.toLowerCase()}-${getVersion(apiVersion)}-${group.replaceAll(".", "-")}`;

  return `https://kubernetes.io/docs/reference/generated/kubernetes-api/v${kubernetesVersion}/#${anchor}`;
};

// Kubernetes' own groups: the core group, the unqualified ones such as apps and batch, and *.k8s.io.
export const isKubernetesGroup = (group: string) => group === "" || !group.includes(".") || group.endsWith(".k8s.io");

/**
 * kubernetes.io's reference of a kind of Kubernetes' own, as of a Kubernetes version, including
 * versions newer than the bundle; undefined for the kinds of other groups, which it does not document.
 */
export const getKubernetesReferenceUrl = (kubernetesVersion: string, apiVersion: string, kind: string) =>
  isKubernetesGroup(getGroup(apiVersion)) ? getReferenceUrl(kubernetesVersion, { apiVersion, kind }) : undefined;

const documentationCache = new Map<string, ResourceDocumentation | undefined>();

/**
 * A Kubernetes version's documentation of a kind: of the API version asked for, or of another API
 * version of the same kind when that Kubernetes version lacks it. The same object for the same
 * arguments, so what is derived from it can be cached by it.
 */
export const getBuiltInDocumentation = (kubernetesVersion: string, apiVersion: string, kind: string) => {
  const key = `${kubernetesVersion}|${apiVersion}|${kind}`;

  if (!documentationCache.has(key)) {
    const reference = getApiReference(kubernetesVersion);
    const exact = reference.findResource(apiVersion, kind);
    const resource = exact ?? findOtherApiVersion(reference, apiVersion, kind);
    const schema = resource && reference.resolve(resource.definition);

    documentationCache.set(
      key,
      resource && schema
        ? {
            apiVersion: resource.apiVersion,
            kind: resource.kind,
            schema,
            resolve: reference.resolve,
            source: {
              type: "built-in",
              kubernetesVersion: reference.kubernetesVersion,
              requestedApiVersion: exact ? undefined : apiVersion,
            },
            referenceUrl: getReferenceUrl(reference.kubernetesVersion, resource),
            conceptUrl: getConceptUrl(resource.apiVersion, resource.kind),
          }
        : undefined,
    );
  }

  return documentationCache.get(key);
};

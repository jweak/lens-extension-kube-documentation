import { getInjectable2 } from "@k8slens/injectable";
import {
  apiextensionsV1,
  customResourceDefinitionKind,
  type CustomResourceDefinitionV1,
  kubeResourcesInjectionToken,
} from "@k8slens/kubernetes-contracts";
import { readOnce } from "@k8slens/subscribable";
import { findBuiltInByPlural, findBuiltInKind, newestKubernetesVersion } from "../api-reference/built-in-documentation";
import { type DocumentationTarget, getGroup } from "../api-reference/resource-documentation";
import { clusterKubernetesVersionInjectable } from "../kubernetes-version/cluster-kubernetes-version.injectable";
import { type ServedKind, servedKindsBunch } from "./served-kinds.injectable";

/** What a page or a link knows of a kind: its name, or the group and the plural name in the path of its list. */
export type KindQuery = { readonly kind: string } | { readonly group: string; readonly plural: string };

export const describeKindQuery = (query: KindQuery) =>
  "kind" in query ? query.kind : query.group ? `${query.plural} of ${query.group}` : query.plural;

const servedKindMatches = (query: KindQuery) => (served: ServedKind) =>
  "kind" in query ? served.kind === query.kind : getGroup(served.apiVersion) === query.group && served.plural === query.plural;

const crdMatches = (query: KindQuery) => (crd: CustomResourceDefinitionV1) =>
  "kind" in query ? crd.spec.names.kind === query.kind : crd.spec.group === query.group && crd.spec.names.plural === query.plural;

// The version a CRD stores its resources in is the one the cluster serves by preference.
const crdTarget = (crd: CustomResourceDefinitionV1): DocumentationTarget | undefined => {
  const version = crd.spec.versions.find((candidate) => candidate.storage) ?? crd.spec.versions[0];

  return version && { apiVersion: `${crd.spec.group}/${version.name}`, kind: crd.spec.names.kind };
};

/**
 * Which kind, in which API version, a page or a link is about. The cluster is asked first, as it
 * knows the version it serves each kind in; failing that, its CustomResourceDefinitions, then the
 * bundled reference of the version the cluster is documented as. Undefined when none knows.
 */
export const resolveDocumentationTargetInjectable = getInjectable2({
  id: "kube-documentation-resolve-documentation-target",
  consumptions: [kubeResourcesInjectionToken],

  instantiate: (di) => {
    const getServedKinds = di.inject(servedKindsBunch.subscribable);
    const kubeResources = di.inject(kubeResourcesInjectionToken)();
    const getClusterKubernetesVersion = di.inject(clusterKubernetesVersionInjectable);

    return () =>
      async (clusterId: string, query: KindQuery): Promise<DocumentationTarget | undefined> => {
        const served = await readOnce(getServedKinds(clusterId)).catch((): readonly ServedKind[] => []);
        const fromCluster = served.find(servedKindMatches(query));

        if (fromCluster) {
          return { apiVersion: fromCluster.apiVersion, kind: fromCluster.kind };
        }

        const crds = await readOnce(kubeResources(customResourceDefinitionKind, apiextensionsV1, clusterId)).catch(
          (): readonly CustomResourceDefinitionV1[] => [],
        );
        const crd = crds.find(crdMatches(query));

        if (crd) {
          return crdTarget(crd);
        }

        const kubernetesVersion = getClusterKubernetesVersion(clusterId).get()?.bundledKubernetesVersion ?? newestKubernetesVersion;
        const builtIn =
          "kind" in query ? findBuiltInKind(kubernetesVersion, query.kind) : findBuiltInByPlural(kubernetesVersion, query.group, query.plural);

        return builtIn && { apiVersion: builtIn.apiVersion, kind: builtIn.kind };
      };
  },
});

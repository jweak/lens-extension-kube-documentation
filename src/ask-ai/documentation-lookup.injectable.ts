import { getInjectable2 } from "@k8slens/injectable";
import { apiextensionsV1, customResourceDefinitionKind, kubeResourcesInjectionToken } from "@k8slens/kubernetes-contracts";
import { when } from "mobx";
import {
  getApiReference,
  getBuiltInDocumentation,
  getVersionsDocumenting,
  isBuiltIn,
  newestKubernetesVersion,
} from "../api-reference/built-in-documentation";
import { getClusterSchemaDocumentation } from "../api-reference/cluster-schema-documentation";
import { getCustomResourceDocumentation, matchesTarget } from "../api-reference/custom-resource-documentation";
import { getVersion, type ResourceDocumentation } from "../api-reference/resource-documentation";
import { clusterApiSchemaInjectable } from "../kubernetes-version/cluster-api-schema.injectable";
import { type ClusterKubernetesVersion, clusterKubernetesVersionInjectable } from "../kubernetes-version/cluster-kubernetes-version.injectable";

// Ample for the cluster to tell its version, or for the remembered choice to be read, after which
// the newest bundled version is as good a guess as any.
const waitForKubernetesVersionMs = 10_000;

const formatVersions = (versions: readonly string[]) =>
  versions.length === 1 ? versions[0] : `${versions.at(-1)} to ${versions[0]}`;

/**
 * The documentation of a kind on a cluster, the same the documentation tab shows, for code with no
 * component to show it in: from the bundled reference of the cluster's Kubernetes version for a
 * built-in kind, from its CRD for a custom resource, and from the API schema the cluster serves for
 * a version the bundle does not have, or a kind it has nowhere else. Rejects saying why when there is none.
 */
export const documentationLookupInjectable = getInjectable2({
  id: "kube-documentation-documentation-lookup",
  consumptions: [kubeResourcesInjectionToken],

  instantiate: (di) => {
    const kubeResources = di.inject(kubeResourcesInjectionToken)();
    const getClusterKubernetesVersion = di.inject(clusterKubernetesVersionInjectable);
    const getClusterApiSchema = di.inject(clusterApiSchemaInjectable);

    const readCustomResourceDefinitions = async (clusterId: string) => {
      const subscription = kubeResources(customResourceDefinitionKind, apiextensionsV1, clusterId).subscribe();

      subscription.claim();

      try {
        return (await subscription.value).get();
      } finally {
        subscription.dispose();
      }
    };

    const getKubernetesVersion = async (clusterId: string) => {
      const clusterKubernetesVersion = getClusterKubernetesVersion(clusterId);

      await when(() => clusterKubernetesVersion.get() !== undefined, { timeout: waitForKubernetesVersionMs }).catch(() => {});

      return clusterKubernetesVersion.get();
    };

    const readFromClusterSchema = async (
      clusterId: string,
      apiVersion: string,
      kind: string,
      version: ClusterKubernetesVersion | undefined,
    ) => {
      try {
        const document = await getClusterApiSchema(clusterId, apiVersion).document;

        return getClusterSchemaDocumentation(document, apiVersion, kind, version?.cluster);
      } catch {
        return undefined;
      }
    };

    return () =>
      async (clusterId: string, apiVersion: string, kind: string): Promise<ResourceDocumentation> => {
        const version = await getKubernetesVersion(clusterId);

        // A cluster running a version the bundle does not have is documented from its own API schema.
        const live = version?.live ? await readFromClusterSchema(clusterId, apiVersion, kind, version) : undefined;

        if (live) {
          return live;
        }

        const kubernetesVersion = version?.bundledKubernetesVersion ?? newestKubernetesVersion;

        if (isBuiltIn(apiVersion, kind)) {
          const documentation = getBuiltInDocumentation(kubernetesVersion, apiVersion, kind);

          if (documentation) {
            return documentation;
          }

          throw new Error(
            `${kind} (${apiVersion}) is not in Kubernetes ${kubernetesVersion}, which this cluster is documented as; ` +
              `Kubernetes ${formatVersions(getVersionsDocumenting(apiVersion, kind))} has it.`,
          );
        }

        const crd = (await readCustomResourceDefinitions(clusterId)).find((candidate) => matchesTarget(candidate, apiVersion, kind));
        const documentation =
          (crd && getCustomResourceDocumentation(crd, apiVersion, kind, getApiReference(kubernetesVersion))) ??
          getBuiltInDocumentation(kubernetesVersion, apiVersion, kind);

        if (documentation) {
          return documentation;
        }

        // Neither bundled nor a CRD: an aggregated API, or a kind newer than the bundle.
        const fromClusterSchema = crd ? undefined : await readFromClusterSchema(clusterId, apiVersion, kind, version);

        if (fromClusterSchema) {
          return fromClusterSchema;
        }

        throw new Error(
          crd
            ? `The CustomResourceDefinition ${crd.metadata.name} declares no version ${getVersion(apiVersion)} of ${kind}.`
            : `${kind} (${apiVersion}) is not in the bundled Kubernetes reference, has no CustomResourceDefinition in this cluster, and the API schema the cluster serves does not describe it. Check the kind and the API version, as in \`kubectl api-resources\`.`,
        );
      };
  },
});

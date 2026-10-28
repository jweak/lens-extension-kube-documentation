import { runKubectlInjectionToken } from "@k8slens/kubectl-contracts";
import { getSubscribableInjectableBunch } from "@k8slens/subscribable";
import { type ClusterApiSchema, getClusterApiSchemaPath } from "../api-reference/cluster-schema-documentation";

// A group's document has hundreds of schemas, so it is let go of when nothing shows it; kept this
// long after, so that coming back to the tab, or opening another kind of the group, does not read it again.
const keptAfterLastLookMs = 5 * 60_000;

/**
 * The OpenAPI v3 document a cluster serves for one API version, read with the kubectl Lens keeps
 * for the cluster while something looks at it. Subscribe through `useSubscribable` from a
 * component, and `readOnce` from code that wants the document once.
 */
export const clusterApiSchemaBunch = getSubscribableInjectableBunch<ClusterApiSchema, [clusterId: string, apiVersion: string]>()({
  id: "kube-documentation-cluster-api-schema",
  gracePeriodMs: keptAfterLastLookMs,

  load: {
    consumptions: [runKubectlInjectionToken],

    instantiate: (di) => {
      const runKubectlFor = di.inject(runKubectlInjectionToken);

      return () => async (clusterId, apiVersion) =>
        JSON.parse(await runKubectlFor(clusterId)(["get", "--raw", getClusterApiSchemaPath(apiVersion)])) as ClusterApiSchema;
    },
  },
});

import { getInjectable2 } from "@k8slens/injectable";
import { runKubectlInjectionToken } from "@k8slens/kubectl-contracts";
import { observable, runInAction } from "mobx";
import { type ClusterApiSchema, getClusterApiSchemaPath } from "../api-reference/cluster-schema-documentation";

export type ClusterApiSchemaState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly document: ClusterApiSchema }
  | { readonly status: "failed"; readonly reason: string };

/**
 * The OpenAPI v3 document a cluster serves for one API version, read once per session with the
 * kubectl Lens keeps for the cluster: as observable state for a component, and as a promise for code
 * that awaits it.
 */
export const clusterApiSchemaInjectable = getInjectable2({
  id: "kube-documentation-cluster-api-schema",
  consumptions: [runKubectlInjectionToken],

  instantiate: (di) => {
    const runKubectlFor = di.inject(runKubectlInjectionToken);

    return (clusterId: string, apiVersion: string) => {
      const state = observable.box<ClusterApiSchemaState>({ status: "loading" }, { deep: false });

      const document = runKubectlFor(clusterId)(["get", "--raw", getClusterApiSchemaPath(apiVersion)]).then(
        (output) => {
          const parsed = JSON.parse(output) as ClusterApiSchema;

          runInAction(() => state.set({ status: "loaded", document: parsed }));

          return parsed;
        },
        (error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);

          runInAction(() => state.set({ status: "failed", reason }));

          throw new Error(reason);
        },
      );

      // Failure is part of the state; awaiting is up to whoever wants the document.
      document.catch(() => {});

      return {
        get: () => state.get(),
        document,
      };
    };
  },
});

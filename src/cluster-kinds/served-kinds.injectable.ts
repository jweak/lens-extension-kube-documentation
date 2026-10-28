import { runKubectlInjectionToken } from "@k8slens/kubectl-contracts";
import { getSubscribableInjectableBunch } from "@k8slens/subscribable";

/** A kind a cluster serves, as `kubectl api-resources` lists it. */
export interface ServedKind {
  readonly kind: string;
  /** The API version the cluster serves the kind in by preference, such as `apps/v1`. */
  readonly apiVersion: string;
  /** The plural name the kind is listed by, such as `deployments`. */
  readonly plural: string;
  readonly shortNames: readonly string[];
  readonly namespaced: boolean;
}

const columns = ["NAME", "SHORTNAMES", "APIVERSION", "NAMESPACED", "KIND"] as const;

/** The kinds in the table `kubectl api-resources` prints, read by the columns its header lines up. */
export const parseApiResources = (output: string): ServedKind[] => {
  const [header, ...rows] = output.split("\n").filter((line) => line.trim() !== "");
  const starts = columns.map((column) => header?.indexOf(column) ?? -1);

  if (starts.some((start) => start < 0)) {
    throw new Error("kubectl api-resources did not print the table of kinds.");
  }

  const cell = (row: string, column: number) => row.slice(starts[column], starts[column + 1] ?? row.length).trim();

  return rows
    .map((row) => ({
      plural: cell(row, 0),
      shortNames: cell(row, 1) ? cell(row, 1).split(",") : [],
      apiVersion: cell(row, 2),
      namespaced: cell(row, 3) === "true",
      kind: cell(row, 4),
    }))
    .filter(({ kind, apiVersion }) => kind !== "" && apiVersion !== "");
};

// Kinds come and go with operators, rarely: kept this long after the last look, so that the
// picker and the menus do not ask the cluster again each time.
const keptAfterLastLookMs = 5 * 60_000;

/**
 * Every kind a cluster serves, with the API version it serves each in, asked of the cluster with
 * the kubectl Lens keeps for it while something looks.
 */
export const servedKindsBunch = getSubscribableInjectableBunch<readonly ServedKind[], [clusterId: string]>()({
  id: "kube-documentation-served-kinds",
  gracePeriodMs: keptAfterLastLookMs,

  load: {
    consumptions: [runKubectlInjectionToken],

    instantiate: (di) => {
      const runKubectlFor = di.inject(runKubectlInjectionToken);

      return () => async (clusterId) => parseApiResources(await runKubectlFor(clusterId)(["api-resources"]));
    },
  },
});

import { clusterIsConnectedReactiveInjectionToken } from "@k8slens/cluster-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { runKubectlInjectionToken } from "@k8slens/kubectl-contracts";
import { observable, reaction, runInAction } from "mobx";

export interface ServerVersion {
  /** The minor version whose API the cluster serves, e.g. `1.36`. */
  readonly kubernetesVersion: string;
  /** What the cluster calls its version, e.g. `v1.36.4-gke.1391000`. */
  readonly gitVersion: string;
}

interface VersionInfo {
  readonly major?: string;
  readonly minor?: string;
  readonly emulationMajor?: string;
  readonly emulationMinor?: string;
  readonly gitVersion?: string;
}

// Providers decorate the numbers ("36+" on EKS), so only their leading digits count.
const leadingNumber = (value: string | undefined) => value?.match(/^\d+/)?.[0];

export const parseServerVersion = (output: string): ServerVersion | undefined => {
  let serverVersion: VersionInfo | undefined;

  try {
    serverVersion = (JSON.parse(output) as { serverVersion?: VersionInfo }).serverVersion;
  } catch {
    return undefined;
  }

  if (!serverVersion) {
    return undefined;
  }

  const fromGitVersion = /^v?(\d+)\.(\d+)/.exec(serverVersion.gitVersion ?? "");
  // A server emulating an older version serves that version's API, so the emulated one is what to document.
  const major = leadingNumber(serverVersion.emulationMajor) ?? leadingNumber(serverVersion.major) ?? fromGitVersion?.[1];
  const minor = leadingNumber(serverVersion.emulationMinor) ?? leadingNumber(serverVersion.minor) ?? fromGitVersion?.[2];

  return major && minor
    ? { kubernetesVersion: `${major}.${minor}`, gitVersion: serverVersion.gitVersion ?? `v${major}.${minor}` }
    : undefined;
};

export interface ClusterServerVersion {
  /** `undefined` until the cluster has answered once, `null` when it could not tell. */
  readonly get: () => ServerVersion | null | undefined;
  /** Whether the cluster is being asked right now. */
  readonly isAsking: () => boolean;
  /** Asks the cluster again, keeping what it last said until it answers. */
  readonly refresh: () => void;
}

/**
 * The Kubernetes version a cluster runs, asked of the cluster with the kubectl Lens keeps for it:
 * at once, and again whenever Lens connects to the cluster, so a cluster asked while it was still
 * connecting, or upgraded and reconnected since, is not documented as it was first answered.
 */
export const clusterServerVersionInjectable = getInjectable2({
  id: "kube-documentation-cluster-server-version",
  consumptions: [runKubectlInjectionToken, clusterIsConnectedReactiveInjectionToken],

  instantiate: (di) => {
    const runKubectlFor = di.inject(runKubectlInjectionToken);
    const clusterIsConnected = di.inject(clusterIsConnectedReactiveInjectionToken);

    return (clusterId: string): ClusterServerVersion => {
      const serverVersion = observable.box<ServerVersion | null | undefined>(undefined, { deep: false });
      const asking = observable.box(false);
      let latestRun = 0;

      const ask = () => {
        const run = ++latestRun;

        runInAction(() => asking.set(true));

        void runKubectlFor(clusterId)(["version", "--output", "json"]).then(
          (output) => {
            // Only the newest run answers; an older one still finishing would undo it.
            if (run === latestRun) {
              runInAction(() => {
                serverVersion.set(parseServerVersion(output) ?? null);
                asking.set(false);
              });
            }
          },
          () => {
            if (run === latestRun) {
              runInAction(() => {
                serverVersion.set(null);
                asking.set(false);
              });
            }
          },
        );
      };

      ask();

      // The cluster connecting, now or later, is what makes its answer worth asking for again: the
      // kubectl matching its version is there from then on, and so is the cluster after an upgrade.
      void clusterIsConnected(clusterId).then((isConnected) => {
        reaction(
          () => isConnected.get(),
          (connected) => {
            if (connected) {
              ask();
            }
          },
        );
      });

      return { get: () => serverVersion.get(), isAsking: () => asking.get(), refresh: ask };
    };
  },
});

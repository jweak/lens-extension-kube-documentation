import { getInjectable2 } from "@k8slens/injectable";
import { runKubectlInjectionToken } from "@k8slens/kubectl-contracts";
import { observable, runInAction } from "mobx";

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

/**
 * The Kubernetes version a cluster runs, asked of the cluster with the kubectl Lens keeps for it:
 * `undefined` while asking, `null` when it could not tell.
 */
export const clusterServerVersionInjectable = getInjectable2({
  id: "kube-documentation-cluster-server-version",
  consumptions: [runKubectlInjectionToken],

  instantiate: (di) => {
    const runKubectlFor = di.inject(runKubectlInjectionToken);

    return (clusterId: string) => {
      const serverVersion = observable.box<ServerVersion | null | undefined>(undefined, { deep: false });

      void runKubectlFor(clusterId)(["version", "--output", "json"]).then(
        (output) => runInAction(() => serverVersion.set(parseServerVersion(output) ?? null)),
        () => runInAction(() => serverVersion.set(null)),
      );

      return { get: () => serverVersion.get() };
    };
  },
});

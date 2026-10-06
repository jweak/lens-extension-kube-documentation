import { getInjectable2 } from "@k8slens/injectable";
import { getPersistableValueInjectableBunch } from "@k8slens/persistable-contracts";
import { action, type IObservableValue, observable, runInAction } from "mobx";
import { bundledKubernetesVersions, newestKubernetesVersion } from "../api-reference/built-in-documentation";
import { clusterServerVersionInjectable, type ServerVersion } from "./cluster-server-version.injectable";

/**
 * The Kubernetes version the user said a cluster runs, `null` until they say. Kept per cluster,
 * across restarts, and used only while the cluster cannot be asked for its version.
 */
export const kubernetesVersionChoiceBunch = getPersistableValueInjectableBunch<string | null, [clusterId: string]>()({
  id: "kubernetes-version",
  defaultValue: { instantiate: () => async () => null },
});

// How long the documentation waits for the cluster to tell its version before showing another, as
// the first kubectl run against a cluster can take a while to fetch the matching kubectl.
const waitForServerVersionMs = 3000;

const minorOf = (kubernetesVersion: string) => Number(kubernetesVersion.split(".")[1]);

/** The bundled version closest to the one a cluster runs: itself when bundled, else the newest or the oldest. */
const nearestBundledVersion = (kubernetesVersion: string) =>
  bundledKubernetesVersions.includes(kubernetesVersion)
    ? kubernetesVersion
    : minorOf(kubernetesVersion) > minorOf(newestKubernetesVersion)
      ? newestKubernetesVersion
      : bundledKubernetesVersions[bundledKubernetesVersions.length - 1];

export interface ClusterKubernetesVersion {
  /** The Kubernetes version whose reference documents the cluster's built-in kinds. */
  readonly kubernetesVersion: string;
  /** What the cluster said it runs, with the bundled version nearest to it; absent when it could not tell. */
  readonly cluster?: ServerVersion & { readonly nearestBundled: string };
  /** Whether the version shown is one the user chose rather than the cluster's own or the newest. */
  readonly chosen: boolean;
}

/**
 * Which Kubernetes version's reference documents a cluster's built-in kinds: the version the
 * cluster runs, when it can be asked. Otherwise the one the user chose for it, remembered per
 * cluster, and the newest bundled one until they choose.
 *
 * Choosing another version while the cluster's is known looks at that version for the session, and
 * is not remembered: the cluster's own version is what the documentation should match.
 */
export const clusterKubernetesVersionInjectable = getInjectable2({
  id: "kube-documentation-cluster-kubernetes-version",

  instantiate: (di) => {
    const getChoice = di.inject(kubernetesVersionChoiceBunch.persistable);
    const getServerVersion = di.inject(clusterServerVersionInjectable);

    return (clusterId: string) => {
      const serverVersion = getServerVersion(clusterId);
      const choice = observable.box<IObservableValue<string | null> | undefined>(undefined, { deep: false });
      const sessionChoice = observable.box<string | undefined>(undefined);
      const waitedForServerVersion = observable.box(false);

      void getChoice(clusterId).then((loaded) => runInAction(() => choice.set(loaded)));
      setTimeout(() => runInAction(() => waitedForServerVersion.set(true)), waitForServerVersionMs);

      // A version since dropped from the bundle counts as no choice.
      const getRememberedChoice = () => {
        const chosen = choice.get()?.get();

        return chosen && bundledKubernetesVersions.includes(chosen) ? chosen : undefined;
      };

      return {
        /** Undefined while the cluster is being asked, briefly, and while the remembered choice is read. */
        get: (): ClusterKubernetesVersion | undefined => {
          const server = serverVersion.get();

          if (server) {
            const nearestBundled = nearestBundledVersion(server.kubernetesVersion);
            const chosen = sessionChoice.get();

            return {
              kubernetesVersion: chosen ?? nearestBundled,
              cluster: { ...server, nearestBundled },
              chosen: chosen !== undefined,
            };
          }

          if ((server === undefined && !waitedForServerVersion.get()) || !choice.get()) {
            return undefined;
          }

          const remembered = getRememberedChoice();

          return { kubernetesVersion: remembered ?? newestKubernetesVersion, chosen: remembered !== undefined };
        },

        choose: action((kubernetesVersion: string) => {
          const server = serverVersion.get();

          if (server) {
            // Choosing the cluster's own version again goes back to following the cluster.
            sessionChoice.set(kubernetesVersion === nearestBundledVersion(server.kubernetesVersion) ? undefined : kubernetesVersion);
          } else {
            void getChoice(clusterId).then(action((loaded) => loaded.set(kubernetesVersion)));
          }
        }),
      };
    };
  },
});

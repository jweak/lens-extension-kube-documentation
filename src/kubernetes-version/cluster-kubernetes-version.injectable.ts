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
  /** The Kubernetes version the cluster is documented as: a bundled one, or the cluster's own when `live`. */
  readonly kubernetesVersion: string;
  /**
   * Whether the documentation is read from the API schema the cluster itself serves, because it runs
   * a version the bundle does not have and the user has not chosen one that it does.
   */
  readonly live: boolean;
  /** The bundled reference to document the cluster from: `kubernetesVersion`, or the nearest to it when live. */
  readonly bundledKubernetesVersion: string;
  /** What the cluster said it runs, with whether its reference is bundled; absent when it could not tell. */
  readonly cluster?: ServerVersion & { readonly bundled: boolean };
  /** Whether the version shown is one the user chose rather than the cluster's own or the newest. */
  readonly chosen: boolean;
}

/**
 * Which Kubernetes version a cluster's built-in kinds are documented as: the version the cluster
 * runs, when it can be asked, from the bundled reference or, for a version the bundle does not have,
 * from the cluster's own API schema. Otherwise the one the user chose for it, remembered per
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
            const bundled = bundledKubernetesVersions.includes(server.kubernetesVersion);
            const chosen = sessionChoice.get();
            const cluster = { ...server, bundled };

            if (chosen) {
              return { kubernetesVersion: chosen, live: false, bundledKubernetesVersion: chosen, cluster, chosen: true };
            }

            return {
              kubernetesVersion: server.kubernetesVersion,
              live: !bundled,
              bundledKubernetesVersion: nearestBundledVersion(server.kubernetesVersion),
              cluster,
              chosen: false,
            };
          }

          if ((server === undefined && !waitedForServerVersion.get()) || !choice.get()) {
            return undefined;
          }

          const kubernetesVersion = getRememberedChoice() ?? newestKubernetesVersion;

          return {
            kubernetesVersion,
            live: false,
            bundledKubernetesVersion: kubernetesVersion,
            chosen: getRememberedChoice() !== undefined,
          };
        },

        choose: action((kubernetesVersion: string) => {
          const server = serverVersion.get();

          if (server) {
            // Choosing the cluster's own version again goes back to following the cluster.
            sessionChoice.set(kubernetesVersion === server.kubernetesVersion ? undefined : kubernetesVersion);
          } else {
            void getChoice(clusterId).then(action((loaded) => loaded.set(kubernetesVersion)));
          }
        }),
      };
    };
  },
});

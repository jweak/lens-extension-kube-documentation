import { getDropDownMenuItemsInjectableBunch, getDropDownMenuKind, useCloseDropDownMenu } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow, DropDownMenuSeparator } from "@k8slens/drop-down-menu-items";
import { Span } from "@k8slens/element-components";
import { CheckIcon, RefreshIcon } from "@k8slens/icon";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { bundledKubernetesVersions } from "../api-reference/built-in-documentation";
import { type ClusterKubernetesVersionState, clusterKubernetesVersionInjectable } from "./cluster-kubernetes-version.injectable";

interface KubernetesVersionMenuData {
  readonly clusterId: string;
}

/** The menu choosing which Kubernetes version a cluster's documentation is of. */
export const kubernetesVersionMenuKind = getDropDownMenuKind<KubernetesVersionMenuData>()("kube-documentation-kubernetes-version-menu");

interface KubernetesVersionItemProps {
  readonly kubernetesVersion: string;
  readonly clusterKubernetesVersion: ClusterKubernetesVersionState;
}

// Renders from its props alone, injecting nothing, as a menu row should: see the resource menu's row.
const KubernetesVersionItem = observer(({ kubernetesVersion, clusterKubernetesVersion }: KubernetesVersionItemProps) => {
  const current = clusterKubernetesVersion.get();
  const selected = current?.kubernetesVersion === kubernetesVersion;
  const isClusters = current?.cluster?.kubernetesVersion === kubernetesVersion;

  return (
    <DropDownMenuItemRow
      $onClick={() => clusterKubernetesVersion.choose(kubernetesVersion)}
      trailing={selected ? <CheckIcon $size="m" /> : undefined}
      aria-selected={selected}
    >
      Kubernetes {kubernetesVersion}
      {isClusters && <Span $color="textMuted"> · this cluster</Span>}
    </DropDownMenuItemRow>
  );
});

const Separator = () => <DropDownMenuSeparator />;

// For a cluster that could not tell its version: asks it again, as after connecting it.
const AskClusterAgainItem = observer(({ clusterKubernetesVersion }: { readonly clusterKubernetesVersion: ClusterKubernetesVersionState }) => {
  const closeMenu = useCloseDropDownMenu();
  const asking = clusterKubernetesVersion.isAskingCluster();

  return (
    <DropDownMenuItemRow
      Icon={RefreshIcon}
      $enabled={!asking}
      $onClick={() => {
        closeMenu();
        clusterKubernetesVersion.askClusterAgain();
      }}
    >
      {asking ? "Asking the cluster which version it runs…" : "Ask the cluster which version it runs"}
    </DropDownMenuItemRow>
  );
});

const minorOf = (kubernetesVersion: string) => Number(kubernetesVersion.split(".")[1]);

// One row per bundled version, and one for the version the cluster runs when the bundle does not
// have it, which is then read from the cluster itself. Newest first. A cluster that could not tell
// its version gets a row asking it again.
export const kubernetesVersionMenuItemsBunch = getDropDownMenuItemsInjectableBunch({
  id: "kube-documentation-kubernetes-version-items",
  kind: kubernetesVersionMenuKind,

  instantiate: (di) => {
    const getClusterKubernetesVersion = di.inject(clusterKubernetesVersionInjectable);

    return ({ clusterId }) => {
      const clusterKubernetesVersion = getClusterKubernetesVersion(clusterId);

      return computed(() => {
        const current = clusterKubernetesVersion.get();
        const cluster = current?.cluster;
        const versions = cluster && !cluster.bundled ? [cluster.kubernetesVersion, ...bundledKubernetesVersions] : bundledKubernetesVersions;
        const versionItems = [...versions]
          .sort((a, b) => minorOf(b) - minorOf(a))
          .map((kubernetesVersion, index) => ({
            id: `kube-documentation-kubernetes-${kubernetesVersion}`,
            orderNumber: index,
            Component: KubernetesVersionItem,
            componentProps: { kubernetesVersion, clusterKubernetesVersion },
          }));

        return current && !cluster
          ? [
              ...versionItems,
              { id: "kube-documentation-ask-cluster-separator", orderNumber: 1000, Component: Separator },
              {
                id: "kube-documentation-ask-cluster-again",
                orderNumber: 1001,
                Component: AskClusterAgainItem,
                componentProps: { clusterKubernetesVersion },
              },
            ]
          : versionItems;
      });
    };
  },
});

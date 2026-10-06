import { getDropDownMenuItemsInjectableBunch, getDropDownMenuKind } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { CheckIcon } from "@k8slens/icon";
import { Span } from "@k8slens/element-components";
import { useInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import { bundledKubernetesVersions } from "../api-reference/built-in-documentation";
import { clusterKubernetesVersionInjectable } from "./cluster-kubernetes-version.injectable";

interface KubernetesVersionMenuData {
  readonly clusterId: string;
}

/** The menu choosing which Kubernetes version a cluster's documentation is of. */
export const kubernetesVersionMenuKind = getDropDownMenuKind<KubernetesVersionMenuData>()("kube-documentation-kubernetes-version-menu");

const KubernetesVersionItem = observer(
  ({ data, kubernetesVersion }: { readonly data: KubernetesVersionMenuData; readonly kubernetesVersion: string }) => {
    const clusterKubernetesVersion = useInject(clusterKubernetesVersionInjectable)(data.clusterId);
    const current = clusterKubernetesVersion.get();
    const selected = current?.kubernetesVersion === kubernetesVersion;
    const isClusters = current?.cluster?.nearestBundled === kubernetesVersion;

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
  },
);

// One row per bundled version, newest first.
export const kubernetesVersionMenuItemsBunch = getDropDownMenuItemsInjectableBunch({
  id: "kube-documentation-kubernetes-version-items",
  kind: kubernetesVersionMenuKind,
  instantiate: () => () =>
    bundledKubernetesVersions.map((kubernetesVersion, index) => ({
      id: `kube-documentation-kubernetes-${kubernetesVersion}`,
      orderNumber: index,
      Component: KubernetesVersionItem,
      componentProps: { kubernetesVersion },
    })),
});

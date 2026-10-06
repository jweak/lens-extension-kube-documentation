import { dropDownMenu } from "@k8slens/drop-down-menu-contracts";
import { Span } from "@k8slens/element-components";
import { KeyboardArrowDownIcon } from "@k8slens/icon";
import { useInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import { OutlinedButton } from "../components/outlined-button";
import { type ClusterKubernetesVersion, clusterKubernetesVersionInjectable } from "./cluster-kubernetes-version.injectable";
import { kubernetesVersionMenuKind } from "./kubernetes-version-menu.injectable";

const describe = (version: ClusterKubernetesVersion | undefined) => {
  if (!version) {
    return "Asking the cluster which Kubernetes version it runs…";
  }

  const { kubernetesVersion, cluster, chosen, live } = version;

  if (cluster) {
    if (chosen) {
      return `Showing Kubernetes ${kubernetesVersion}, though this cluster runs ${cluster.gitVersion}. Choose ${cluster.kubernetesVersion} to follow the cluster again.`;
    }

    return live
      ? `This cluster runs Kubernetes ${cluster.gitVersion}, whose reference is not bundled, so the documentation is read from the API schema the cluster serves`
      : `This cluster runs Kubernetes ${cluster.gitVersion}`;
  }

  return chosen
    ? `The cluster could not be asked which Kubernetes version it runs, so this is the version chosen for it, remembered for this cluster`
    : `The cluster could not be asked which Kubernetes version it runs, so this is the newest bundled one. Choose the version it runs; it is remembered for this cluster.`;
};

/** Shows which Kubernetes version a cluster is documented as, and lets the user look at another. */
export const KubernetesVersionPicker = observer(({ clusterId }: { readonly clusterId: string }) => {
  const version = useInject(clusterKubernetesVersionInjectable)(clusterId).get();

  return (
    <OutlinedButton
      $dropDownMenu={dropDownMenu(kubernetesVersionMenuKind, { data: { clusterId } })}
      $padding={{ vertical: "xxs", horizontal: "xs" }}
      $tooltip={describe(version)}
    >
      <Span $flex={{ gap: "xxs", verticalAlign: "center" }}>
        Kubernetes {version?.kubernetesVersion ?? "…"}
        <KeyboardArrowDownIcon $size="s" />
      </Span>
    </OutlinedButton>
  );
});

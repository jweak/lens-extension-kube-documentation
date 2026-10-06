import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { DescriptionIcon } from "@k8slens/icon";
import {
  getKubeResourceMenuItemInjectableBunch,
  kubeResourceMenuOrderNumbers,
  type KubeResourceMenuTarget,
} from "@k8slens/kube-resource-menu-contracts";
import { useInject } from "@k8slens/use-inject";
import { openResourceDocumentationInjectable } from "../documentation-tab/open-resource-documentation.injectable";

const DocumentationMenuItem = ({ data }: { readonly data: KubeResourceMenuTarget }) => {
  const openResourceDocumentation = useInject(openResourceDocumentationInjectable)();

  return (
    <DropDownMenuItemRow
      Icon={DescriptionIcon}
      $onClick={() => void openResourceDocumentation(data.clusterId, { apiVersion: data.apiVersion, kind: data.kind })}
    >
      Documentation
    </DropDownMenuItemRow>
  );
};

// Offered over every kind, custom resources included, after the rows Lens puts there itself.
export const documentationMenuItemBunch = getKubeResourceMenuItemInjectableBunch({
  id: "kube-documentation-resource-menu-item",
  orderNumber: kubeResourceMenuOrderNumbers.sectionEnd + 100,
  Component: DocumentationMenuItem,
});

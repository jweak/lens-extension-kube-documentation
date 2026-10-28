import { getDropDownMenuItemInjectableBunch, useCloseDropDownMenu } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { DescriptionIcon } from "@k8slens/icon";
import { type KubeResourceListNavigationParams, kubeResourceListLinkMenuKind } from "@k8slens/kubernetes-resources-contracts";
import { useInject } from "@k8slens/use-inject";
import { openDocumentationOfInjectable } from "../cluster-kinds/open-documentation-of.injectable";

const ListLinkDocumentation = ({ data }: { readonly data: KubeResourceListNavigationParams }) => {
  const openDocumentationOf = useInject(openDocumentationOfInjectable)();
  const closeMenu = useCloseDropDownMenu();

  return (
    <DropDownMenuItemRow
      Icon={DescriptionIcon}
      $onClick={() => {
        closeMenu();
        void openDocumentationOf(data.clusterId, { kind: String(data.kind) });
      }}
    >
      Documentation
    </DropDownMenuItemRow>
  );
};

/** A row in the menu of a link to a list of resources, opening the documentation of the kind the list is of. */
export const listLinkDocumentationMenuItemBunch = getDropDownMenuItemInjectableBunch({
  id: "kube-documentation-list-link-documentation",
  kind: kubeResourceListLinkMenuKind,
  orderNumber: 100,
  Component: ListLinkDocumentation,
});

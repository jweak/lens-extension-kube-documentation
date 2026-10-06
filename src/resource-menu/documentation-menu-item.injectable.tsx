import { getDropDownMenuItemsInjectableBunch } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { DescriptionIcon } from "@k8slens/icon";
import {
  kubeResourceMenuKind,
  kubeResourceMenuOrderNumbers,
  type KubeResourceMenuTarget,
} from "@k8slens/kube-resource-menu-contracts";
import type { DocumentationTarget } from "../api-reference/resource-documentation";
import { openResourceDocumentationInjectable } from "../documentation-tab/open-resource-documentation.injectable";

interface DocumentationMenuItemProps {
  readonly data: KubeResourceMenuTarget;
  readonly openResourceDocumentation: (clusterId: string, target: DocumentationTarget) => Promise<void>;
}

// Renders from its props alone, injecting nothing: a row Lens still shows from before the extension
// was reinstalled would otherwise inject what is no longer registered, and take the whole list down.
const DocumentationMenuItem = ({ data, openResourceDocumentation }: DocumentationMenuItemProps) => (
  <DropDownMenuItemRow
    Icon={DescriptionIcon}
    $onClick={() => void openResourceDocumentation(data.clusterId, { apiVersion: data.apiVersion, kind: data.kind })}
  >
    Documentation
  </DropDownMenuItemRow>
);

// Offered over every kind, custom resources included, after the rows Lens puts there itself.
export const documentationMenuItemBunch = getDropDownMenuItemsInjectableBunch({
  id: "kube-documentation-resource-menu-item",
  kind: kubeResourceMenuKind,

  instantiate: (di) => {
    const openResourceDocumentation = di.inject(openResourceDocumentationInjectable)();

    return () => ({
      id: "kube-documentation-resource-menu-item",
      orderNumber: kubeResourceMenuOrderNumbers.sectionEnd + 100,
      Component: DocumentationMenuItem,
      componentProps: { openResourceDocumentation },
    });
  },
});

import { dockTabMenuKind, dockTabMenuOrderNumbers, type DockTabMenuData } from "@k8slens/dock-view-contracts";
import { getDropDownMenuItemsInjectableBunch, useCloseDropDownMenu } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { OpenInBrowserIcon } from "@k8slens/icon";
import { getTabKindId } from "@k8slens/tab-contracts";
import type { DocumentationPlace } from "../api-reference/resource-documentation";
import { documentationTabKind, parseTabId } from "../documentation-tab/documentation-tab-kind";
import { openDocumentationWindowInjectable } from "./open-documentation-window.injectable";

interface OpenInWindowProps {
  readonly data: DockTabMenuData;
  readonly place: DocumentationPlace;
  readonly openDocumentationWindow: (place: DocumentationPlace) => Promise<void>;
}

// Renders from its props alone, injecting nothing: see the resource menu's row.
const OpenInWindow = ({ place, openDocumentationWindow }: OpenInWindowProps) => {
  const closeMenu = useCloseDropDownMenu();

  return (
    <DropDownMenuItemRow
      Icon={OpenInBrowserIcon}
      $onClick={() => {
        closeMenu();
        void openDocumentationWindow(place);
      }}
    >
      Open in a window
    </DropDownMenuItemRow>
  );
};

/** A row in the menu of a documentation tab of the dock, and of no other tab, opening the same documentation in a window of its own. */
export const documentationTabMenuItemsBunch = getDropDownMenuItemsInjectableBunch({
  id: "kube-documentation-dock-tab-menu-items",
  kind: dockTabMenuKind,

  instantiate: (di) => {
    // The id Lens knows the documentation tab kind by: the kind under this extension's scopes.
    const ownTabKindId = String(getTabKindId(documentationTabKind, di.scopeIds));
    const openDocumentationWindow = di.inject(openDocumentationWindowInjectable)();

    return ({ kindTab }) => {
      const target = kindTab && String(kindTab.kind) === ownTabKindId ? parseTabId(kindTab.tabId) : undefined;

      return kindTab && target
        ? [
            {
              id: "kube-documentation-open-in-window",
              orderNumber: dockTabMenuOrderNumbers.sectionEnd + 100,
              Component: OpenInWindow,
              componentProps: { place: { clusterId: kindTab.tabHostId, ...target }, openDocumentationWindow },
            },
          ]
        : [];
    };
  },
});

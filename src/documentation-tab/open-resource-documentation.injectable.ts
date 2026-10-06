import { dockTabHostKind } from "@k8slens/dock-view-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { focusTabInjectionToken, openTabInjectionToken, tabIsOpenInjectionToken } from "@k8slens/tab-contracts";
import type { DocumentationTarget } from "../api-reference/resource-documentation";
import { documentationTabKind, toTabId } from "./documentation-tab-kind";

// Declared at the level of the kind: the compiler follows `.for(scopeIds)` from there, where it
// loses track of focusTabInjectionToken's own chain when declared at the root.
const openDocumentationTab = openTabInjectionToken.for(dockTabHostKind).for(documentationTabKind);
const focusDocumentationTab = focusTabInjectionToken.for(dockTabHostKind).for(documentationTabKind);
const documentationTabIsOpen = tabIsOpenInjectionToken.for(dockTabHostKind).for(documentationTabKind);

const tryToGet = <T>(get: () => T): T | undefined => {
  try {
    return get();
  } catch {
    return undefined;
  }
};

/** Shows the documentation of a kind in the dock of a cluster, bringing its tab forward when it is open already. */
export const openResourceDocumentationInjectable = getInjectable2({
  id: "kube-documentation-open-resource-documentation",
  consumptions: [openDocumentationTab, focusDocumentationTab, documentationTabIsOpen],

  instantiate: (di) => {
    const scopeIds = di.scopeIds;
    const openTab = di.inject(openDocumentationTab.for(scopeIds))();

    // Asking whether a tab is open and bringing it forward are injected only when needed, and
    // guarded: a dock that cannot select tabs, as in some Lens builds, throws on injecting them,
    // which must cost only the bringing forward, not every menu row and section that opens docs.
    const getTabIsOpen = () => tryToGet(() => di.inject(documentationTabIsOpen.for(scopeIds))());
    const getFocusTab = () => tryToGet(() => di.inject(focusDocumentationTab.for(scopeIds))());

    return () => async (clusterId: string, target: DocumentationTarget) => {
      const address = { tabHostId: clusterId, tabId: toTabId(target) };
      const tabIsOpen = getTabIsOpen();
      const isOpen = tabIsOpen ? await tabIsOpen(address) : undefined;

      if (isOpen === false) {
        await openTab(address);

        return;
      }

      if (isOpen === undefined) {
        // Opening a tab that is open already throws, which is the only answer left.
        const opened = await openTab(address).then(
          () => true,
          () => false,
        );

        if (opened) return;
      }

      // Where the dock cannot bring a tab forward, the tab simply stays where it is.
      await getFocusTab()?.(address).catch(() => {});
    };
  },
});

import { connectClusterInjectionToken } from "@k8slens/cluster-contracts";
import { dockTabHostKind } from "@k8slens/dock-view-contracts";
import { getNavigationTargetInjectableBunch, getNavigationTargetKind } from "@k8slens/navigation-contracts";
import { focusTabInjectionToken, openTabInjectionToken, tabIsOpenInjectionToken } from "@k8slens/tab-contracts";
import type { DocumentationPlace } from "../api-reference/resource-documentation";
import { documentationTabKind, toTabId } from "./documentation-tab-kind";

// Declared at the level of the kind: the compiler follows `.for(scopeIds)` from there, where it
// loses track of focusTabInjectionToken's own chain when declared at the root.
const openDocumentationTab = openTabInjectionToken.for(dockTabHostKind).for(documentationTabKind);
const focusDocumentationTab = focusTabInjectionToken.for(dockTabHostKind).for(documentationTabKind);
const documentationTabIsOpen = tabIsOpenInjectionToken.for(dockTabHostKind).for(documentationTabKind);

/**
 * The documentation of a kind in the dock of a cluster, as a place Lens takes the user to: the
 * cluster connected first, the tab opened or brought forward, and the visit in the history, so
 * that going back returns from it. Lens and other extensions navigate there by the kind's name.
 */
export const documentationNavigationTargetKind = getNavigationTargetKind<DocumentationPlace>()("kube-documentation-resource-documentation");

export const documentationNavigationTargetBunch = getNavigationTargetInjectableBunch({
  kind: documentationNavigationTargetKind,

  // Docks are the application window's: navigating from a window of its own goes there.
  window: "application",

  preconditions: [
    {
      consumptions: [connectClusterInjectionToken],

      instantiate: (di) => {
        const connectCluster = di.inject(connectClusterInjectionToken);

        return () => ({ clusterId }) => connectCluster(clusterId);
      },
    },
  ],

  navigate: {
    consumptions: [openDocumentationTab, focusDocumentationTab, documentationTabIsOpen],

    instantiate: (di) => {
      const openTab = di.inject(openDocumentationTab.for(di.scopeIds))();
      const focusTab = di.inject(focusDocumentationTab.for(di.scopeIds))();
      const isOpen = di.inject(documentationTabIsOpen.for(di.scopeIds))();

      return () => async ({ clusterId, ...target }) => {
        const address = { tabHostId: clusterId, tabId: toTabId(target) };

        if (await isOpen(address)) {
          await focusTab(address);
        } else {
          await openTab(address);
        }
      };
    },
  },

  describe: ({ kind, apiVersion }) => `Documentation of ${kind} (${apiVersion})`,
});

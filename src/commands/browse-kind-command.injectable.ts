import { getCommandInjectableBunch } from "@k8slens/command-palette-contracts";
import { activeTabClusterIdInjectionToken, activeTabClusterIdReactiveInjectionToken } from "@k8slens/main-view-contracts";
import { openModalInjectionToken } from "@k8slens/modal-contracts";
import { showInfoNotificationInjectionToken } from "@k8slens/notifications-contracts";
import { computed } from "mobx";
import { pickKindModalKind } from "../cluster-kinds/pick-kind-modal.injectable";
import { openResourceDocumentationInjectable } from "../documentation-tab/open-resource-documentation.injectable";

/** Picks any kind the cluster in front serves, and opens its documentation in the cluster's dock. */
export const browseKindCommandBunch = getCommandInjectableBunch({
  id: "kube-documentation-browse-kind-command",
  title: "Documentation: Browse a kind",

  // Offered while the user looks at a cluster: the documentation opens in its dock.
  isActive: {
    consumptions: [activeTabClusterIdReactiveInjectionToken],

    instantiate: (di) => {
      const activeTabClusterId = di.inject(activeTabClusterIdReactiveInjectionToken)();

      return () => computed(() => activeTabClusterId.get() !== undefined);
    },
  },

  action: {
    consumptions: [activeTabClusterIdInjectionToken, openModalInjectionToken, showInfoNotificationInjectionToken],

    instantiate: (di) => {
      const activeTabClusterId = di.inject(activeTabClusterIdInjectionToken)();
      const pickKind = di.inject(openModalInjectionToken.for(pickKindModalKind).for(di.scopeIds))();
      const openResourceDocumentation = di.inject(openResourceDocumentationInjectable)();
      const showInfoNotification = di.inject(showInfoNotificationInjectionToken)();

      return () => async () => {
        const clusterId = await activeTabClusterId();

        if (!clusterId) {
          showInfoNotification("Open a cluster first: its documentation is browsed in the cluster's dock.");

          return;
        }

        const target = await pickKind(clusterId);

        if (target) {
          await openResourceDocumentation(clusterId, target);
        }
      };
    },
  },
});

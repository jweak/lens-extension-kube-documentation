import { getInjectable2 } from "@k8slens/injectable";
import { showErrorNotificationInjectionToken } from "@k8slens/notifications-contracts";
import { openResourceDocumentationInjectable } from "../documentation-tab/open-resource-documentation.injectable";
import { describeKindQuery, type KindQuery, resolveDocumentationTargetInjectable } from "./resolve-documentation-target.injectable";

/**
 * Shows the documentation of whatever kind a page or a link is about, from what it knows of the
 * kind, in the dock of the cluster; a kind nothing knows is told of in a notification.
 */
export const openDocumentationOfInjectable = getInjectable2({
  id: "kube-documentation-open-documentation-of",
  consumptions: [showErrorNotificationInjectionToken],

  instantiate: (di) => {
    const resolveTarget = di.inject(resolveDocumentationTargetInjectable)();
    const openResourceDocumentation = di.inject(openResourceDocumentationInjectable)();
    const showErrorNotification = di.inject(showErrorNotificationInjectionToken)();

    return () => async (clusterId: string, query: KindQuery) => {
      try {
        const target = await resolveTarget(clusterId, query);

        if (!target) {
          showErrorNotification(
            `No documentation for ${describeKindQuery(query)}: neither the cluster nor the bundled Kubernetes reference says which kind it is.`,
          );

          return;
        }

        await openResourceDocumentation(clusterId, target);
      } catch (error) {
        showErrorNotification(error instanceof Error ? error : new Error(String(error)));
      }
    };
  },
});

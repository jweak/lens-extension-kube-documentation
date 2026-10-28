import { getInjectable2 } from "@k8slens/injectable";
import { navigateToInjectionToken } from "@k8slens/navigation-contracts";
import type { DocumentationTarget } from "../api-reference/resource-documentation";
import { documentationNavigationTargetKind } from "./documentation-navigation-target.injectable";

/**
 * Shows the documentation of a kind in the dock of a cluster, connecting the cluster first and
 * bringing the tab forward when it is open already, as navigating there does.
 */
export const openResourceDocumentationInjectable = getInjectable2({
  id: "kube-documentation-open-resource-documentation",
  consumptions: [navigateToInjectionToken],

  instantiate: (di) => {
    const navigateToDocumentation = di.inject(navigateToInjectionToken.for(documentationNavigationTargetKind))();

    return () => (clusterId: string, target: DocumentationTarget) => navigateToDocumentation({ clusterId, ...target });
  },
});

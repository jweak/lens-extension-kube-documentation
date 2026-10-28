import { getInjectable2 } from "@k8slens/injectable";
import { openSubWindowInjectionToken } from "@k8slens/sub-window-contracts";
import type { DocumentationPlace } from "../api-reference/resource-documentation";
import { documentationWindowKind, toWindowId } from "./documentation-window-kind";

/** Shows the documentation of a kind in a window of its own, bringing the window forward when it is open already. */
export const openDocumentationWindowInjectable = getInjectable2({
  id: "kube-documentation-open-documentation-window",
  consumptions: [openSubWindowInjectionToken],

  instantiate: (di) => {
    const openWindow = di.inject(openSubWindowInjectionToken.for(documentationWindowKind).for(di.scopeIds))();

    return () => (place: DocumentationPlace) => openWindow({ id: toWindowId(place), params: place });
  },
});

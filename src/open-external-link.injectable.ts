import { openLinkInBrowserInjectionToken } from "@k8slens/electron-contracts";
import { getInjectable2 } from "@k8slens/injectable";

/** Opens a link of the documentation, such as a kubernetes.io page, in the user's browser. */
export const openExternalLinkInjectable = getInjectable2({
  id: "kube-documentation-open-external-link",
  consumptions: [openLinkInBrowserInjectionToken],

  instantiate: (di) => {
    const openLinkInBrowser = di.inject(openLinkInBrowserInjectionToken)();

    return () => (url: string) => {
      void openLinkInBrowser(url);
    };
  },
});

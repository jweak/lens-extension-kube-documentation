import { navigateToKubeResourceDetailsInjectionToken } from "@k8slens/details-panel-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { apiextensionsV1, customResourceDefinitionKind } from "@k8slens/kubernetes-contracts";

/** Opens the details of the CRD a custom resource's documentation was read from. */
export const showCustomResourceDefinitionInjectable = getInjectable2({
  id: "kube-documentation-show-custom-resource-definition",
  consumptions: [navigateToKubeResourceDetailsInjectionToken],

  instantiate: (di) => {
    const navigateToKubeResourceDetails = di.inject(navigateToKubeResourceDetailsInjectionToken)();

    return () => (clusterId: string, crdName: string) => {
      void navigateToKubeResourceDetails({
        clusterId,
        kind: customResourceDefinitionKind,
        apiVersion: apiextensionsV1,
        ref: { name: crdName },
      });
    };
  },
});

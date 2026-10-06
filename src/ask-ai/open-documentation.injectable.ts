import { getAskAiFunctionInjectableBunch, getAskAiFunctionKind } from "@k8slens/ask-ai-contracts";
import { findField } from "../api-reference/fields";
import { toTabId } from "../documentation-tab/documentation-tab-kind";
import { documentationViewStateInjectable } from "../documentation-tab/documentation-view-state.injectable";
import { openResourceDocumentationInjectable } from "../documentation-tab/open-resource-documentation.injectable";
import { documentationLookupInjectable } from "./documentation-lookup.injectable";

interface OpenDocumentationInput {
  readonly clusterId: string;
  readonly apiVersion: string;
  readonly kind: string;
  readonly field?: string;
}

export const openDocumentationFunctionKind = getAskAiFunctionKind<OpenDocumentationInput>()("open-documentation");

export default getAskAiFunctionInjectableBunch({
  kind: openDocumentationFunctionKind,
  offeredIn: "every-conversation",
  description:
    "Opens the Kube Documentation extension's documentation tab for a Kubernetes resource kind in the dock of the cluster's view in Lens, so the user can browse all of its fields, and shows one field in it when given. Use it when the user wants to see or read the documentation in Lens; to answer a question about a field yourself, use explain-field instead.",
  inputDescription:
    "`clusterId` (string): the Lens cluster id. `apiVersion` (string): the kind's API version, such as `apps/v1`. `kind` (string): the kind, such as `Deployment`. `field` (string, optional): a field's path to show, such as `spec.strategy.rollingUpdate`.",
  outputDescription: "Nothing. Resolves once the tab has been opened, or rejects when the kind or the field has no documentation.",
  invoke: {
    instantiate: (di) => {
      const lookUpDocumentation = di.inject(documentationLookupInjectable)();
      const openResourceDocumentation = di.inject(openResourceDocumentationInjectable)();
      const getViewState = di.inject(documentationViewStateInjectable);

      return () =>
        async ({ clusterId, apiVersion, kind, field: path }) => {
          const target = { apiVersion, kind };
          // Fails, with the reason, before any tab opens on a kind there is nothing to show of.
          const documentation = await lookUpDocumentation(clusterId, apiVersion, kind);
          const field = path?.trim() ? findField(documentation.resolve, documentation.schema, kind, path) : undefined;

          if (path?.trim() && !field) {
            throw new Error(`${kind} (${apiVersion}) has no field ${path}. Use search-fields to find the right path.`);
          }

          if (field) {
            // The tab's view state is kept by the same id the tab uses, so the field is shown as it opens.
            getViewState(`${clusterId}/${toTabId(target)}`).showInTree(field.path);
          }

          await openResourceDocumentation(clusterId, target);
        };
    },
  },
});

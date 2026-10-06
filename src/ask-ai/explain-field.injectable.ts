import { getAskAiFunctionInjectableBunch, getAskAiFunctionKind } from "@k8slens/ask-ai-contracts";
import { findField, getFields, getRootContainer, getTypeLabel } from "../api-reference/fields";
import { documentationLookupInjectable } from "./documentation-lookup.injectable";
import { describeSource, type FieldSummary, toFieldSummary } from "./field-summaries";

interface ExplainFieldInput {
  readonly clusterId: string;
  readonly apiVersion: string;
  readonly kind: string;
  readonly field?: string;
}

interface ExplainFieldOutput {
  readonly documentedAs: string;
  readonly apiVersion: string;
  readonly kind: string;
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string | null;
  readonly allowedValues: readonly unknown[] | null;
  readonly default: unknown;
  readonly constraints: readonly string[];
  readonly fields: readonly FieldSummary[];
  readonly referenceUrl: string | null;
}

export const explainFieldFunctionKind = getAskAiFunctionKind<ExplainFieldInput, ExplainFieldOutput>()("explain-field");

export default getAskAiFunctionInjectableBunch({
  kind: explainFieldFunctionKind,
  offeredIn: "every-conversation",
  description:
    "Explains a Kubernetes resource kind, or one field of it, from the Kube Documentation extension's API reference: as the Kubernetes version the cluster runs documents it, or as its CustomResourceDefinition does for a custom resource. Use it to answer what a kind is for, what a field means, its type, whether it is required, its allowed values, default and validation, and which fields it contains. To find a field whose path you do not know, use search-fields first; to see what changed between Kubernetes versions, use compare-kubernetes-versions.",
  inputDescription:
    "`clusterId` (string): the Lens cluster id. `apiVersion` (string): the kind's API version, such as `apps/v1`, `v1` or `cert-manager.io/v1`. `kind` (string): the kind, such as `Deployment`. `field` (string, optional): the field's path, such as `spec.template.spec.containers.image` (with or without `[]` after arrays); leave it out to explain the kind itself.",
  outputDescription:
    "`documentedAs` (string): which reference the answer comes from, such as `the Kubernetes 1.36 API reference`. `apiVersion` and `kind` (strings): what was documented, which can be another API version of the kind when the cluster's Kubernetes version lacks the one asked for. `path` (string): the field's full path, empty for the kind. `type` (string): its type, as `kubectl explain` writes it. `required` (boolean). `description` (string or null). `allowedValues` (array or null). `default` (any JSON value, or null). `constraints` (array of strings): validation rules. `fields` (array of { `path`, `type`, `required`, `summary` }): the fields it contains, empty for a leaf. `referenceUrl` (string or null): the kind's page on kubernetes.io.",
  invoke: {
    instantiate: (di) => {
      const lookUpDocumentation = di.inject(documentationLookupInjectable)();

      return () =>
        async ({ clusterId, apiVersion, kind, field: path }) => {
          const documentation = await lookUpDocumentation(clusterId, apiVersion, kind);
          const { resolve, schema } = documentation;
          const common = {
            documentedAs: describeSource(documentation),
            apiVersion: documentation.apiVersion,
            kind: documentation.kind,
            referenceUrl: documentation.referenceUrl ?? null,
          };

          if (!path?.trim()) {
            const root = getRootContainer(resolve, schema);

            return {
              ...common,
              path: "",
              type: getTypeLabel(schema),
              required: false,
              description: schema.description ?? null,
              allowedValues: null,
              default: null,
              constraints: [],
              fields: root ? getFields(resolve, root).map(toFieldSummary) : [],
            };
          }

          const field = findField(resolve, schema, kind, path);

          if (!field) {
            throw new Error(`${documentation.kind} (${documentation.apiVersion}) has no field ${path}. Use search-fields to find the right path.`);
          }

          return {
            ...common,
            path: field.path,
            type: field.typeLabel,
            required: field.required,
            description: field.description ?? null,
            allowedValues: field.enum ?? null,
            default: field.default ?? null,
            constraints: field.constraints ?? [],
            fields: field.children ? getFields(resolve, field.children).map(toFieldSummary) : [],
          };
        };
    },
  },
});

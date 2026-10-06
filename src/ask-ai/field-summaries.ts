import { type Field, getSummary } from "../api-reference/fields";
import type { ResourceDocumentation } from "../api-reference/resource-documentation";

/** A field as Ask AI is handed it in lists: enough to choose one, not its whole description. */
export interface FieldSummary {
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly summary: string | null;
}

export const toFieldSummary = (field: Field): FieldSummary => ({
  path: field.path,
  type: field.typeLabel,
  required: field.required,
  summary: getSummary(field.description) ?? null,
});

/** Where documentation comes from, in words the assistant can relay. */
export const describeSource = ({ source }: ResourceDocumentation) =>
  source.type === "built-in"
    ? `the Kubernetes ${source.kubernetesVersion} API reference`
    : `the schema of the CustomResourceDefinition ${source.crdName} in the cluster`;

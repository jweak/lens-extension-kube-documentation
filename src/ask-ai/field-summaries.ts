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
export const describeSource = ({ source }: ResourceDocumentation) => {
  switch (source.type) {
    case "built-in":
      return `the Kubernetes ${source.kubernetesVersion} API reference`;
    case "custom-resource":
      return `the schema of the CustomResourceDefinition ${source.crdName} in the cluster`;
    case "cluster":
      return `the API schema the cluster itself serves${source.gitVersion ? `, which runs Kubernetes ${source.gitVersion}` : ""}`;
  }
};

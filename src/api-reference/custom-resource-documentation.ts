import type { CustomResourceDefinitionV1, V1JSONSchemaProps } from "@k8slens/kubernetes-contracts";
import type { SchemaNode } from "./api-reference-data";
import type { KubernetesApiReference } from "./built-in-documentation";
import { getGroup, getVersion, type ResourceDocumentation } from "./resource-documentation";

const objectMetaDefinition = "io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta";

type ValidationRule = { readonly rule?: string; readonly message?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const describeConstraints = (schema: V1JSONSchemaProps): string[] => {
  const constraints: string[] = [];
  const validations = (schema as { "x-kubernetes-validations"?: ValidationRule[] })["x-kubernetes-validations"] ?? [];

  if (schema.pattern !== undefined) constraints.push(`pattern: ${schema.pattern}`);
  if (schema.minimum !== undefined) constraints.push(`${schema.exclusiveMinimum ? ">" : "≥"} ${schema.minimum}`);
  if (schema.maximum !== undefined) constraints.push(`${schema.exclusiveMaximum ? "<" : "≤"} ${schema.maximum}`);
  if (schema.multipleOf !== undefined) constraints.push(`multiple of ${schema.multipleOf}`);
  if (schema.minLength !== undefined) constraints.push(`min length ${schema.minLength}`);
  if (schema.maxLength !== undefined) constraints.push(`max length ${schema.maxLength}`);
  if (schema.minItems !== undefined) constraints.push(`min items ${schema.minItems}`);
  if (schema.maxItems !== undefined) constraints.push(`max items ${schema.maxItems}`);
  if (schema.minProperties !== undefined) constraints.push(`min properties ${schema.minProperties}`);
  if (schema.maxProperties !== undefined) constraints.push(`max properties ${schema.maxProperties}`);
  if (schema.uniqueItems) constraints.push("unique items");
  if (schema.nullable) constraints.push("nullable");
  if (schema["x-kubernetes-embedded-resource"]) constraints.push("embedded resource");

  for (const validation of validations) {
    const text = validation.message ?? validation.rule;

    if (text) constraints.push(`validated: ${text}`);
  }

  return constraints;
};

const fromJsonSchema = (schema: V1JSONSchemaProps): SchemaNode => {
  const constraints = describeConstraints(schema);

  return {
    description: schema.description,
    type: schema.type,
    format: schema.format,
    items: isRecord(schema.items) ? fromJsonSchema(schema.items as V1JSONSchemaProps) : undefined,
    additionalProperties: isRecord(schema.additionalProperties)
      ? fromJsonSchema(schema.additionalProperties as V1JSONSchemaProps)
      : typeof schema.additionalProperties === "boolean"
        ? schema.additionalProperties
        : undefined,
    properties: schema.properties
      ? Object.fromEntries(Object.entries(schema.properties).map(([name, property]) => [name, fromJsonSchema(property)]))
      : undefined,
    required: schema.required,
    enum: schema.enum,
    default: schema.default,
    constraints: constraints.length > 0 ? constraints : undefined,
    intOrString: schema["x-kubernetes-int-or-string"],
    preserveUnknownFields: schema["x-kubernetes-preserve-unknown-fields"],
  };
};

// A CRD's schema usually says no more of apiVersion, kind and metadata than that they exist, where
// the API server fills them in as for any resource. Describe them the way built-in kinds do.
const withStandardFields = (root: SchemaNode, reference: KubernetesApiReference): SchemaNode => {
  const standard = reference.resolve("io.k8s.api.core.v1.ConfigMap")?.properties ?? {};
  const { apiVersion, kind, metadata, ...rest } = root.properties ?? {};
  const isBare = (node: SchemaNode | undefined) => !node?.properties || Object.keys(node.properties).length === 0;

  return {
    ...root,
    properties: {
      apiVersion: apiVersion?.description ? apiVersion : (standard.apiVersion ?? { type: "string" }),
      kind: kind?.description ? kind : (standard.kind ?? { type: "string" }),
      metadata: isBare(metadata)
        ? { ref: objectMetaDefinition, description: metadata?.description ?? standard.metadata?.description }
        : metadata!,
      ...rest,
    },
  };
};

/** Whether the CRD defines this kind in the group of the API version. */
export const matchesTarget = (crd: CustomResourceDefinitionV1, apiVersion: string, kind: string) =>
  crd.spec.group === getGroup(apiVersion) && crd.spec.names.kind === kind;

/**
 * The documentation of a custom resource's kind, read from the schema its CRD declares for that
 * version, with the fields every resource has described by the reference of a Kubernetes version.
 */
export const getCustomResourceDocumentation = (
  crd: CustomResourceDefinitionV1,
  apiVersion: string,
  kind: string,
  reference: KubernetesApiReference,
): ResourceDocumentation | undefined => {
  const version = crd.spec.versions.find(({ name }) => name === getVersion(apiVersion));

  if (!version || !matchesTarget(crd, apiVersion, kind)) {
    return undefined;
  }

  const openApiSchema = version.schema?.openAPIV3Schema;
  const schema: SchemaNode = openApiSchema
    ? fromJsonSchema(openApiSchema)
    : { type: "object", description: "The CustomResourceDefinition declares no schema for this version." };

  return {
    apiVersion,
    kind,
    schema: withStandardFields(schema, reference),
    resolve: reference.resolve,
    source: {
      type: "custom-resource",
      crdName: crd.metadata.name,
      kubernetesVersion: reference.kubernetesVersion,
      deprecationWarning: version.deprecated
        ? (version.deprecationWarning ?? `${apiVersion} ${kind} is deprecated.`)
        : undefined,
    },
  };
};

import type { SchemaNode } from "./api-reference-data";

/**
 * A schema as Kubernetes serves it: the OpenAPI v3 schemas of its API groups, and the
 * `openAPIV3Schema` a CustomResourceDefinition declares. Read loosely, since both are plain JSON.
 */
export interface OpenApiSchema {
  readonly $ref?: string;
  readonly allOf?: readonly OpenApiSchema[];
  readonly description?: string;
  readonly type?: string;
  readonly format?: string;
  readonly items?: unknown;
  readonly additionalProperties?: unknown;
  readonly properties?: Readonly<Record<string, OpenApiSchema>>;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: boolean;
  readonly exclusiveMaximum?: boolean;
  readonly multipleOf?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly minProperties?: number;
  readonly maxProperties?: number;
  readonly uniqueItems?: boolean;
  readonly nullable?: boolean;
  readonly "x-kubernetes-embedded-resource"?: boolean;
  readonly "x-kubernetes-int-or-string"?: boolean;
  readonly "x-kubernetes-preserve-unknown-fields"?: boolean;
  readonly "x-kubernetes-validations"?: readonly { readonly rule?: string; readonly message?: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// `#/components/schemas/io.k8s.api.apps.v1.DeploymentSpec` names `io.k8s.api.apps.v1.DeploymentSpec`.
const refName = (ref: string) => ref.slice(ref.lastIndexOf("/") + 1);

// OpenAPI v3 wraps a reference that has a description of its own in `allOf`, as `{ description, allOf: [{ $ref }] }`.
const getRef = (schema: OpenApiSchema) => {
  const ref = schema.$ref ?? (schema.allOf?.length === 1 ? schema.allOf[0].$ref : undefined);

  return ref ? refName(ref) : undefined;
};

// Kubernetes gives most object fields a default of `{}`, which says nothing worth reading.
const isEmptyDefault = (value: unknown) =>
  (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.keys(value).length === 0);

// Kubernetes' own schemas also stamp the zero value of every plain field as its default: `""`, `0`,
// `false`. A CRD's author writes each default deliberately, so there they are kept.
const isZeroValue = (value: unknown) => value === "" || value === 0 || value === false;

export interface OpenApiSchemaOptions {
  /** Whether a default of `""`, `0` or `false` only restates the zero value, as in Kubernetes' own schemas. */
  readonly zeroDefaultsMeanNothing?: boolean;
}

const describeConstraints = (schema: OpenApiSchema): string[] => {
  const constraints: string[] = [];

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

  for (const validation of schema["x-kubernetes-validations"] ?? []) {
    const text = validation.message ?? validation.rule;

    if (text) constraints.push(`validated: ${text}`);
  }

  return constraints;
};

/** Converts a schema Kubernetes serves to the shape the view renders. */
export const fromOpenApiSchema = (schema: OpenApiSchema, options: OpenApiSchemaOptions = {}): SchemaNode => {
  const constraints = describeConstraints(schema);
  const convert = (nested: OpenApiSchema) => fromOpenApiSchema(nested, options);
  const meaningless = (value: unknown) => isEmptyDefault(value) || (options.zeroDefaultsMeanNothing === true && isZeroValue(value));

  return {
    description: schema.description,
    type: schema.type,
    format: schema.format,
    ref: getRef(schema),
    items: isRecord(schema.items) ? convert(schema.items as OpenApiSchema) : undefined,
    additionalProperties: isRecord(schema.additionalProperties)
      ? convert(schema.additionalProperties as OpenApiSchema)
      : typeof schema.additionalProperties === "boolean"
        ? schema.additionalProperties
        : undefined,
    properties: schema.properties
      ? Object.fromEntries(Object.entries(schema.properties).map(([name, property]) => [name, convert(property)]))
      : undefined,
    required: schema.required,
    enum: schema.enum,
    default: meaningless(schema.default) ? undefined : schema.default,
    constraints: constraints.length > 0 ? constraints : undefined,
    intOrString: schema["x-kubernetes-int-or-string"],
    preserveUnknownFields: schema["x-kubernetes-preserve-unknown-fields"],
  };
};

/**
 * A schema of a resource or of one of its fields, as the view renders it. The bundled Kubernetes
 * reference is generated in this shape, and a CRD's OpenAPI schema is converted to it.
 */
export interface SchemaNode {
  readonly description?: string;
  readonly type?: string;
  readonly format?: string;
  /** Name of a definition of the bundled reference that describes this node, e.g. `io.k8s.api.core.v1.PodSpec`. */
  readonly ref?: string;
  readonly items?: SchemaNode;
  readonly additionalProperties?: SchemaNode | boolean;
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  /** Validation rules of a CRD field, already phrased for display: `pattern: ^[a-z]+$`, `≥ 1`, ... */
  readonly constraints?: readonly string[];
  readonly intOrString?: boolean;
  readonly preserveUnknownFields?: boolean;
}

/** Finds a definition by name, in the Kubernetes version it belongs to. */
export type SchemaResolver = (definition: string) => SchemaNode | undefined;

export interface ApiReferenceResource {
  readonly apiVersion: string;
  readonly kind: string;
  /** The definition describing the resource. */
  readonly definition: string;
}

export interface ApiReferenceVersion {
  /** The Kubernetes minor version, e.g. `1.36`. */
  readonly kubernetesVersion: string;
  readonly resources: readonly ApiReferenceResource[];
  /** Each definition of this version by name, as an index into the distinct definitions of all versions. */
  readonly definitions: Readonly<Record<string, number>>;
}

export interface ApiReferenceData {
  /** Newest first. */
  readonly versions: readonly ApiReferenceVersion[];
  /** Every distinct definition once, shared by the versions it is the same in. */
  readonly definitions: readonly SchemaNode[];
  /** kubernetes.io's structured reference page of a kind, by `<apiVersion>|<kind>`, as the site is today. */
  readonly referencePages: Readonly<Record<string, string>>;
}

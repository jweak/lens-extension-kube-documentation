import type { SchemaNode, SchemaResolver } from "./api-reference-data";

export type DocumentationSource =
  | {
      readonly type: "built-in";
      readonly kubernetesVersion: string;
      /** The API version asked for, when the bundled reference lacks it and another version of the kind is shown instead. */
      readonly requestedApiVersion?: string;
    }
  | {
      readonly type: "custom-resource";
      readonly crdName: string;
      /** The Kubernetes version whose reference describes the fields every resource has, such as metadata. */
      readonly kubernetesVersion: string;
      /** The CRD's deprecation warning for this version, when the version is deprecated. */
      readonly deprecationWarning?: string;
    }
  | {
      /** Read from the API schema the cluster itself serves, for what the bundled reference does not cover. */
      readonly type: "cluster";
      /** The minor version the cluster runs, such as `1.45`, when it could tell. */
      readonly kubernetesVersion?: string;
      /** What the cluster calls its version, such as `v1.45.2`, when it could tell. */
      readonly gitVersion?: string;
    };

/** Everything the view shows for one kind in one API version. */
export interface ResourceDocumentation {
  readonly apiVersion: string;
  readonly kind: string;
  readonly source: DocumentationSource;
  readonly schema: SchemaNode;
  /** Finds the definitions the schema refers to, in the Kubernetes version the documentation is of. */
  readonly resolve: SchemaResolver;
  readonly referenceUrl?: string;
  readonly conceptUrl?: string;
}

/** What documentation is asked for: a kind in an API version. */
export interface DocumentationTarget {
  readonly apiVersion: string;
  readonly kind: string;
}

export const getGroup = (apiVersion: string) => (apiVersion.includes("/") ? apiVersion.slice(0, apiVersion.indexOf("/")) : "");

export const getVersion = (apiVersion: string) => apiVersion.slice(apiVersion.indexOf("/") + 1);

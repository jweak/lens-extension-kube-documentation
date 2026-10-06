import type { CustomResourceDefinitionV1 } from "@k8slens/kubernetes-contracts";
import type { SchemaNode } from "./api-reference-data";
import type { KubernetesApiReference } from "./built-in-documentation";
import { fromOpenApiSchema, type OpenApiSchema } from "./openapi-schema";
import { getGroup, getVersion, type ResourceDocumentation } from "./resource-documentation";

const objectMetaDefinition = "io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta";

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
    ? fromOpenApiSchema(openApiSchema as OpenApiSchema)
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

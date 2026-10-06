import { DrawerItem, ExpandableDrawerItem } from "@k8slens/details-panel-components";
import { buildDetailsPanelSectionBunch, type DetailsPanelSectionProps } from "@k8slens/details-panel-contracts";
import { Div } from "@k8slens/element-components";
import { ArrowOutwardIcon } from "@k8slens/icon";
import { getKubeResourceKind, getKubernetesApiVersion } from "@k8slens/kubernetes-contracts";
import { useInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import { allBuiltInResources, getBuiltInDocumentation } from "../api-reference/built-in-documentation";
import { getSummary } from "../api-reference/fields";
import { ExternalLink, TextLink } from "../components/links";
import { RichText } from "../components/rich-text";
import { openResourceDocumentationInjectable } from "../documentation-tab/open-resource-documentation.injectable";
import { clusterKubernetesVersionInjectable } from "../kubernetes-version/cluster-kubernetes-version.injectable";

const DocumentationSection = observer(({ resource, clusterId }: DetailsPanelSectionProps) => {
  const openResourceDocumentation = useInject(openResourceDocumentationInjectable)();
  const kubernetesVersion = useInject(clusterKubernetesVersionInjectable)(clusterId).get()?.kubernetesVersion;
  const documentation = kubernetesVersion && getBuiltInDocumentation(kubernetesVersion, resource.apiVersion, resource.kind);

  if (!documentation) {
    return null;
  }

  const description = documentation.schema.description?.trim();
  const summary = getSummary(description);

  return (
    <>
      {description && summary && (
        <ExpandableDrawerItem
          name="About"
          collapsedContent={<RichText text={summary} />}
          isExpandable={summary !== description}
        >
          <RichText text={description} />
        </ExpandableDrawerItem>
      )}
      <DrawerItem name="Reference">
        <Div $flex={{ gap: "l", wrap: true, verticalAlign: "center" }}>
          <TextLink
            $onClick={() => void openResourceDocumentation(clusterId, { apiVersion: resource.apiVersion, kind: resource.kind })}
            $tooltip={`Browse every field of ${resource.kind} in the dock`}
          >
            Browse fields
          </TextLink>
          {documentation.referenceUrl && (
            <ExternalLink url={documentation.referenceUrl} $flex={{ gap: "xxs", verticalAlign: "center" }}>
              API reference <ArrowOutwardIcon $size="s" />
            </ExternalLink>
          )}
          {documentation.conceptUrl && (
            <ExternalLink url={documentation.conceptUrl} $flex={{ gap: "xxs", verticalAlign: "center" }}>
              Concepts <ArrowOutwardIcon $size="s" />
            </ExternalLink>
          )}
        </Div>
      </DrawerItem>
    </>
  );
});

/**
 * A Documentation section at the end of the details panel of every built-in kind, in every API
 * version any bundled Kubernetes version has. Sections are registered per kind and version, hence one each.
 */
export const documentationSectionBunches = allBuiltInResources.map(({ apiVersion, kind }) =>
  buildDetailsPanelSectionBunch({
    id: "kube-documentation-section",
    kind: getKubeResourceKind(kind),
    apiVersion: getKubernetesApiVersion(apiVersion),
    title: "Documentation",
    orderNumber: 1000,
    Component: DocumentationSection,
  }),
);

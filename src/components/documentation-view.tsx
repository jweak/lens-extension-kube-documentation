import { Badge } from "@k8slens/badge";
import { Div, H3, Span } from "@k8slens/element-components";
import { ArrowOutwardIcon, WarningIcon } from "@k8slens/icon";
import { TextInput } from "@k8slens/input-components";
import { useInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import type { ReactNode } from "react";
import { getExpandablePaths, getRootContainer } from "../api-reference/fields";
import type { ResourceDocumentation } from "../api-reference/resource-documentation";
import {
  type DocumentationViewState,
  documentationViewStateInjectable,
} from "../documentation-tab/documentation-view-state.injectable";
import { showCustomResourceDefinitionInjectable } from "../documentation-tab/show-custom-resource-definition.injectable";
import { ExternalLink, TextLink } from "./links";
import { FieldList } from "./field-tree";
import { OutlinedButton } from "./outlined-button";
import { RichText } from "./rich-text";
import { SearchResults } from "./search-results";
import { KubernetesVersionPicker } from "../kubernetes-version/kubernetes-version-picker";
import { clusterKubernetesVersionInjectable } from "../kubernetes-version/cluster-kubernetes-version.injectable";

// Deep enough to open what a user reads first, such as a pod's containers, without opening all 1,300 fields of a Pod.
const expandAllDepth = 3;

const Notice = ({ children }: { readonly children: ReactNode }) => (
  <Div $flex={{ gap: "s", verticalAlign: "center" }} $color="warning" $font={{ size: "s" }}>
    <WarningIcon $size="s" $flexChild="fixed" />
    <Span>{children}</Span>
  </Div>
);

const Links = ({ documentation, clusterId }: { readonly documentation: ResourceDocumentation; readonly clusterId: string }) => {
  const showCustomResourceDefinition = useInject(showCustomResourceDefinitionInjectable)();
  const { source, referenceUrl, conceptUrl } = documentation;

  return (
    <Div $flex={{ gap: "l", verticalAlign: "center", wrap: true }}>
      {source.type === "custom-resource" && (
        <TextLink $onClick={() => showCustomResourceDefinition(clusterId, source.crdName)} $tooltip={source.crdName}>
          Show CustomResourceDefinition
        </TextLink>
      )}
      {referenceUrl && (
        <ExternalLink url={referenceUrl} $flex={{ gap: "xxs", verticalAlign: "center" }}>
          API reference <ArrowOutwardIcon $size="s" />
        </ExternalLink>
      )}
      {conceptUrl && (
        <ExternalLink url={conceptUrl} $flex={{ gap: "xxs", verticalAlign: "center" }}>
          Concepts <ArrowOutwardIcon $size="s" />
        </ExternalLink>
      )}
    </Div>
  );
};

interface HeaderProps {
  readonly documentation: ResourceDocumentation;
  readonly clusterId: string;
  readonly state: DocumentationViewState;
}

const Header = observer(({ documentation, clusterId, state }: HeaderProps) => {
  const { kind, apiVersion, source, schema, resolve } = documentation;
  const filtering = state.getFilter().trim() !== "";
  const clusterVersion = useInject(clusterKubernetesVersionInjectable)(clusterId).get();
  const cluster = clusterVersion?.cluster;

  return (
    <Div
      $flexChild="fixed"
      $flex={{ direction: "vertical", gap: "s" }}
      $padding={{ horizontal: "l", vertical: "m" }}
      $border={{ bottom: { width: "xxs", color: "grey60" } }}
    >
      <Div $flex={{ gap: "l", verticalAlign: "center", horizontalAlign: "space-between", wrap: true }}>
        <Div $flex={{ gap: "s", verticalAlign: "center", wrap: true }}>
          <H3 $font={{ size: "xl", bold: true }} $color="textHighlight" $margin="zero">
            {kind}
          </H3>
          <Badge small label={apiVersion} $tooltip="API version" />
          {source.type === "custom-resource" && (
            <Badge small label="Custom resource" $tooltip={`From the schema of CustomResourceDefinition ${source.crdName}`} />
          )}
          <KubernetesVersionPicker clusterId={clusterId} />
        </Div>
        <Links documentation={documentation} clusterId={clusterId} />
      </Div>

      {source.type === "built-in" && source.requestedApiVersion && (
        <Notice>
          Kubernetes {source.kubernetesVersion} has no {source.requestedApiVersion}, so this is {kind} as {apiVersion}{" "}
          describes it.
        </Notice>
      )}
      {source.type === "custom-resource" && source.deprecationWarning && <Notice>{source.deprecationWarning}</Notice>}
      {cluster && clusterVersion.chosen && (
        <Notice>
          Showing Kubernetes {clusterVersion.kubernetesVersion}, but this cluster runs {cluster.gitVersion}.
        </Notice>
      )}
      {cluster && !clusterVersion.chosen && cluster.nearestBundled !== cluster.kubernetesVersion && (
        <Notice>
          This cluster runs Kubernetes {cluster.gitVersion}, whose reference is not bundled, so this is Kubernetes{" "}
          {cluster.nearestBundled}.
        </Notice>
      )}

      {/* Stretched, so the buttons stand as tall as the input beside them. */}
      <Div $flex={{ gap: "s", verticalAlign: "stretch" }}>
        {/* Lens's input, at the height of Lens's compact filter inputs rather than of a form field. */}
        <TextInput
          type="search"
          placeholder="Filter fields by name or description…"
          value={state.getFilter()}
          onChange={(event) => state.setFilter(event.target.value)}
          $width="40%"
          $padding={{ vertical: "xxs", horizontal: "xs" }}
          $font={{ size: "s", lineHeight: "tight" }}
        />
        <OutlinedButton
          $enabled={!filtering}
          $tooltip={filtering ? "Clear the filter to expand the tree" : `Expand the first ${expandAllDepth} levels of fields`}
          $onClick={() => state.expandAll(getExpandablePaths(resolve, schema, expandAllDepth))}
        >
          Expand
        </OutlinedButton>
        <OutlinedButton
          $enabled={!filtering && state.hasExpanded()}
          $onClick={() => state.collapseAll()}
        >
          Collapse
        </OutlinedButton>
      </Div>
    </Div>
  );
});

interface DocumentationViewProps {
  readonly documentation: ResourceDocumentation;
  readonly clusterId: string;
  /** What the view's filter and expanded fields are kept by. */
  readonly viewId: string;
}

/** The documentation of one kind: what it is, and every field it has, browsable and searchable. */
export const DocumentationView = observer(({ documentation, clusterId, viewId }: DocumentationViewProps) => {
  const state = useInject(documentationViewStateInjectable)(viewId);
  const root = getRootContainer(documentation.resolve, documentation.schema);
  const filtering = state.getFilter().trim() !== "";

  return (
    <Div $flex={{ direction: "vertical" }} $height="full" $width="full">
      <Header documentation={documentation} clusterId={clusterId} state={state} />

      <Div
        $flexChild="shrinkable"
        $overflow={{ y: "auto" }}
        $padding={{ horizontal: "l", vertical: "m" }}
        $flex={{ direction: "vertical", gap: "l" }}
      >
        {filtering ? (
          <SearchResults documentation={documentation} state={state} />
        ) : (
          <>
            {documentation.schema.description && <RichText text={documentation.schema.description} />}
            {root ? (
              <FieldList container={root} resolve={documentation.resolve} state={state} />
            ) : (
              <Span $color="textMuted">This kind declares no fields.</Span>
            )}
          </>
        )}
      </Div>
    </Div>
  );
});

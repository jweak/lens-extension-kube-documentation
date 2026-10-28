import { Div, Span } from "@k8slens/element-components";
import { SpinnerIcon } from "@k8slens/icon";
import {
  apiextensionsV1,
  customResourceDefinitionKind,
  type CustomResourceDefinitionV1,
  getKubeResourceKind,
  getKubernetesApiVersion,
  kubeResourceKindIsServedInjectionToken,
  kubeResourcesInjectionToken,
} from "@k8slens/kubernetes-contracts";
import { useSubscribable } from "@k8slens/subscribable-react";
import { useInject, useSyncInject } from "@k8slens/use-inject";
import type { IComputedValue } from "mobx";
import { observer } from "mobx-react";
import { type ReactNode, Suspense, use } from "react";
import {
  getApiReference,
  getBuiltInDocumentation,
  getVersionsDocumenting,
  isBuiltIn,
} from "../api-reference/built-in-documentation";
import { type ClusterApiSchema, getClusterSchemaDocumentation } from "../api-reference/cluster-schema-documentation";
import { getCustomResourceDocumentation, matchesTarget } from "../api-reference/custom-resource-documentation";
import { type DocumentationTarget, getVersion } from "../api-reference/resource-documentation";
import { openDocumentationWindowInjectable } from "../documentation-window/open-documentation-window.injectable";
import { clusterApiSchemaBunch } from "../kubernetes-version/cluster-api-schema.injectable";
import { clusterKubernetesVersionInjectable } from "../kubernetes-version/cluster-kubernetes-version.injectable";
import { KubernetesVersionPicker } from "../kubernetes-version/kubernetes-version-picker";
import { DocumentationView } from "./documentation-view";
import { ErrorBoundary } from "./error-boundary";

interface DocumentationForTargetProps {
  readonly clusterId: string;
  readonly target: DocumentationTarget;
  readonly viewId: string;
  /** Whether the documentation is shown in a window of its own already, rather than in the dock. */
  readonly inWindow?: boolean;
}

// What every view below gets: the props, and a way to open the same documentation in a window, unless it is in one.
interface ViewProps extends DocumentationForTargetProps {
  readonly openInWindow?: () => void;
}

interface VersionedProps extends ViewProps {
  /** The Kubernetes version the cluster is documented as. */
  readonly kubernetesVersion: string;
}

const Message = ({ children }: { readonly children: ReactNode }) => (
  <Div $padding="l" $flex={{ direction: "vertical", gap: "s" }} $color="textDefault">
    {children}
  </Div>
);

const formatVersions = (versions: readonly string[]) =>
  versions.length === 1 ? versions[0] : `${versions.at(-1)} to ${versions[0]}`;

const NotDocumented = (props: VersionedProps & { readonly crd?: CustomResourceDefinitionV1 }) => {
  const documentingVersions = getVersionsDocumenting(props.target.apiVersion, props.target.kind);

  // Neither bundled nor a CRD: an aggregated API, or a kind newer than the bundle, which the cluster's
  // own schema may still describe.
  return !props.crd && documentingVersions.length === 0 ? (
    <ClusterSchemaDocumentation {...props} fallback={<NoDocumentationMessage {...props} documentingVersions={documentingVersions} />} />
  ) : (
    <NoDocumentationMessage {...props} documentingVersions={documentingVersions} />
  );
};

interface MissingInVersionProps {
  readonly clusterId: string;
  readonly target: DocumentationTarget;
  readonly kubernetesVersion: string;
  readonly documentingVersions: readonly string[];
}

// Reads whether the cluster serves the kind in that API version; suspends until the cluster has answered.
const MissingInVersionReader = observer(({ clusterId, target, kubernetesVersion, documentingVersions }: MissingInVersionProps) => {
  const kindIsServed = useSyncInject(kubeResourceKindIsServedInjectionToken);
  const { value } = useSubscribable(
    kindIsServed(getKubeResourceKind(target.kind), getKubernetesApiVersion(target.apiVersion), clusterId),
  );
  const served = use(value).get();

  return served ? (
    <Span>
      Kubernetes {kubernetesVersion} does not have it, yet this cluster serves it, so {kubernetesVersion} is not the version
      the cluster runs. Kubernetes {formatVersions(documentingVersions)} has it: choose the cluster&apos;s version above.
    </Span>
  ) : (
    <Span>
      Kubernetes {kubernetesVersion} does not have it, and this cluster does not serve it either. Kubernetes{" "}
      {formatVersions(documentingVersions)} has it.
    </Span>
  );
});

/**
 * Why a kind some bundled version documents is not shown: the chosen Kubernetes version lacks it,
 * and, once the cluster has answered, whether the cluster serves it all the same.
 */
const MissingInVersion = (props: MissingInVersionProps) => {
  const withoutTheCluster = (
    <Span>
      Kubernetes {props.kubernetesVersion} does not have it. Kubernetes {formatVersions(props.documentingVersions)} does:
      choose the version this cluster runs above.
    </Span>
  );

  return (
    <ErrorBoundary fallback={() => withoutTheCluster}>
      <Suspense fallback={withoutTheCluster}>
        <MissingInVersionReader {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const NoDocumentationMessage = ({
  target,
  clusterId,
  kubernetesVersion,
  crd,
  documentingVersions,
}: VersionedProps & { readonly crd?: CustomResourceDefinitionV1; readonly documentingVersions: readonly string[] }) => (
  <Message>
    <Div $flex={{ gap: "s", verticalAlign: "center", wrap: true }}>
      <Span $font={{ bold: true }} $color="textHighlight">
        No documentation for {target.kind} ({target.apiVersion})
      </Span>
      <KubernetesVersionPicker clusterId={clusterId} />
    </Div>
    {crd ? (
      <Span>
        Its CustomResourceDefinition, {crd.metadata.name}, declares no version {getVersion(target.apiVersion)}.
      </Span>
    ) : documentingVersions.length > 0 ? (
      <MissingInVersion
        clusterId={clusterId}
        target={target}
        kubernetesVersion={kubernetesVersion}
        documentingVersions={documentingVersions}
      />
    ) : (
      <Span>
        It is not in any bundled Kubernetes version, the cluster has no CustomResourceDefinition for it, and the API
        schema the cluster serves does not describe it either.
      </Span>
    )}
  </Message>
);

const CustomResourceDocumentation = observer(
  ({ crds, ...props }: VersionedProps & { readonly crds: IComputedValue<readonly CustomResourceDefinitionV1[]> }) => {
    const { target, kubernetesVersion } = props;
    const crd = crds.get().find((candidate) => matchesTarget(candidate, target.apiVersion, target.kind));
    const documentation = crd && getCustomResourceDocumentation(crd, target.apiVersion, target.kind, getApiReference(kubernetesVersion));

    return documentation ? (
      <DocumentationView documentation={documentation} clusterId={props.clusterId} viewId={props.viewId} openInWindow={props.openInWindow} />
    ) : (
      <NotDocumented {...props} crd={crd} />
    );
  },
);

// Suspends until the cluster's CRDs have been listed. It observes nothing itself: a render React
// throws away while suspended would otherwise leave a MobX observer behind.
const CustomResourceDefinitionsLoader = (props: VersionedProps) => {
  const kubeResources = useSyncInject(kubeResourcesInjectionToken);
  const { value } = useSubscribable(kubeResources(customResourceDefinitionKind, apiextensionsV1, props.clusterId));
  const crds = use(value);

  return <CustomResourceDocumentation {...props} crds={crds} />;
};

const Loading = ({ children }: { readonly children: ReactNode }) => (
  <Message>
    <Div $flex={{ gap: "s", verticalAlign: "center" }}>
      <SpinnerIcon $size="m" /> {children}
    </Div>
  </Message>
);

interface ClusterSchemaProps extends ViewProps {
  readonly fallback: ReactNode;
}

// The documentation as the schema has it, once read; `fallback` when the schema does not have the kind.
const ClusterSchemaView = observer(
  ({ document, clusterId, target, viewId, openInWindow, fallback }: ClusterSchemaProps & { readonly document: IComputedValue<ClusterApiSchema> }) => {
    const clusterVersion = useInject(clusterKubernetesVersionInjectable)(clusterId).get()?.cluster;
    const documentation = getClusterSchemaDocumentation(document.get(), target.apiVersion, target.kind, clusterVersion);

    return documentation ? (
      <DocumentationView documentation={documentation} clusterId={clusterId} viewId={viewId} openInWindow={openInWindow} />
    ) : (
      <>{fallback}</>
    );
  },
);

// Suspends until the schema is read, observing nothing itself, as the CRD loader does.
const ClusterSchemaLoader = (props: ClusterSchemaProps) => {
  const schema = useSyncInject(clusterApiSchemaBunch.subscribable, props.clusterId, props.target.apiVersion);
  const { value } = useSubscribable(schema);
  const document = use(value);

  return <ClusterSchemaView {...props} document={document} />;
};

/**
 * The documentation of a kind as the API schema the cluster serves has it, for what the bundled
 * reference does not cover; `fallback` when the schema cannot be read or does not have the kind.
 */
const ClusterSchemaDocumentation = (props: ClusterSchemaProps) => (
  <ErrorBoundary fallback={() => <>{props.fallback}</>}>
    <Suspense fallback={<Loading>Reading the API schema the cluster serves…</Loading>}>
      <ClusterSchemaLoader {...props} />
    </Suspense>
  </ErrorBoundary>
);

const CouldNotReadCustomResourceDefinitions = ({ error, target }: VersionedProps & { readonly error: Error }) => (
  <Message>
    <Span $font={{ bold: true }} $color="textHighlight">
      Could not read the cluster&apos;s CustomResourceDefinitions
    </Span>
    <Span>
      {target.kind} ({target.apiVersion}) is not a built-in kind, so its documentation comes from its
      CustomResourceDefinition. {error.message}
    </Span>
  </Message>
);

/**
 * The documentation of a kind: from the bundled reference of the Kubernetes version the cluster is
 * documented as for a built-in kind, from its CRD for a custom resource, and from the API schema
 * the cluster serves for what neither has.
 */
export const DocumentationForTarget = observer((props: DocumentationForTargetProps) => {
  const openDocumentationWindow = useInject(openDocumentationWindowInjectable)();
  const version = useInject(clusterKubernetesVersionInjectable)(props.clusterId).get();

  if (!version) {
    // The cluster is asked for its version, and the remembered choice read, before anything is shown, so the documentation does not flicker from one version to another.
    return null;
  }

  const viewProps: ViewProps = {
    ...props,
    openInWindow: props.inWindow ? undefined : () => void openDocumentationWindow({ clusterId: props.clusterId, ...props.target }),
  };
  const bundled = <BundledDocumentation {...viewProps} kubernetesVersion={version.bundledKubernetesVersion} />;

  // A cluster running a version the bundle does not have is documented from its own API schema.
  return version.live ? <ClusterSchemaDocumentation {...viewProps} fallback={bundled} /> : bundled;
});

/** The documentation from the bundled reference of a Kubernetes version, or from its CRD for a custom resource. */
const BundledDocumentation = (props: VersionedProps) => {
  const { clusterId, target, viewId, kubernetesVersion, openInWindow } = props;

  if (isBuiltIn(target.apiVersion, target.kind)) {
    const documentation = getBuiltInDocumentation(kubernetesVersion, target.apiVersion, target.kind);

    return documentation ? (
      <DocumentationView documentation={documentation} clusterId={clusterId} viewId={viewId} openInWindow={openInWindow} />
    ) : (
      <NotDocumented {...props} />
    );
  }

  return (
    <ErrorBoundary fallback={(error) => <CouldNotReadCustomResourceDefinitions {...props} error={error} />}>
      <Suspense fallback={<Loading>Reading the cluster&apos;s CustomResourceDefinitions…</Loading>}>
        <CustomResourceDefinitionsLoader {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

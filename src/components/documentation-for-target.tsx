import { Div, Span } from "@k8slens/element-components";
import { SpinnerIcon } from "@k8slens/icon";
import {
  apiextensionsV1,
  customResourceDefinitionKind,
  type CustomResourceDefinitionV1,
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
import { getCustomResourceDocumentation, matchesTarget } from "../api-reference/custom-resource-documentation";
import { type DocumentationTarget, getVersion } from "../api-reference/resource-documentation";
import { clusterKubernetesVersionInjectable } from "../kubernetes-version/cluster-kubernetes-version.injectable";
import { KubernetesVersionPicker } from "../kubernetes-version/kubernetes-version-picker";
import { DocumentationView } from "./documentation-view";
import { ErrorBoundary } from "./error-boundary";

interface DocumentationForTargetProps {
  readonly clusterId: string;
  readonly target: DocumentationTarget;
  readonly viewId: string;
}

interface VersionedProps extends DocumentationForTargetProps {
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

const NotDocumented = ({
  target,
  clusterId,
  kubernetesVersion,
  crd,
}: VersionedProps & { readonly crd?: CustomResourceDefinitionV1 }) => {
  const documentingVersions = getVersionsDocumenting(target.apiVersion, target.kind);

  return (
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
        <Span>
          Kubernetes {kubernetesVersion} does not have it. Kubernetes {formatVersions(documentingVersions)} does: choose the
          version this cluster runs above.
        </Span>
      ) : (
        <Span>
          It is not a built-in kind of any bundled Kubernetes version, and the cluster has no CustomResourceDefinition for
          it. An aggregated API server may be serving it instead.
        </Span>
      )}
    </Message>
  );
};

const CustomResourceDocumentation = observer(
  ({ crds, ...props }: VersionedProps & { readonly crds: IComputedValue<readonly CustomResourceDefinitionV1[]> }) => {
    const { target, kubernetesVersion } = props;
    const crd = crds.get().find((candidate) => matchesTarget(candidate, target.apiVersion, target.kind));
    const documentation = crd && getCustomResourceDocumentation(crd, target.apiVersion, target.kind, getApiReference(kubernetesVersion));

    return documentation ? (
      <DocumentationView documentation={documentation} clusterId={props.clusterId} viewId={props.viewId} />
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

const Loading = () => (
  <Message>
    <Div $flex={{ gap: "s", verticalAlign: "center" }}>
      <SpinnerIcon $size="m" /> Reading the cluster&apos;s CustomResourceDefinitions…
    </Div>
  </Message>
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
 * documented as for a built-in kind, from its CRD for a custom resource.
 */
export const DocumentationForTarget = observer((props: DocumentationForTargetProps) => {
  const { clusterId, target, viewId } = props;
  const kubernetesVersion = useInject(clusterKubernetesVersionInjectable)(clusterId).get()?.kubernetesVersion;

  if (!kubernetesVersion) {
    // The cluster is asked for its version, and the remembered choice read, before anything is shown, so the documentation does not flicker from one version to another.
    return null;
  }

  if (isBuiltIn(target.apiVersion, target.kind)) {
    const documentation = getBuiltInDocumentation(kubernetesVersion, target.apiVersion, target.kind);

    return documentation ? (
      <DocumentationView documentation={documentation} clusterId={clusterId} viewId={viewId} />
    ) : (
      <NotDocumented {...props} kubernetesVersion={kubernetesVersion} />
    );
  }

  return (
    <ErrorBoundary
      fallback={(error) => <CouldNotReadCustomResourceDefinitions {...props} kubernetesVersion={kubernetesVersion} error={error} />}
    >
      <Suspense fallback={<Loading />}>
        <CustomResourceDefinitionsLoader {...props} kubernetesVersion={kubernetesVersion} />
      </Suspense>
    </ErrorBoundary>
  );
});

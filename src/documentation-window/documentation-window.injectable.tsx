import { Div } from "@k8slens/element-components";
import { getSubWindowKindInjectableBunch, type SubWindowContentProps } from "@k8slens/sub-window-contracts";
import { DocumentationForTarget } from "../components/documentation-for-target";
import { documentationWindowKind } from "./documentation-window-kind";

const DocumentationWindow = ({ id, params: { clusterId, ...target } }: SubWindowContentProps<typeof documentationWindowKind>) => (
  <Div $size="full" $backgroundColor="backgroundPrimary">
    <DocumentationForTarget clusterId={clusterId} target={target} viewId={`window/${id}`} inWindow />
  </Div>
);

/**
 * The documentation of a kind in a window of its own, for reading beside the cluster rather than
 * below it. A window layout opens it again with what it was opened with.
 */
export const documentationWindowBunch = getSubWindowKindInjectableBunch({
  kind: documentationWindowKind,
  Component: DocumentationWindow,

  configuration: {
    title: ({ kind, apiVersion }) => `Docs: ${kind} (${apiVersion})`,
    defaultWidth: 960,
    defaultHeight: 720,
    minWidth: 480,
    minHeight: 320,
  },
});

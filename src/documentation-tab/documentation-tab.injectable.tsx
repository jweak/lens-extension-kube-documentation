import { dockTabHostKind } from "@k8slens/dock-view-contracts";
import { Div, Span } from "@k8slens/element-components";
import { DescriptionIcon } from "@k8slens/icon";
import { getTabKindInjectableBunch, type TabProps } from "@k8slens/tab-contracts";
import { DocumentationForTarget } from "../components/documentation-for-target";
import { documentationTabKind, parseTabId } from "./documentation-tab-kind";

const DocumentationTabTitle = ({ tabId }: TabProps<typeof dockTabHostKind>) => {
  const target = parseTabId(tabId);

  return (
    <Div
      $flex={{ gap: "xs", verticalAlign: "center" }}
      $tooltip={target && `Documentation of ${target.kind} (${target.apiVersion})`}
    >
      <DescriptionIcon $size="s" />
      <Span>Docs: {target?.kind ?? tabId}</Span>
    </Div>
  );
};

const DocumentationTab = ({ tabHostId: clusterId, tabId }: TabProps<typeof dockTabHostKind>) => {
  const target = parseTabId(tabId);

  if (!target) {
    return (
      <Div $padding="l" $color="textMuted">
        This tab does not say which kind to document.
      </Div>
    );
  }

  return <DocumentationForTarget clusterId={clusterId} target={target} viewId={`${clusterId}/${tabId}`} />;
};

export const documentationTabBunch = getTabKindInjectableBunch({
  tabHostKind: dockTabHostKind,
  kind: documentationTabKind,
  Component: DocumentationTab,
  Title: DocumentationTabTitle,
});

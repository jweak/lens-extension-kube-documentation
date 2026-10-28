import { clusterPageNavigatorItemKind } from "@k8slens/cluster-contracts";
import { useCloseDropDownMenu } from "@k8slens/drop-down-menu-contracts";
import { DropDownMenuItemRow } from "@k8slens/drop-down-menu-items";
import { DescriptionIcon } from "@k8slens/icon";
import {
  getNavigatorItemMenuItemInjectableBunch,
  type NavigatorItemOfKind,
  navigatorItemDropDownMenuOrderNumbers,
} from "@k8slens/navigator-contracts";
import { useInject } from "@k8slens/use-inject";
import { openDocumentationOfInjectable } from "../cluster-kinds/open-documentation-of.injectable";
import type { KindQuery } from "../cluster-kinds/resolve-documentation-target.injectable";

/**
 * The group and plural name of the kind a page of the navigator lists, from the page's path:
 * `/api/pods` for the core group, `/apis/<group>/<plural>` for the others, custom resources
 * included. Undefined for a page that lists no kind, Overview say.
 */
export const parsePagePath = (path: string): KindQuery | undefined => {
  const core = /^\/api\/([^/]+)$/.exec(path);

  if (core) {
    return { group: "", plural: core[1] };
  }

  const grouped = /^\/apis\/([^/]+)\/([^/]+)$/.exec(path);

  return grouped ? { group: grouped[1], plural: grouped[2] } : undefined;
};

const PageDocumentation = ({ data }: { readonly data: NavigatorItemOfKind<typeof clusterPageNavigatorItemKind> }) => {
  const openDocumentationOf = useInject(openDocumentationOfInjectable)();
  const closeMenu = useCloseDropDownMenu();
  const [clusterId, path] = data.ids;
  const query = parsePagePath(path);

  return (
    <DropDownMenuItemRow
      Icon={DescriptionIcon}
      $onClick={() => {
        closeMenu();

        if (query) {
          void openDocumentationOf(clusterId, query);
        }
      }}
    >
      Documentation
    </DropDownMenuItemRow>
  );
};

/** A row in the menu of every page of a cluster that lists a kind, Pods or a custom resource's, opening the kind's documentation. */
export const pageDocumentationMenuItemBunch = getNavigatorItemMenuItemInjectableBunch({
  id: "kube-documentation-page-documentation",
  forItemsOfKind: clusterPageNavigatorItemKind,
  orderNumber: navigatorItemDropDownMenuOrderNumbers.sectionEnd + 100,
  isVisible: (item) => parsePagePath(item.ids[1] ?? "") !== undefined,
  Component: PageDocumentation,
});

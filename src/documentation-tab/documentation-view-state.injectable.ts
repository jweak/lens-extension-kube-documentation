import { getInjectable2 } from "@k8slens/injectable";
import { action, observable } from "mobx";

// The rows that contain a field: `spec.containers[].image` is inside `spec` and `spec.containers`.
// A `*` stands for the keys of a map, which have no row of their own.
const getAncestorPaths = (path: string) => {
  const segments = path.split(".");

  return segments
    .slice(0, -1)
    .map((segment, index) => (segment === "*" ? undefined : segments.slice(0, index + 1).join(".").replace(/(\[\])+$/, "")))
    .filter((ancestor): ancestor is string => ancestor !== undefined);
};

const createDocumentationViewState = () => {
  const filter = observable.box("");
  // A map rather than a set: a row observes only its own key of a map.
  const expanded = observable.map<string, true>();
  const highlighted = observable.box<string | undefined>(undefined);

  return {
    getFilter: () => filter.get(),
    setFilter: action((value: string) => filter.set(value)),
    isExpanded: (path: string) => expanded.has(path),
    hasExpanded: () => expanded.size > 0,
    toggle: action((path: string) => {
      if (expanded.has(path)) {
        expanded.delete(path);
      } else {
        expanded.set(path, true);
      }
    }),
    expandAll: action((paths: readonly string[]) => {
      expanded.merge(paths.map((path) => [path, true] as const));
    }),
    collapseAll: action(() => {
      expanded.clear();
      highlighted.set(undefined);
    }),
    isHighlighted: (path: string) => highlighted.get() === path,
    /** Leaves the filtered results for the tree, opened down to the field and with the field marked. */
    showInTree: action((path: string) => {
      expanded.merge(getAncestorPaths(path).map((ancestor) => [ancestor, true] as const));
      highlighted.set(path);
      filter.set("");
    }),
  };
};

export type DocumentationViewState = ReturnType<typeof createDocumentationViewState>;

/**
 * What the user did to one documentation view: the filter typed and the fields expanded. Kept per
 * view, and outside React, so switching to another tab and back leaves it as it was.
 */
export const documentationViewStateInjectable = getInjectable2({
  id: "kube-documentation-view-state",
  instantiate: () => (_viewId: string) => createDocumentationViewState(),
});

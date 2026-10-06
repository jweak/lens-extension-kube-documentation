import { getTabKind } from "@k8slens/tab-contracts";
import type { DocumentationTarget } from "../api-reference/resource-documentation";

/**
 * A dock tab documenting one kind in one API version. It is opened by its id alone, which
 * carries what it documents, so Lens restoring the tab after a restart is all it takes.
 */
export const documentationTabKind = getTabKind()("resource-documentation");

// `apps/v1/Deployment`, `v1/Pod`: the API version, then the kind, which never has a slash.
export const toTabId = ({ apiVersion, kind }: DocumentationTarget) => `${apiVersion}/${kind}`;

export const parseTabId = (tabId: string): DocumentationTarget | undefined => {
  const separator = tabId.lastIndexOf("/");

  if (separator <= 0 || separator === tabId.length - 1) {
    return undefined;
  }

  return { apiVersion: tabId.slice(0, separator), kind: tabId.slice(separator + 1) };
};

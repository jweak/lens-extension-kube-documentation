import { getSubWindowKind } from "@k8slens/sub-window-contracts";
import type { DocumentationPlace } from "../api-reference/resource-documentation";

/** A window of its own showing the documentation of one kind on one cluster. */
export const documentationWindowKind = getSubWindowKind<DocumentationPlace>()("resource-documentation");

// One window per kind per cluster: opening the same documentation again brings its window forward.
export const toWindowId = ({ clusterId, apiVersion, kind }: DocumentationPlace) => `${clusterId}/${apiVersion}/${kind}`;

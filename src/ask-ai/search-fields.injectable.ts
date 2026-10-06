import { getAskAiFunctionInjectableBunch, getAskAiFunctionKind } from "@k8slens/ask-ai-contracts";
import { searchFields } from "../api-reference/fields";
import { documentationLookupInjectable } from "./documentation-lookup.injectable";
import { describeSource, type FieldSummary, toFieldSummary } from "./field-summaries";

const maxMatches = 50;

interface SearchFieldsInput {
  readonly clusterId: string;
  readonly apiVersion: string;
  readonly kind: string;
  readonly query: string;
}

interface SearchFieldsOutput {
  readonly documentedAs: string;
  readonly matches: readonly FieldSummary[];
  readonly totalMatches: number;
}

export const searchFieldsFunctionKind = getAskAiFunctionKind<SearchFieldsInput, SearchFieldsOutput>()("search-fields");

export default getAskAiFunctionInjectableBunch({
  kind: searchFieldsFunctionKind,
  offeredIn: "every-conversation",
  description:
    "Finds the fields of a Kubernetes resource kind whose path or description mentions a word or phrase, in the Kube Documentation extension's API reference for the Kubernetes version the cluster runs, or in the CustomResourceDefinition of a custom resource. Use it to find which field does something, such as which Deployment field sets the termination grace period, or where in a Pod tolerations go; then use explain-field for the full documentation of the one you need.",
  inputDescription:
    "`clusterId` (string): the Lens cluster id. `apiVersion` (string): the kind's API version, such as `apps/v1` or `v1`. `kind` (string): the kind, such as `Deployment`. `query` (string): a word or short phrase to look for, such as `grace period`.",
  outputDescription: `\`documentedAs\` (string): which reference was searched. \`matches\` (array of { \`path\`, \`type\`, \`required\`, \`summary\` }): the matching fields, those whose path matches first, at most ${maxMatches}. \`totalMatches\` (number): how many fields matched in all.`,
  invoke: {
    instantiate: (di) => {
      const lookUpDocumentation = di.inject(documentationLookupInjectable)();

      return () =>
        async ({ clusterId, apiVersion, kind, query }) => {
          const documentation = await lookUpDocumentation(clusterId, apiVersion, kind);
          const matches = searchFields(documentation.resolve, documentation.schema, query);

          return {
            documentedAs: describeSource(documentation),
            matches: matches.slice(0, maxMatches).map(toFieldSummary),
            totalMatches: matches.length,
          };
        };
    },
  },
});

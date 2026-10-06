import { askAiInjectionToken } from "@k8slens/ask-ai-contracts";
import { getInjectable2 } from "@k8slens/injectable";
import { type Field, getFields, getRootContainer } from "../api-reference/fields";
import type { ResourceDocumentation } from "../api-reference/resource-documentation";
import { describeSource } from "./field-summaries";

const describeField = (field: Field) =>
  `- \`${field.path}\` (${field.typeLabel}${field.required ? ", required" : ""})${field.description ? `: ${field.description.split("\n")[0]}` : ""}`;

// What the assistant is told before the user's first message: the kind the user is reading about,
// so it need not look it up before answering.
const brief = (documentation: ResourceDocumentation) => {
  const { kind, apiVersion, schema, resolve } = documentation;
  const root = getRootContainer(resolve, schema);

  return [
    `The user is reading the API documentation of ${kind} (${apiVersion}) in the Kube Documentation extension of Lens, as ${describeSource(documentation)} documents it.`,
    "",
    `## ${kind}`,
    "",
    schema.description ?? "No description.",
    ...(root ? ["", "Its top-level fields:", ...getFields(resolve, root).map(describeField)] : []),
    "",
    "The extension's functions explain any field of a kind, search its fields, compare it between Kubernetes versions, and open its documentation in Lens.",
  ].join("\n");
};

/** Starts an Ask AI conversation about a kind, briefed with its documentation, for the user to ask the first question. */
export const askAiAboutDocumentationInjectable = getInjectable2({
  id: "kube-documentation-ask-ai-about-documentation",
  consumptions: [askAiInjectionToken],

  instantiate: (di) => () => async (clusterId: string, documentation: ResourceDocumentation) => {
    // Injected when asked, so the documentation never depends on Ask AI being there.
    const askAi = di.inject(askAiInjectionToken)();

    await askAi({ clusterId, context: brief(documentation), scopeIds: di.scopeIds });
  },
});

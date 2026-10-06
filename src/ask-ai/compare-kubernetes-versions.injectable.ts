import { getAskAiFunctionInjectableBunch, getAskAiFunctionKind } from "@k8slens/ask-ai-contracts";
import {
  bundledKubernetesVersions,
  getApiReference,
  getBuiltInDocumentation,
  getVersionsDocumenting,
} from "../api-reference/built-in-documentation";
import { type Field, getAllFields } from "../api-reference/fields";

const maxListed = 300;

interface CompareKubernetesVersionsInput {
  readonly apiVersion: string;
  readonly kind: string;
  readonly fromVersion: string;
  readonly toVersion: string;
}

interface FieldChange {
  readonly path: string;
  readonly type: string;
}

interface CompareKubernetesVersionsOutput {
  readonly added: readonly FieldChange[];
  readonly removed: readonly FieldChange[];
  readonly typeChanged: readonly { readonly path: string; readonly fromType: string; readonly toType: string }[];
  readonly truncated: boolean;
}

const normalizeVersion = (version: string) => version.trim().replace(/^v/, "").split(".").slice(0, 2).join(".");

const fieldsOf = (kubernetesVersion: string, apiVersion: string, kind: string) => {
  // Only the API version asked for counts: another one of the kind would compare different things.
  if (!getApiReference(kubernetesVersion).findResource(apiVersion, kind)) {
    const documenting = getVersionsDocumenting(apiVersion, kind);

    throw new Error(
      `Kubernetes ${kubernetesVersion} has no ${kind} in ${apiVersion}. ` +
        (documenting.length > 0
          ? `It is in Kubernetes ${documenting.join(", ")}.`
          : "No bundled Kubernetes version has it; it may be a custom resource, which this function does not compare."),
    );
  }

  const documentation = getBuiltInDocumentation(kubernetesVersion, apiVersion, kind)!;

  return new Map(getAllFields(documentation.resolve, documentation.schema).map((field): [string, Field] => [field.path, field]));
};

export const compareKubernetesVersionsFunctionKind = getAskAiFunctionKind<
  CompareKubernetesVersionsInput,
  CompareKubernetesVersionsOutput
>()("compare-kubernetes-versions");

export default getAskAiFunctionInjectableBunch({
  kind: compareKubernetesVersionsFunctionKind,
  offeredIn: "every-conversation",
  description: `Lists the fields of a built-in Kubernetes resource kind that were added, removed or changed type between two Kubernetes versions, from the API references the Kube Documentation extension bundles (Kubernetes ${bundledKubernetesVersions.at(-1)} to ${bundledKubernetesVersions[0]}). Use it when planning an upgrade, or to tell whether a field exists in the version a cluster runs. It needs no cluster and does not cover custom resources; to explain one field, use explain-field.`,
  inputDescription: `\`apiVersion\` (string): the kind's API version, such as \`v1\` or \`apps/v1\`; it has to exist in both Kubernetes versions. \`kind\` (string): the kind, such as \`Pod\`. \`fromVersion\` and \`toVersion\` (strings): the Kubernetes versions to compare, such as \`1.31\` and \`1.36\`, each one of ${bundledKubernetesVersions.join(", ")}.`,
  outputDescription: `\`added\` and \`removed\` (arrays of { \`path\`, \`type\` }): the fields \`toVersion\` has that \`fromVersion\` does not, and the other way round. \`typeChanged\` (array of { \`path\`, \`fromType\`, \`toType\` }). \`truncated\` (boolean): whether a list was cut at ${maxListed} entries.`,
  invoke: {
    instantiate: () => () => async ({ apiVersion, kind, fromVersion, toVersion }) => {
      const [from, to] = [normalizeVersion(fromVersion), normalizeVersion(toVersion)];

      for (const version of [from, to]) {
        if (!bundledKubernetesVersions.includes(version)) {
          throw new Error(`Kubernetes ${version} is not bundled; choose from ${bundledKubernetesVersions.join(", ")}.`);
        }
      }

      const fromFields = fieldsOf(from, apiVersion, kind);
      const toFields = fieldsOf(to, apiVersion, kind);
      const added = [...toFields.values()].filter(({ path }) => !fromFields.has(path));
      const removed = [...fromFields.values()].filter(({ path }) => !toFields.has(path));
      const typeChanged = [...toFields.values()].flatMap((field) => {
        const before = fromFields.get(field.path);

        return before && before.typeLabel !== field.typeLabel
          ? [{ path: field.path, fromType: before.typeLabel, toType: field.typeLabel }]
          : [];
      });
      const toChange = ({ path, typeLabel }: Field) => ({ path, type: typeLabel });

      return {
        added: added.slice(0, maxListed).map(toChange),
        removed: removed.slice(0, maxListed).map(toChange),
        typeChanged: typeChanged.slice(0, maxListed),
        truncated: Math.max(added.length, removed.length, typeChanged.length) > maxListed,
      };
    },
  },
});

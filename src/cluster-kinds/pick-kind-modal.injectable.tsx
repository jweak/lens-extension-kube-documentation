import { Div, Span } from "@k8slens/element-components";
import { SpinnerIcon } from "@k8slens/icon";
import { PlainButton, type SelectOption, SingleSelect, TextInput } from "@k8slens/input-components";
import { ModalContainer, ModalContent, ModalFooter, ModalHeader } from "@k8slens/modal-components";
import { getModalInjectableBunch, getModalKind, type ModalProps, useRespondFromModal } from "@k8slens/modal-contracts";
import { useSubscribable } from "@k8slens/subscribable-react";
import { useSyncInject } from "@k8slens/use-inject";
import { observer } from "mobx-react";
import { type RefObject, Suspense, use, useRef, useState } from "react";
import type { DocumentationTarget } from "../api-reference/resource-documentation";
import { ErrorBoundary } from "../components/error-boundary";
import { type ServedKind, servedKindsBunch } from "./served-kinds.injectable";

/** Asks which kind of a cluster to document; answers with the kind, or undefined when the user did not choose. */
export const pickKindModalKind = getModalKind<[clusterId: string], DocumentationTarget | undefined>()("pick-kind");

// Enough to scan; the filter is there for the rest.
const maxListed = 40;

const toTarget = ({ apiVersion, kind }: ServedKind): DocumentationTarget => ({ apiVersion, kind });

/** The kinds matching the filter, by kind, plural name, short name or API version: those whose kind starts with it first. */
export const filterServedKinds = (kinds: readonly ServedKind[], filter: string): ServedKind[] => {
  const query = filter.trim().toLowerCase();
  const matches = (kind: ServedKind) =>
    query === "" || [kind.kind, kind.plural, ...kind.shortNames, kind.apiVersion].some((name) => name.toLowerCase().includes(query));
  const rank = (kind: ServedKind) => (query !== "" && kind.kind.toLowerCase().startsWith(query) ? 0 : 1);

  return kinds
    .filter(matches)
    .sort((a, b) => rank(a) - rank(b) || a.kind.localeCompare(b.kind) || a.apiVersion.localeCompare(b.apiVersion));
};

interface KindListProps {
  readonly clusterId: string;
  readonly filter: string;
  /** The first kind the filter matches, for Enter in the filter to pick. */
  readonly firstMatch: RefObject<DocumentationTarget | undefined>;
  readonly onPick: (target: DocumentationTarget) => void;
}

// Suspends until the cluster has listed what it serves, reading nothing of MobX before that.
const KindList = observer(({ clusterId, filter, firstMatch, onPick }: KindListProps) => {
  const servedKinds = useSyncInject(servedKindsBunch.subscribable, clusterId);
  const { value } = useSubscribable(servedKinds);
  const kinds = use(value).get();
  const matches = filterServedKinds(kinds, filter);
  const toId = ({ apiVersion, kind }: ServedKind) => `${apiVersion}|${kind}`;
  const byId = new Map(matches.map((kind) => [toId(kind), kind]));
  const options: SelectOption<string>[] = matches.slice(0, maxListed).map((kind) => ({ id: toId(kind), label: `${kind.kind} (${kind.apiVersion})` }));

  firstMatch.current = matches[0] && toTarget(matches[0]);

  if (matches.length === 0) {
    return <Span $color="textMuted">No kind this cluster serves matches “{filter.trim()}”.</Span>;
  }

  return (
    <Div $flex={{ direction: "vertical", gap: "s" }}>
      <SingleSelect
        options={options}
        selected={undefined}
        onSelect={(id) => {
          const kind = byId.get(id);

          if (kind) {
            onPick(toTarget(kind));
          }
        }}
      />
      {matches.length > maxListed && (
        <Span $color="textMuted" $font={{ size: "s" }}>
          {matches.length - maxListed} more not listed. Type more of the name to narrow them down.
        </Span>
      )}
    </Div>
  );
});

const CouldNotListKinds = ({ error }: { readonly error: Error }) => (
  <Div $flex={{ direction: "vertical", gap: "xs" }}>
    <Span $font={{ bold: true }} $color="textHighlight">
      Could not list the kinds the cluster serves
    </Span>
    <Span>{error.message}</Span>
  </Div>
);

const PickKindModal = ({ input: [clusterId] }: ModalProps<typeof pickKindModalKind>) => {
  const respond = useRespondFromModal(pickKindModalKind);
  const [filter, setFilter] = useState("");
  const firstMatch = useRef<DocumentationTarget | undefined>(undefined);

  return (
    <ModalContainer $style={{ width: "calc(var(--unit) * 70)" }}>
      <ModalHeader onClose={() => respond(undefined)}>Browse the documentation of a kind</ModalHeader>

      <ModalContent>
        <Div $flex={{ direction: "vertical", gap: "m" }}>
          <TextInput
            type="search"
            autoFocus
            placeholder="Filter the kinds this cluster serves…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && firstMatch.current) {
                respond(firstMatch.current);
              }
            }}
          />

          <Div $overflow={{ y: "auto" }} $style={{ maxHeight: "50vh" }}>
            <ErrorBoundary fallback={(error) => <CouldNotListKinds error={error} />}>
              <Suspense
                fallback={
                  <Div $flex={{ gap: "s", verticalAlign: "center" }}>
                    <SpinnerIcon $size="m" /> Asking the cluster which kinds it serves…
                  </Div>
                }
              >
                <KindList clusterId={clusterId} filter={filter} firstMatch={firstMatch} onPick={respond} />
              </Suspense>
            </ErrorBoundary>
          </Div>
        </Div>
      </ModalContent>

      <ModalFooter>
        <PlainButton $onClick={() => respond(undefined)}>Cancel</PlainButton>
      </ModalFooter>
    </ModalContainer>
  );
};

export const pickKindModalBunch = getModalInjectableBunch({
  kind: pickKindModalKind,
  Component: PickKindModal,
  onClose: () => undefined,
});

import { Div, Span } from "@k8slens/element-components";
import { observer } from "mobx-react";
import { searchFields } from "../api-reference/fields";
import type { ResourceDocumentation } from "../api-reference/resource-documentation";
import type { DocumentationViewState } from "../documentation-tab/documentation-view-state.injectable";
import { FieldFacts, FieldSignature } from "./field-tree";
import { TextLink } from "./links";
import { RichText } from "./rich-text";

const maxShownResults = 200;

// The path with the part that matched the filter picked out.
const HighlightedPath = ({ path, query }: { readonly path: string; readonly query: string }) => {
  const index = path.toLowerCase().indexOf(query.trim().toLowerCase());

  if (index < 0) {
    return <>{path}</>;
  }

  const end = index + query.trim().length;

  return (
    <>
      {path.slice(0, index)}
      <Span $backgroundColor="warningTint">{path.slice(index, end)}</Span>
      {path.slice(end)}
    </>
  );
};

interface SearchResultsProps {
  readonly documentation: ResourceDocumentation;
  readonly state: DocumentationViewState;
}

/** The fields matching the filter, each by its whole path, since out of the tree the path is its context. */
export const SearchResults = observer(({ documentation, state }: SearchResultsProps) => {
  const query = state.getFilter();
  const results = searchFields(documentation.resolve, documentation.schema, query);

  if (results.length === 0) {
    return <Span $color="textMuted">No field&apos;s name or description matches “{query.trim()}”.</Span>;
  }

  return (
    <Div $flex={{ direction: "vertical", gap: "l" }}>
      <Span $color="textMuted" $font={{ size: "s" }}>
        {results.length === 1 ? "1 matching field" : `${results.length} matching fields`}
      </Span>

      {results.slice(0, maxShownResults).map((field) => (
        <Div key={field.path} $flex={{ direction: "vertical", gap: "xxs" }}>
          <Div $flex={{ gap: "m", verticalAlign: "center", wrap: true }}>
            <FieldSignature field={field} name={<HighlightedPath path={field.path} query={query} />} />
            <TextLink $font={{ size: "s" }} $onClick={() => state.showInTree(field.path)}>
              Show in tree
            </TextLink>
          </Div>
          {field.description && <RichText text={field.description} $color="textDefault" />}
          <FieldFacts field={field} />
        </Div>
      ))}

      {results.length > maxShownResults && (
        <Span $color="textMuted">
          {results.length - maxShownResults} more not shown. Type more of the name to narrow them down.
        </Span>
      )}
    </Div>
  );
});

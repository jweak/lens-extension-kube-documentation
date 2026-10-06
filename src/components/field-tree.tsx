import { Badge } from "@k8slens/badge";
import { ClickableDiv, Code, Div, Span } from "@k8slens/element-components";
import { KeyboardArrowDownIcon, KeyboardArrowRightIcon } from "@k8slens/icon";
import { observer } from "mobx-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { SchemaResolver } from "../api-reference/api-reference-data";
import { type Field, type FieldContainer, getFields } from "../api-reference/fields";
import type { DocumentationViewState } from "../documentation-tab/documentation-view-state.injectable";
import { RichText } from "./rich-text";

const formatValue = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

const hasFacts = (field: Field) => !!field.enum?.length || field.default !== undefined || !!field.constraints?.length;

/** The facts of a field beyond its description: allowed values, default and validation. */
export const FieldFacts = ({ field }: { readonly field: Field }) => {
  if (!hasFacts(field)) {
    return null;
  }

  return (
    <Div $flex={{ direction: "vertical", gap: "xxs" }} $font={{ size: "s", forceWrap: true }} $color="textDefault">
      {!!field.enum?.length && (
        <Div>
          One of:{" "}
          {field.enum.map((value, index) => (
            <Span key={index}>
              {index > 0 && ", "}
              <Code $color="code">{formatValue(value)}</Code>
            </Span>
          ))}
        </Div>
      )}
      {field.default !== undefined && (
        <Div>
          Default: <Code $color="code">{formatValue(field.default)}</Code>
        </Div>
      )}
      {field.constraints?.map((constraint) => (
        <Div key={constraint}>{constraint}</Div>
      ))}
    </Div>
  );
};

/** The first line of a field: its name, its type and whether it is required. */
export const FieldSignature = ({ field, name }: { readonly field: Field; readonly name?: ReactNode }) => (
  <Div $flex={{ gap: "s", verticalAlign: "center", wrap: true }}>
    <Code $font={{ bold: true }} $color="textHighlight">
      {name ?? field.name}
    </Code>
    <Code $color="code">{field.typeLabel}</Code>
    {field.required && <Badge small label="required" $backgroundColor="warningTint" />}
  </Div>
);

interface FieldRowProps {
  readonly field: Field;
  readonly resolve: SchemaResolver;
  readonly state: DocumentationViewState;
}

const FieldRow = observer(({ field, resolve, state }: FieldRowProps) => {
  const expanded = !!field.children && state.isExpanded(field.path);
  const highlighted = state.isHighlighted(field.path);
  const ref = useRef<HTMLDivElement>(null);
  const Chevron = expanded ? KeyboardArrowDownIcon : KeyboardArrowRightIcon;

  // A field shown from the search results is scrolled to, once, when its row appears.
  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView({ block: "center" });
    }
  }, [highlighted]);

  const signature = (
    <>
      {field.children ? <Chevron $size="m" $color="textDefault" $flexChild="fixed" /> : <Div $size="m" $flexChild="fixed" />}
      <FieldSignature field={field} />
    </>
  );
  const signatureProps = {
    $flex: { gap: "xs", verticalAlign: "center" },
    $backgroundColor: highlighted ? "warningTint" : undefined,
    $border: highlighted ? { radius: "s" as const } : undefined,
  } as const;

  return (
    <Div $flex={{ direction: "vertical", gap: "xxs" }} $ref={ref}>
      {field.children ? (
        <ClickableDiv {...signatureProps} $onClick={() => state.toggle(field.path)}>
          {signature}
        </ClickableDiv>
      ) : (
        <Div {...signatureProps}>{signature}</Div>
      )}

      {/* Under the name, past the chevron. */}
      {(field.description || hasFacts(field) || expanded) && (
        <Div $flex={{ gap: "xs" }}>
          <Div $size="m" $flexChild="fixed" />
          <Div $flexChild="shrinkable" $flex={{ direction: "vertical", gap: "xxs" }}>
            {field.description && <RichText text={field.description} $color="textDefault" />}
            <FieldFacts field={field} />
            {expanded && field.children && <FieldList container={field.children} resolve={resolve} state={state} nested />}
          </Div>
        </Div>
      )}
    </Div>
  );
});

interface FieldListProps {
  readonly container: FieldContainer;
  /** Finds the definitions the fields refer to, in the Kubernetes version they are documented as. */
  readonly resolve: SchemaResolver;
  readonly state: DocumentationViewState;
  readonly nested?: boolean;
}

export const FieldList = ({ container, resolve, state, nested }: FieldListProps) => (
  <Div
    $flex={{ direction: "vertical", gap: "m" }}
    $padding={nested ? { left: "s", vertical: "xs" } : undefined}
    $border={nested ? { left: { width: "xxs", color: "grey40" } } : undefined}
  >
    {getFields(resolve, container).map((field) => (
      <FieldRow key={field.name} field={field} resolve={resolve} state={state} />
    ))}
  </Div>
);

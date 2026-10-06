import { Code, Div, type DivProps } from "@k8slens/element-components";
import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "./links";

// Kubernetes descriptions are plain text with the odd `code` span and bare "More info: https://..." links.
const tokenPattern = /(https?:\/\/[^\s<>"'`]+)|`([^`\n]+)`/g;
const trailingPunctuation = /[.,;:!?)\]]+$/;

const renderLine = (line: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let position = 0;

  for (const match of line.matchAll(tokenPattern)) {
    const [whole, rawUrl, code] = match;
    const index = match.index ?? 0;

    nodes.push(line.slice(position, index));

    if (rawUrl) {
      const url = rawUrl.replace(trailingPunctuation, "");

      nodes.push(<ExternalLink key={index} url={url} />);
      nodes.push(rawUrl.slice(url.length));
    } else {
      nodes.push(
        <Code key={index} $color="code">
          {code}
        </Code>,
      );
    }

    position = index + whole.length;
  }

  nodes.push(line.slice(position));

  return nodes;
};

interface RichTextProps extends DivProps {
  readonly text: string;
}

/** A Kubernetes description: its paragraphs and line breaks kept, its links followable and its code marked. */
export const RichText = ({ text, ...rest }: RichTextProps) => (
  <Div $flex={{ direction: "vertical", gap: "xs" }} $font={{ forceWrap: true }} {...rest}>
    {text
      .trim()
      .split(/\n\s*\n/)
      .map((paragraph, paragraphIndex) => (
        <Div key={paragraphIndex}>
          {paragraph.split("\n").map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 && <br />}
              {renderLine(line)}
            </Fragment>
          ))}
        </Div>
      ))}
  </Div>
);

import { ClickableDiv, type ClickableDivProps } from "@k8slens/element-components";
import { useInject } from "@k8slens/use-inject";
import { openExternalLinkInjectable } from "../open-external-link.injectable";

/** Text that does something when clicked, looking like a link. Runs inline with the text around it, unless laid out with `$flex`. */
export const TextLink = ({ $style, ...rest }: ClickableDivProps) => (
  <ClickableDiv $color="link" $style={rest.$flex ? $style : { display: "inline", ...$style }} {...rest} />
);

interface ExternalLinkProps extends ClickableDivProps {
  readonly url: string;
}

// Not an anchor with an href: a followed href would take the Lens window itself to the page.
export const ExternalLink = ({ url, children, ...rest }: ExternalLinkProps) => {
  const openExternalLink = useInject(openExternalLinkInjectable)();

  return (
    <TextLink $onClick={() => openExternalLink(url)} $tooltip={url} {...rest}>
      {children ?? url}
    </TextLink>
  );
};

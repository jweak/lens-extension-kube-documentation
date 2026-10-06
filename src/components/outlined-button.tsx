import { Button, type ButtonProps } from "@k8slens/element-components";

/**
 * A button framed by a thin border, the way Lens draws the choices beside a filter input: text only,
 * the input's border, and a tighter corner. Set in a row stretched to the input's height.
 */
export const OutlinedButton = ({ type = "button", ...rest }: ButtonProps) => (
  <Button
    type={type}
    $backgroundColor="transparent"
    $color={{ normal: "textDefault", hover: "textHighlight" }}
    $border={{ width: "xxs", radius: "s", color: { normal: "grey30", hover: "grey20" } }}
    $outline={{ focusVisible: { color: "primary", width: "xxs" } }}
    $padding={{ vertical: "zero", horizontal: "s" }}
    $font={{ size: "s", lineHeight: "tight", noWrap: true }}
    {...rest}
  />
);

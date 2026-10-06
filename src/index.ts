import { getFeature, registerInjectablesFromModules } from "@k8slens/feature-core";
import modulesWithInjectables from "./**/*.injectable.(ts|tsx)";
import stylesheets from "./**/!(_*).(scss|css)";
import { documentationSectionBunches } from "./details-panel/documentation-sections";

export const k8SlensKubeDocumentationFeature = getFeature({
  // Lens keys persisted state by this id and allows only lowercase letters, digits, dots, dashes and
  // underscores in it, so it cannot be the scoped package name.
  id: "kube-documentation",
  register: (di) => {
    // Auto-discovers every `*.injectable.(ts|tsx)` file under this directory and registers
    // it. Preferred over registering injectables one by one — adding a new injectable file
    // automatically wires it up; you can't forget to register it.
    // Every `.scss`, `.css`, `.module.scss` and `.module.css` you import becomes a stylesheet
    // injectable when the extension builds, and rides along here the same way; a `_partial.scss`
    // stays out of the glob.
    //
    // The details panel sections are generated, one per built-in kind and API version, so they
    // come as an array: its values are bunches, which is all registration looks at in a module.
    registerInjectablesFromModules(di, [...modulesWithInjectables, ...stylesheets, documentationSectionBunches]);
  },
});

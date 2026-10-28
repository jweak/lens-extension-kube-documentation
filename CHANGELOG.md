# Changelog

What changed in each version of this extension, newest first.

## 0.2.0

- **Open in a window**, in the documentation tab's header and in its right-click menu, shows the documentation in a window of its own, beside Lens. Lens's window layouts open the window again.
- A **Documentation** row in the right-click menu of the navigator's pages that list a kind, Pods or a custom resource's, and of links to lists of resources.
- **Documentation: Browse a kind** in the command palette lists every kind the cluster in front serves, filtered as you type, and opens the one picked.
- Opening documentation connects the cluster first when it is not connected, and going back in Lens returns from it.
- The extension asks the cluster which Kubernetes version it runs again whenever Lens connects to it, so a cluster asked while it was still connecting, or upgraded since, is documented as it runs now; the version menu also offers to ask again when the cluster could not tell.
- When the chosen Kubernetes version lacks a kind, the message says whether the cluster serves it all the same, so you know the version shown is not the cluster's.
- The API schemas a cluster serves are let go of a while after the last documentation tab showing them closes, instead of being kept for the session.
- Built against the versions of Lens's packages the current Lens serves.

## 0.1.0

- A **Documentation** item in the menu of every resource opens a tab in the dock for browsing all of the kind's fields, with each field's type, whether it is required, and its description.
- Custom resources are documented from their CustomResourceDefinition's schema, including allowed values, defaults and validation rules.
- A filter searches all fields by name or description, and jumps to a result in the tree.
- A **Documentation** section in the details panel of every built-in resource says what the kind is for.
- Links to the kind's API reference and concept pages on kubernetes.io.
- Ask AI conversations can explain kinds and fields, search fields, compare a kind between Kubernetes versions, and open the documentation in Lens.
- The filter finds fields by words run together, so `grace period` finds `terminationGracePeriodSeconds`, and lists the shallowest matches first.
- Built-in kinds are documented from the API reference of Kubernetes 1.29 to 1.36, bundled with the extension so it works offline.
- A cluster running a Kubernetes version newer or older than the bundled ones is documented from the API schema it serves itself, as are APIs that add-ons serve, such as `metrics.k8s.io`.
- Built-in kinds are documented as of the Kubernetes version the cluster runs, asked of the cluster. A menu in the documentation tab shows another version, and chooses the cluster's version, remembered per cluster, when the cluster cannot be asked.

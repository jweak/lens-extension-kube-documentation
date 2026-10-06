# Changelog

What changed in each version of this extension, newest first.

## 0.1.0

- A **Documentation** item in the menu of every resource opens a tab in the dock for browsing all of the kind's fields, with each field's type, whether it is required, and its description.
- Custom resources are documented from their CustomResourceDefinition's schema, including allowed values, defaults and validation rules.
- A filter searches all fields by name or description, and jumps to a result in the tree.
- A **Documentation** section in the details panel of every built-in resource says what the kind is for.
- Links to the kind's API reference and concept pages on kubernetes.io.
- **Ask AI** in the details panel's Documentation section starts a conversation already briefed with the kind's documentation.
- Ask AI conversations can explain kinds and fields, search fields, compare a kind between Kubernetes versions, and open the documentation in Lens.
- The filter finds fields by words run together, so `grace period` finds `terminationGracePeriodSeconds`, and lists the shallowest matches first.
- Built-in kinds are documented from the API reference of Kubernetes 1.29 to 1.36, bundled with the extension so it works offline.
- Built-in kinds are documented as of the Kubernetes version the cluster runs, asked of the cluster. A menu in the documentation tab shows another version, and chooses the cluster's version, remembered per cluster, when the cluster cannot be asked.

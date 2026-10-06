import type { SchemaNode, SchemaResolver } from "./api-reference-data";

/** One field of a resource, where the view shows it. */
export interface Field {
  readonly name: string;
  /** Where the field is in the resource, e.g. `spec.containers[].image`. */
  readonly path: string;
  readonly typeLabel: string;
  readonly required: boolean;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly constraints?: readonly string[];
  /** Where the field's own fields are, looking through arrays and maps; absent for a field without any. */
  readonly children?: FieldContainer;
}

export interface FieldContainer {
  readonly schema: SchemaNode;
  /** The path the contained fields extend: the field's own, with `[]` for an array and `.*` for a map. */
  readonly path: string;
  /** Definitions on the way here from the resource, so a schema that contains itself is walked only as far as asked. */
  readonly refChain: readonly string[];
  /** Whether a definition on the way repeats one further up, as JSONSchemaProps does inside itself. */
  readonly recursive: boolean;
}

const shortName = (definition: string) => definition.slice(definition.lastIndexOf(".") + 1);

const hasProperties = (node: SchemaNode) => !!node.properties && Object.keys(node.properties).length > 0;

// Kubernetes versions share the definitions they have in common, whose references then lead to
// different definitions, so what is derived from a schema is cached per resolver.
const cachePerResolver = <T>() => {
  const caches = new WeakMap<SchemaResolver, WeakMap<SchemaNode, T>>();

  return (resolve: SchemaResolver) => {
    const existing = caches.get(resolve);

    if (existing) {
      return existing;
    }

    const cache = new WeakMap<SchemaNode, T>();

    caches.set(resolve, cache);

    return cache;
  };
};

/** The type of a field in the notation of `kubectl explain`: `string`, `[]Container`, `map[string]string`, `ObjectMeta`. */
export const getTypeLabel = (node: SchemaNode): string => {
  if (node.ref) return shortName(node.ref);
  if (node.intOrString) return "IntOrString";
  if (node.type === "array") return `[]${node.items ? getTypeLabel(node.items) : "Object"}`;
  if (typeof node.additionalProperties === "object" && !hasProperties(node)) {
    return `map[string]${getTypeLabel(node.additionalProperties)}`;
  }
  if (!node.type || node.type === "object") return "Object";

  return node.format && node.format !== node.type ? `${node.type} (${node.format})` : node.type;
};

/** Finds the schema holding a node's fields, following definitions, array items and map values. */
export const findContainer = (
  resolve: SchemaResolver,
  node: SchemaNode,
  path: string,
  refChain: readonly string[],
): FieldContainer | undefined => {
  let current = node;
  let currentPath = path;
  let chain = refChain;
  let recursive = false;

  // Bounded, as a definition could in principle be an array of itself.
  for (let step = 0; step < 16; step++) {
    if (current.ref) {
      const definition = resolve(current.ref);

      if (!definition) return undefined;

      recursive ||= chain.includes(current.ref);
      chain = [...chain, current.ref];
      current = definition;
    } else if (hasProperties(current)) {
      return { schema: current, path: currentPath, refChain: chain, recursive };
    } else if (current.type === "array" && current.items) {
      current = current.items;
      currentPath = `${currentPath}[]`;
    } else if (typeof current.additionalProperties === "object") {
      current = current.additionalProperties;
      currentPath = `${currentPath}.*`;
    } else {
      return undefined;
    }
  }

  return undefined;
};

const fieldsCache = cachePerResolver<Map<string, readonly Field[]>>();

/** The fields a container holds, in the order the schema lists them. */
export const getFields = (resolve: SchemaResolver, container: FieldContainer): readonly Field[] => {
  const cache = fieldsCache(resolve);
  const byPath = cache.get(container.schema) ?? new Map<string, readonly Field[]>();
  const cacheKey = `${container.path}|${container.refChain.join(",")}`;
  const cached = byPath.get(cacheKey);

  if (cached) {
    return cached;
  }

  const required = new Set(container.schema.required ?? []);
  const fields = Object.entries(container.schema.properties ?? {}).map(([name, property]): Field => {
    const path = container.path ? `${container.path}.${name}` : name;
    const definition = property.ref ? resolve(property.ref) : undefined;

    return {
      name,
      path,
      typeLabel: getTypeLabel(property),
      required: required.has(name),
      description: property.description ?? definition?.description,
      enum: property.enum ?? definition?.enum,
      default: property.default ?? definition?.default,
      constraints: property.constraints,
      children: findContainer(resolve, property, path, container.refChain),
    };
  });

  byPath.set(cacheKey, fields);
  cache.set(container.schema, byPath);

  return fields;
};

export const getRootContainer = (resolve: SchemaResolver, schema: SchemaNode) => findContainer(resolve, schema, "", []);

const maxIndexDepth = 16;
const allFieldsCache = cachePerResolver<readonly Field[]>();

/** Every field of a resource, depth first, stopping where a schema would repeat itself. */
export const getAllFields = (resolve: SchemaResolver, schema: SchemaNode): readonly Field[] => {
  const cache = allFieldsCache(resolve);
  const cached = cache.get(schema);

  if (cached) {
    return cached;
  }

  const all: Field[] = [];
  const visit = (container: FieldContainer, depth: number) => {
    for (const field of getFields(resolve, container)) {
      all.push(field);

      if (field.children && !field.children.recursive && depth < maxIndexDepth) {
        visit(field.children, depth + 1);
      }
    }
  };
  const root = getRootContainer(resolve, schema);

  if (root) {
    visit(root, 0);
  }

  cache.set(schema, all);

  return all;
};

const depthOf = (field: Field) => field.path.split(".").length;

/**
 * The fields whose path or description mentions the query: those whose path does first, the
 * shallowest of them first. A path matches words run together, so `grace period` finds
 * `terminationGracePeriodSeconds`.
 */
export const searchFields = (resolve: SchemaResolver, schema: SchemaNode, query: string): readonly Field[] => {
  const needle = query.trim().toLowerCase();
  const runTogether = needle.replace(/[\s_-]+/g, "");

  if (!needle) {
    return [];
  }

  const pathMatches = (field: Field) => {
    const path = field.path.toLowerCase();

    return path.includes(needle) || path.includes(runTogether);
  };
  const all = getAllFields(resolve, schema);
  // A stable sort, so fields of the same depth keep the schema's order.
  const byPath = all.filter(pathMatches).sort((a, b) => depthOf(a) - depthOf(b));
  const byDescription = all.filter((field) => !pathMatches(field) && field.description?.toLowerCase().includes(needle));

  return [...byPath, ...byDescription];
};

/** Every path down to the given depth that has fields of its own, for expanding a tree at once. */
export const getExpandablePaths = (resolve: SchemaResolver, schema: SchemaNode, maxDepth: number): string[] =>
  getAllFields(resolve, schema)
    .filter((field) => field.children && !field.children.recursive && field.path.split(".").length <= maxDepth)
    .map((field) => field.path);

/** The first paragraph of a description, for where there is only room for a summary. */
export const getSummary = (description: string | undefined) => description?.split(/\n\s*\n/)[0]?.trim();

/**
 * Finds a field by its path, written the way `kubectl explain` takes it or the way this extension
 * shows it: `spec.containers.image`, `spec.containers[].image`, or with the kind in front,
 * `deployment.spec.replicas`.
 */
export const findField = (resolve: SchemaResolver, schema: SchemaNode, kind: string, path: string): Field | undefined => {
  const segments = path
    .split(".")
    .map((segment) => segment.replace(/(\[\])+$/, ""))
    .filter((segment) => segment !== "" && segment !== "*");

  if (segments[0]?.toLowerCase() === kind.toLowerCase()) {
    segments.shift();
  }

  let container = getRootContainer(resolve, schema);
  let field: Field | undefined;

  for (const segment of segments) {
    field = container && getFields(resolve, container).find(({ name }) => name === segment);

    if (!field) {
      return undefined;
    }

    container = field.children;
  }

  return field;
};

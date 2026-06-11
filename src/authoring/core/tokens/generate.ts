import { COLLECTION_NAMES, COLLECTION_ORDER, FIGMA_LIMITS } from "../../shared/constants.js";
import type { CollectionSpec, StyleflowConfig } from "../../shared/types.js";
import { generateColorCollections } from "../colors/colorTokens.js";
import { generateDimensionCollections } from "../layout/dimensions.js";
import { generateInteractiveContextCollections, generateOnSurfacePayloadCollections } from "../semantic/onSurface.js";
import { generateColorModeCollections, generateSemanticColorCollection } from "../semantic/semanticColors.js";
import { appendTypographyToBreakpoints, generateTypographyCollection } from "../typography/typeScale.js";
import { applyVariableScopes } from "./scopes.js";

export interface CollectionGenerationOptions {
  semanticMergeThreshold?: number;
}

export function generateStyleflowCollections(config: StyleflowConfig, options: CollectionGenerationOptions = {}): CollectionSpec[] {
  const dimensionCollections = generateDimensionCollections(config);
  const breakpointCollection = mustFindCollection(dimensionCollections, COLLECTION_NAMES.breakpoints);
  appendTypographyToBreakpoints(breakpointCollection, config);

  const colorResult = generateColorCollections(config);
  const semantic = generateSemanticColorCollection(config, colorResult.ramps);
  const mergedPayload = generateOnSurfacePayloadCollections(config, {
    staticCollectionName: COLLECTION_NAMES.semanticColor,
    staticModes: config.themes,
    interactiveCollectionName: COLLECTION_NAMES.semanticColor
  });
  const semanticMergeThreshold = options.semanticMergeThreshold ?? FIGMA_LIMITS.maxVariablesPerCollection - 1;
  const mergeOnSurface = [semantic, ...mergedPayload].reduce((total, collection) => total + collection.variables.length, 0) <= semanticMergeThreshold;
  const semanticCollections = mergeOnSurface
    ? [semantic, ...mergedPayload]
    : [semantic, ...generateOnSurfacePayloadCollections(config, {
      staticCollectionName: COLLECTION_NAMES.onSurfaceStatic,
      staticModes: ["Base"],
      interactiveCollectionName: COLLECTION_NAMES.onSurfaceInteractive
    })];
  const interactiveOwner = mergeOnSurface ? COLLECTION_NAMES.semanticColor : COLLECTION_NAMES.onSurfaceInteractive;
  const typography = generateTypographyCollection(config);
  const generated = colorResult.collections
    .concat(semanticCollections)
    .concat(generateInteractiveContextCollections(config, interactiveOwner))
    .concat(dimensionCollections)
    .concat([typography])
    .concat(generateColorModeCollections(config, mergeOnSurface ? COLLECTION_NAMES.semanticColor : COLLECTION_NAMES.onSurfaceStatic));

  return orderCollections(mergeCollections(generated).filter((collection) => collection.variables.length > 0).map(applyVariableScopes));
}

function mergeCollections(collections: CollectionSpec[]): CollectionSpec[] {
  const byName = new Map<string, CollectionSpec>();
  for (const collection of collections) {
    const existing = byName.get(collection.name);
    if (!existing) {
      byName.set(collection.name, Object.assign({}, collection, { modes: collection.modes.slice(), variables: collection.variables.slice() }));
      continue;
    }
    existing.modes = Array.from(new Set(existing.modes.concat(collection.modes)));
    existing.variables.push.apply(existing.variables, collection.variables);
  }
  return Array.from(byName.values());
}

function orderCollections(collections: CollectionSpec[]): CollectionSpec[] {
  const order: string[] = COLLECTION_ORDER.slice();
  return collections.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

function mustFindCollection(collections: CollectionSpec[], name: string): CollectionSpec {
  const collection = collections.find((item) => item.name === name);
  if (!collection) {
    throw new Error(`Missing generated collection: ${name}`);
  }
  return collection;
}

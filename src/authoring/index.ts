import { validateTokenContract } from "../compiler/validate.js";
import { STYLEFLOW_TOKENS_VERSION, type StyleflowTokenVariable, type StyleflowTokensFile } from "../format/index.js";
import { createDefaultConfig } from "./config/defaults.js";
import { normalizeConfig, parseConfigJson, stringifyConfig } from "./config/schema.js";
import { generateStyleflowCollections } from "./core/tokens/generate.js";
import { validateConfig } from "./validation/configValidation.js";
import { validateCollections } from "./validation/tokenValidation.js";
import type { CollectionSpec, PortableVariableToken, StyleflowConfig, ValidationIssue } from "./shared/types.js";

export {
  createDefaultConfig,
  normalizeConfig,
  parseConfigJson,
  stringifyConfig
};
export { generateStyleflowCollections } from "./core/tokens/generate.js";
export { generateColorRamp, generateAlphaScale, closestScaleStop, getLightnessForStop } from "./core/colors/ramp.js";
export { hexToRgba, rgbaToHex, hexToRgb, rgbToHex, hexToOklch } from "./core/colors/convert.js";
export { contrastRatio } from "./core/colors/contrast.js";
export { enabledColorTones, enabledLayoutRoles, automaticAccentTone } from "./config/selectors.js";
export { validateConfig } from "./validation/configValidation.js";
export { validateCollections } from "./validation/tokenValidation.js";
export { createSyncPlan, enforceCollectionLimits } from "./core/tokens/plan.js";
export { canInheritLayoutProperty, resolveLayoutValue, isInheritedLayoutRef, previousBreakpointOf } from "./core/layout/inheritance.js";
export { dimensionScaleEntryForName, dimensionScaleOptions, ensureDimensionScaleEntry } from "./core/layout/scaleCatalog.js";
export { generateTypographyTextStyles, fontWeight } from "./core/typography/textStyles.js";
export * from "./shared/constants.js";
export type * from "./shared/types.js";

export {
  addTypographyFont,
  fontSlotDependencies,
  setLayoutRoleEnabled,
  setTypographyBreakpointInheritance,
  setThemeEnabled,
  setToneEnabled,
  toneDisableDependencies,
  updateProject,
  updateTone,
  updateToneAlpha,
  updateTypographyBreakpointRef,
  updateTypographyFont,
  updateTypographyRole,
  isTypographyBreakpointInherited
} from "./ui/state/configEditing.js";
export {
  brandAlphaOptions,
  brandStopOptions,
  brandToneOptions,
  cloneSemanticSurfacesFromTone,
  defaultSemanticSurfaceRef,
  getSemanticSurfaceRef,
  semanticPreviewContrast,
  semanticRefToHex,
  setSemanticSurfaceRef
} from "./ui/state/semanticSurfaceEditing.js";
export {
  cloneOnSurfaceStaticFromTone,
  getOnSurfaceStaticRef,
  setOnSurfaceStaticRef
} from "./ui/state/onSurfaceStaticEditing.js";
export {
  getGlobalPriorityRef,
  getInteractivePaletteRef,
  getInteractivePriorityRef,
  getPriorityMapping,
  interactiveBrandRefToCss,
  setGlobalPriorityRef,
  setInteractivePaletteRef,
  setInteractivePriorityRef,
  setPriorityMappingMode,
  setUseGlobalMapping
} from "./ui/state/interactiveColorsEditing.js";
export {
  isRoleBreakpointInherited,
  layoutOptionsForProperty,
  layoutValueToSelectValue,
  previousBreakpointLabel,
  resolvedSelectValue,
  selectValueToLayoutValue,
  setLayoutValue,
  setRoleBreakpointInheritance
} from "./ui/state/layoutEditing.js";

export const STYLEFLOW_CONFIG_FILENAME = "styleflow.figma.config.json";
export const STYLEFLOW_TOKENS_FILENAME = "styleflow.tokens.json";

export function parseStyleflowConfig(input: unknown): StyleflowConfig {
  if (!isRecord(input) || typeof input.version !== "string") {
    throw new Error("Invalid styleflow.figma.config.json document.");
  }
  if ("tokens" in input) {
    throw new Error("Legacy styleflow.authoring.json documents are not supported. Import styleflow.figma.config.json instead.");
  }
  if (!isRecord(input.project) || !isRecord(input.colors) || !isRecord(input.dimensions) || !isRecord(input.typography)) {
    throw new Error("Styleflow config is missing required authoring sections.");
  }
  return normalizeConfig(input);
}

export function stringifyStyleflowConfig(config: StyleflowConfig): string {
  return stringifyConfig(config);
}

export function generateTokensFromConfig(
  config: StyleflowConfig,
  exportedAt = new Date().toISOString()
): StyleflowTokensFile {
  return tokenArtifactFromCollections(generateStyleflowCollections(normalizeConfig(config)), exportedAt);
}

export function tokenArtifactFromCollections(
  collections: CollectionSpec[],
  exportedAt = new Date().toISOString()
): StyleflowTokensFile {
  return {
    version: STYLEFLOW_TOKENS_VERSION,
    source: {
      kind: "cloud",
      pluginVersion: normalizeConfig(createDefaultConfig()).version,
      exportedAt
    },
    collections: collections.map((collection) => ({
      name: collection.name,
      modes: collection.modes.slice(),
      variables: collection.variables.map(portableGeneratedVariable)
    }))
  };
}

export function validateStyleflowConfig(config: StyleflowConfig): ValidationIssue[] {
  const normalized = normalizeConfig(config);
  const collections = generateStyleflowCollections(normalized);
  const tokens = tokenArtifactFromCollections(collections, new Date(0).toISOString());
  return validateConfig(normalized)
    .concat(validateCollections(collections))
    .concat(validateTokenContract(tokens, { allowContrastWarnings: true }))
    .concat(validateTokenGraph(tokens));
}

export function createDefaultStyleflowConfig(): StyleflowConfig {
  return createDefaultConfig();
}

function portableGeneratedVariable(variable: { name: string } & PortableVariableToken): StyleflowTokenVariable {
  const result: StyleflowTokenVariable = {
    name: variable.name,
    type: variable.type,
    valuesByMode: variable.valuesByMode
  };
  if (variable.description !== undefined) result.description = variable.description;
  if (variable.scopes !== undefined) result.scopes = variable.scopes;
  if (variable.codeSyntax !== undefined) result.codeSyntax = variable.codeSyntax;
  return result;
}

function validateTokenGraph(tokens: StyleflowTokensFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refs = new Set<string>();
  const edges = new Map<string, string[]>();

  for (const collection of tokens.collections) {
    for (const variable of collection.variables) {
      const key = `${collection.name}/${variable.name}`;
      refs.add(key);
      edges.set(key, []);
    }
  }

  for (const collection of tokens.collections) {
    for (const variable of collection.variables) {
      const key = `${collection.name}/${variable.name}`;
      for (const value of Object.values(variable.valuesByMode)) {
        if (isAlias(value)) {
          const target = `${value.alias.collection}/${value.alias.name}`;
          if (!refs.has(target)) {
            issues.push({ level: "error", path: key, message: `Unresolved alias: ${target}.` });
          } else {
            edges.get(key)?.push(target);
          }
        }
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(key: string, trail: string[]): void {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      issues.push({ level: "error", path: key, message: `Circular alias reference: ${trail.concat(key).join(" -> ")}.` });
      return;
    }
    visiting.add(key);
    for (const target of edges.get(key) ?? []) visit(target, trail.concat(key));
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of edges.keys()) visit(key, []);

  return issues;
}

function isAlias(value: unknown): value is { alias: { collection: string; name: string } } {
  return isRecord(value) && isRecord(value.alias) && typeof value.alias.collection === "string" && typeof value.alias.name === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

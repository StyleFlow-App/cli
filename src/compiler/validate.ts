import {
  BREAKPOINTS,
  COLLECTION_ORDER,
  COLLECTION_NAMES,
  COLOR_INTENSITIES,
  COLOR_TONES,
  LAYOUT_DENSITIES,
  LAYOUT_ROLES,
  LOCAL_COLOR_ROLES,
  LOCAL_LAYOUT_PROPERTIES,
  THEME_MODES
} from "../contracts.js";
import type { StyleflowTokensFile, TokenModeValue } from "../format/index.js";
import { cssModeTokenName, cssTokenName, isAlias, isSupportedNumericValue, TokenModel, tokenKey, type ValidationIssue } from "./model.js";

export interface TokenValidationOptions {
  allowContrastWarnings?: boolean;
}

export function validateTokenContract(tokens: StyleflowTokensFile, options: TokenValidationOptions = {}): ValidationIssue[] {
  const model = new TokenModel(tokens);
  const issues: ValidationIssue[] = [];
  for (const collection of COLLECTION_ORDER.filter((name) =>
    name !== COLLECTION_NAMES.onSurfaceStatic && name !== COLLECTION_NAMES.onSurfaceInteractive)) {
    if (!model.collection(collection)) {
      issues.push(error("collections", `Missing required collection: ${collection}.`));
    }
  }
  requireAtLeastOneSupportedMode(model, COLLECTION_NAMES.semanticColor, THEME_MODES, issues);
  requireModes(model, COLLECTION_NAMES.colorTone, ["main", "neutral"], issues);
  requireModes(model, COLLECTION_NAMES.colorIntensity, COLOR_INTENSITIES, issues);
  requireModes(model, COLLECTION_NAMES.layoutRole, ["none"], issues);
  requireModes(model, COLLECTION_NAMES.layoutRoleDensity, LAYOUT_DENSITIES, issues);
  requireModes(model, COLLECTION_NAMES.breakpoints, BREAKPOINTS, issues);
  rejectUnsupportedModes(model, COLLECTION_NAMES.semanticColor, THEME_MODES, issues);
  rejectUnsupportedModes(model, COLLECTION_NAMES.colorTone, COLOR_TONES, issues);
  rejectUnsupportedModes(model, COLLECTION_NAMES.layoutRole, LAYOUT_ROLES, issues);
  for (const breakpoint of BREAKPOINTS) {
    requireVariable(model, COLLECTION_NAMES.primitives, `dimension/primitive/breakpoint/${breakpoint}`, issues);
  }
  for (const role of LOCAL_COLOR_ROLES) {
    requireVariable(model, COLLECTION_NAMES.colorIntensity, `local/${role}`, issues);
  }
  for (const property of LOCAL_LAYOUT_PROPERTIES) {
    requireVariable(model, COLLECTION_NAMES.layoutRole, property, issues);
  }
  validateAliases(model, issues);
  validateCssValues(model, issues);
  validateCssNames(model, issues);
  validatePrimaryContrast(model, issues, options.allowContrastWarnings === true);
  return issues;
}

function requireModes(model: TokenModel, collectionName: string, modes: readonly string[], issues: ValidationIssue[]): void {
  const collection = model.collection(collectionName);
  if (!collection) {
    return;
  }
  for (const mode of modes) {
    if (!collection.modes.includes(mode)) {
      issues.push(error(`collections.${collectionName}.modes`, `Missing required mode: ${mode}.`));
    }
  }
}

function requireAtLeastOneSupportedMode(model: TokenModel, collectionName: string, modes: readonly string[], issues: ValidationIssue[]): void {
  const collection = model.collection(collectionName);
  if (collection && !collection.modes.some((mode) => modes.includes(mode))) {
    issues.push(error(`collections.${collectionName}.modes`, `At least one supported mode is required: ${modes.join(", ")}.`));
  }
}

function rejectUnsupportedModes(model: TokenModel, collectionName: string, modes: readonly string[], issues: ValidationIssue[]): void {
  const collection = model.collection(collectionName);
  for (const mode of collection?.modes ?? []) {
    if (!modes.includes(mode)) {
      issues.push(error(`collections.${collectionName}.modes`, `Unsupported mode: ${mode}.`));
    }
  }
}

function requireVariable(model: TokenModel, collection: string, name: string, issues: ValidationIssue[]): void {
  if (!model.variable(collection, name)) {
    issues.push(error(`collections.${collection}`, `Missing required token: ${collection}/${name}.`));
  }
}

function validateAliases(model: TokenModel, issues: ValidationIssue[]): void {
  for (const collection of model.source.collections) {
    for (const variable of collection.variables) {
      for (const [mode, value] of Object.entries(variable.valuesByMode)) {
        if (isAlias(value) && !model.variable(value.alias.collection, value.alias.name)) {
          issues.push(error(`${collection.name}/${variable.name}/${mode}`, `Unresolved alias: ${value.alias.collection}/${value.alias.name}.`));
        }
      }
    }
  }
}

function validateCssValues(model: TokenModel, issues: ValidationIssue[]): void {
  for (const collection of model.source.collections) {
    for (const variable of collection.variables) {
      for (const [mode, value] of Object.entries(variable.valuesByMode)) {
        if (variable.type === "FLOAT" && typeof value === "number" && !isSupportedNumericValue(collection.name, variable.name)) {
          issues.push(error(`${collection.name}/${variable.name}/${mode}`, "Numeric token does not have a supported CSS dimension mapping."));
        }
      }
    }
  }
}

function validateCssNames(model: TokenModel, issues: ValidationIssue[]): void {
  const names = new Map<string, string>();
  for (const collection of model.source.collections) {
    for (const variable of collection.variables) {
      registerCssName(names, cssTokenName(collection.name, variable.name), tokenKey(collection.name, variable.name), issues);
      for (const mode of collection.modes) {
        registerCssName(names, cssModeTokenName(collection.name, variable.name, mode), `${collection.name}/${variable.name}/${mode}`, issues);
      }
    }
  }
}

function registerCssName(names: Map<string, string>, name: string, origin: string, issues: ValidationIssue[]): void {
  const previous = names.get(name);
  if (previous && previous !== origin) {
    issues.push(error(origin, `CSS custom property collision with ${previous}: ${name}.`));
  } else {
    names.set(name, origin);
  }
}

function validatePrimaryContrast(model: TokenModel, issues: ValidationIssue[], allowWarnings: boolean): void {
  const themes = supportedModes(model, COLLECTION_NAMES.semanticColor, THEME_MODES);
  const tones = supportedModes(model, COLLECTION_NAMES.colorTone, COLOR_TONES);
  for (const theme of themes) {
    for (const tone of tones) {
      for (const intensity of COLOR_INTENSITIES) {
        const surface = model.resolveColor(COLLECTION_NAMES.semanticColor, `${tone}/${intensity}/local/surface`, theme);
        const foreground = model.resolveColor(COLLECTION_NAMES.semanticColor, `${tone}/${intensity}/local/foreground-primary`, theme);
        if (surface && foreground && contrastRatio(surface, foreground) < 4.5) {
          const path = `SemanticColor/${tone}/${intensity}/${theme}`;
          const message = "Foreground primary contrast is below 4.5:1.";
          issues.push(allowWarnings ? warning(path, message) : error(path, message));
        }
      }
    }
  }
}

function supportedModes<T extends string>(model: TokenModel, collectionName: string, modes: readonly T[]): T[] {
  const collection = model.collection(collectionName);
  return modes.filter((mode) => collection?.modes.includes(mode));
}

function contrastRatio(left: { r: number; g: number; b: number }, right: { r: number; g: number; b: number }): number {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function relativeLuminance(color: { r: number; g: number; b: number }): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function error(path: string, message: string): ValidationIssue {
  return { level: "error", path, message };
}

function warning(path: string, message: string): ValidationIssue {
  return { level: "warning", path, message };
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `${issue.level === "error" ? "x" : "!"} ${issue.path}: ${issue.message}`).join("\n");
}

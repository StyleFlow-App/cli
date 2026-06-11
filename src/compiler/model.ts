import { COLLAPSE_COLLECTIONS, COLLECTION_NAMES, INLINE_COLLECTIONS } from "../contracts.js";
import type {
  AliasValue,
  RgbaValue,
  StyleflowTokenCollection,
  StyleflowTokensFile,
  StyleflowTokenVariable,
  TokenModeValue
} from "../format/index.js";

export interface ValidationIssue {
  level: "error" | "warning";
  path: string;
  message: string;
}

export interface TokenModelOptions {
  /**
   * Collassa le collezioni trasparenti (Primitives inline, OnSurfaceInteractive*
   * passthrough) a tempo di emissione. Default `true` = riduzione attiva.
   * `false` ripristina l'emissione legacy (ogni alias resta `var(--sf-...)`).
   */
  transparent?: boolean;
}

export class TokenModel {
  readonly collections = new Map<string, StyleflowTokenCollection>();
  readonly variables = new Map<string, StyleflowTokenVariable>();
  readonly transparent: boolean;

  constructor(readonly source: StyleflowTokensFile, options: TokenModelOptions = {}) {
    this.transparent = options.transparent !== false;
    for (const collection of source.collections) {
      this.collections.set(collection.name, collection);
      for (const variable of collection.variables) {
        this.variables.set(tokenKey(collection.name, variable.name), variable);
      }
    }
  }

  collection(name: string): StyleflowTokenCollection | undefined {
    return this.collections.get(name);
  }

  variable(collection: string, name: string): StyleflowTokenVariable | undefined {
    return this.variables.get(tokenKey(collection, name));
  }

  resolveColor(collection: string, name: string, mode: string): RgbaValue | undefined {
    const resolved = this.resolveValue(collection, name, mode, []);
    return isRgba(resolved) ? resolved : undefined;
  }

  resolveNumber(collection: string, name: string, mode: string): number | undefined {
    const resolved = this.resolveValue(collection, name, mode, []);
    return typeof resolved === "number" ? resolved : undefined;
  }

  resolveString(collection: string, name: string, mode: string): string | undefined {
    const resolved = this.resolveValue(collection, name, mode, []);
    return typeof resolved === "string" ? resolved : undefined;
  }

  private resolveValue(collectionName: string, name: string, mode: string, seen: string[]): TokenModeValue | undefined {
    const collection = this.collection(collectionName);
    const variable = this.variable(collectionName, name);
    const key = `${collectionName}/${name}/${mode}`;
    if (!collection || !variable || seen.includes(key)) {
      return undefined;
    }
    const targetMode = collection.modes.includes(mode) ? mode : collection.modes.includes("Base") ? "Base" : collection.modes[0];
    const value = variable.valuesByMode[targetMode];
    if (isAlias(value)) {
      return this.resolveValue(value.alias.collection, value.alias.name, mode, seen.concat(key));
    }
    return value;
  }
}

export function tokenKey(collection: string, name: string): string {
  return `${collection}/${name}`;
}

export function cssTokenName(collection: string, name: string): string {
  return `--sf-${[collection, ...name.split("/")].map(cssSlug).join("--")}`;
}

export function cssModeTokenName(collection: string, name: string, mode: string): string {
  return `${cssTokenName(collection, name)}--${cssSlug(mode)}`;
}

export function cssSlug(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function valueToCss(
  collection: StyleflowTokenCollection,
  variable: StyleflowTokenVariable,
  value: TokenModeValue,
  model?: TokenModel,
  mode?: string
): string {
  if (isAlias(value)) {
    if (model?.transparent) {
      return emitAliasValue(model, value.alias.collection, value.alias.name, mode);
    }
    return `var(${cssTokenName(value.alias.collection, value.alias.name)})`;
  }
  if (variable.type === "COLOR") {
    if (!isRgba(value)) {
      throw new Error(`Expected color value for ${collection.name}/${variable.name}.`);
    }
    return rgbaToCss(value);
  }
  if (variable.type === "FLOAT") {
    if (typeof value !== "number" || !isSupportedNumericValue(collection.name, variable.name)) {
      throw new Error(`Unsupported numeric CSS value at ${collection.name}/${variable.name}.`);
    }
    if (isUnitlessNumber(collection.name, variable.name)) {
      return trimNumber(value);
    }
    return `${trimNumber(value)}px`;
  }
  if (variable.type === "STRING") {
    if (typeof value !== "string") {
      throw new Error(`Expected string value for ${collection.name}/${variable.name}.`);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean value for ${collection.name}/${variable.name}.`);
  }
  return String(value);
}

/**
 * Riscrive un riferimento alias nella sua forma di emissione collassata:
 * - target INLINE (Primitives) → valore concreto (`rgb(...)` o dimensione Tailwind);
 * - target COLLAPSE (OnSurfaceInteractive*) → segue la catena 1:1 fino al primo
 *   token reale e ne emette `var(...)`;
 * - altrimenti → `var(--sf-...)` del target.
 */
export function emitAliasValue(model: TokenModel, collectionName: string, name: string, mode?: string): string {
  if (INLINE_COLLECTIONS.has(collectionName)) {
    return inlineConcreteValue(model, collectionName, name, mode);
  }
  if (COLLAPSE_COLLECTIONS.has(collectionName)) {
    const next = nextAliasTarget(model, collectionName, name, mode);
    if (next) {
      return emitAliasValue(model, next.collection, next.name, mode);
    }
    // Foglia concreta dentro una collezione collapse (non previsto): inlinea.
    return inlineConcreteValue(model, collectionName, name, mode);
  }
  return `var(${cssTokenName(collectionName, name)})`;
}

function nextAliasTarget(model: TokenModel, collectionName: string, name: string, mode?: string): { collection: string; name: string } | undefined {
  const collection = model.collection(collectionName);
  const variable = model.variable(collectionName, name);
  if (!collection || !variable) {
    return undefined;
  }
  const targetMode = mode && collection.modes.includes(mode)
    ? mode
    : collection.modes.includes("Base") ? "Base" : collection.modes[0];
  const value = variable.valuesByMode[targetMode];
  return isAlias(value) ? value.alias : undefined;
}

function inlineConcreteValue(model: TokenModel, collectionName: string, name: string, mode?: string): string {
  const variable = model.variable(collectionName, name);
  const resolveMode = mode ?? "Base";
  if (variable?.type === "FLOAT") {
    const px = model.resolveNumber(collectionName, name, resolveMode);
    return px === undefined ? "0" : tailwindDimension(name, px);
  }
  if (variable?.type === "STRING") {
    const text = model.resolveString(collectionName, name, resolveMode);
    return text === undefined ? '""' : JSON.stringify(text);
  }
  // Default: colore (le primitive sono in gran parte ramp colore).
  const rgba = model.resolveColor(collectionName, name, resolveMode);
  return rgba ? rgbaToCss(rgba) : "rgb(0 0 0 / 0)";
}

export function rgbaToCss(value: RgbaValue): string {
  const red = Math.round(value.r * 255);
  const green = Math.round(value.g * 255);
  const blue = Math.round(value.b * 255);
  return `rgb(${red} ${green} ${blue} / ${trimNumber(value.a)})`;
}

/**
 * Mappa una dimensione primitiva (px da Figma) al suo equivalente Tailwind v4:
 * - `.../breakpoint/<bp>` → `var(--breakpoint-<bp>)` (xs/0 → `0`);
 * - `.../stroke/...` e valori ≥ 10000 (es. `scale/full`) → px literal;
 * - 0 → `0`; altrimenti → `calc(var(--spacing) * N)` con `N = px / 4`
 *   (Tailwind v4 usa `--spacing: 0.25rem` come moltiplicatore base).
 */
export function tailwindDimension(name: string, px: number): string {
  const breakpoint = name.match(/\/breakpoint\/([a-z0-9]+)$/);
  if (breakpoint) {
    return px === 0 || breakpoint[1] === "xs" ? "0" : `var(--breakpoint-${breakpoint[1]})`;
  }
  if (px === 0) {
    return "0";
  }
  if (name.includes("/stroke/") || Math.abs(px) >= 10000) {
    return `${trimNumber(px)}px`;
  }
  const units = px / 4;
  if (Math.abs(units * 4 - px) < 1e-6) {
    return `calc(var(--spacing) * ${trimNumber(units)})`;
  }
  return `${trimNumber(px)}px`;
}

export function isSupportedNumericValue(collection: string, name: string): boolean {
  return isSupportedDimension(collection, name) || isUnitlessNumber(collection, name);
}

export function isSupportedDimension(collection: string, name: string): boolean {
  if (collection === COLLECTION_NAMES.primitives) {
    return name.startsWith("dimension/primitive/");
  }
  if (collection === COLLECTION_NAMES.breakpoints) {
    return name.startsWith("layout-role/") || name.startsWith("typography/");
  }
  if (collection === COLLECTION_NAMES.layoutRoleDensity || collection === COLLECTION_NAMES.layoutRole) {
    return true;
  }
  return collection === COLLECTION_NAMES.typography && (name.endsWith("/size") || name.endsWith("/line-height"));
}

export function isUnitlessNumber(collection: string, name: string): boolean {
  return collection === COLLECTION_NAMES.typography && name.endsWith("/weight");
}

export function isAlias(value: TokenModeValue | undefined): value is AliasValue {
  return typeof value === "object" && value !== null && "alias" in value;
}

export function isRgba(value: TokenModeValue | undefined): value is RgbaValue {
  return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value && "a" in value;
}

function trimNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export const COLOR_TONES = [
  "main",
  "accent",
  "contrast",
  "neutral",
  "success",
  "warning",
  "critical",
  "support-1",
  "support-2",
  "support-3"
] as const;

export const COLOR_INTENSITIES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
export const LAYOUT_ROLES = ["chip", "control", "item", "tile", "stack", "panel", "section", "region", "container", "none"] as const;
export const LAYOUT_DENSITIES = ["sm", "md", "lg"] as const;
export const THEME_MODES = ["light", "dark"] as const;
export const SURFACE_TYPES = ["default", "raised", "sunken", "interactive-primary", "interactive-secondary", "interactive-tertiary"] as const;
export const INTERACTION_STATES = ["default", "hover", "active", "focus", "disabled"] as const;
export const BREAKPOINTS = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;

export const LOCAL_COLOR_ROLES = [
  "surface",
  "surface-scrim",
  "border",
  "border-soft",
  "border-strong",
  "border-accent",
  "foreground-primary",
  "foreground-secondary",
  "foreground-tertiary",
  "foreground-muted",
  "foreground-accent"
] as const;

export const LOCAL_LAYOUT_PROPERTIES = ["gap", "padding-x", "padding-y", "radius", "border-width", "container-max-width"] as const;

export const COLLECTION_NAMES = {
  onSurfaceInteractive: "OnSurfaceInteractive",
  onSurfaceInteractivePrimary: "OnSurfaceInteractivePrimary",
  onSurfaceInteractiveSecondary: "OnSurfaceInteractiveSecondary",
  onSurfaceInteractiveTertiary: "OnSurfaceInteractiveTertiary",
  onSurfaceStatic: "OnSurfaceStatic",
  semanticColor: "SemanticColor",
  colorTone: "ColorTone",
  colorIntensity: "ColorIntensity",
  layoutRole: "LayoutRole",
  layoutRoleDensity: "LayoutRoleDensity",
  typography: "Typography",
  breakpoints: "Breakpoints",
  brandColors: "BrandColors",
  primitives: "Primitives"
} as const;

export const COLLECTION_ORDER = [
  COLLECTION_NAMES.colorIntensity,
  COLLECTION_NAMES.colorTone,
  COLLECTION_NAMES.onSurfaceInteractive,
  COLLECTION_NAMES.onSurfaceInteractivePrimary,
  COLLECTION_NAMES.onSurfaceInteractiveSecondary,
  COLLECTION_NAMES.onSurfaceInteractiveTertiary,
  COLLECTION_NAMES.onSurfaceStatic,
  COLLECTION_NAMES.semanticColor,
  COLLECTION_NAMES.layoutRole,
  COLLECTION_NAMES.layoutRoleDensity,
  COLLECTION_NAMES.typography,
  COLLECTION_NAMES.breakpoints,
  COLLECTION_NAMES.brandColors,
  COLLECTION_NAMES.primitives
] as const;

/**
 * Collezioni "trasparenti" — collassate a tempo di emissione CSS per ridurre la
 * superficie token (vedi compiler/model.ts `valueToCss`/`emitAliasValue`).
 *
 * - INLINE: mai emesse come `--sf-*`. Ogni alias che punta dentro si risolve al
 *   valore concreto (colore `rgb(...)`, dimensione → mapping Tailwind).
 *   `Primitives` sono le foglie concrete (ramp colore + scala Tailwind-like).
 * - COLLAPSE: puro passthrough di alias 1:1. Ogni riferimento che le attraversa
 *   viene riscritto al primo token NON trasparente di destinazione.
 *   `OnSurfaceInteractive*` sono alias 1:1 verso `SemanticColor`.
 *
 * `BrandColors` resta nominato (porta l'hex inlinato) perché il progetto può
 * referenziarlo direttamente ed è ridefinito da runtime.css.
 */
export const INLINE_COLLECTIONS: ReadonlySet<string> = new Set([COLLECTION_NAMES.primitives]);

export const COLLAPSE_COLLECTIONS: ReadonlySet<string> = new Set([
  COLLECTION_NAMES.onSurfaceInteractivePrimary,
  COLLECTION_NAMES.onSurfaceInteractiveSecondary,
  COLLECTION_NAMES.onSurfaceInteractiveTertiary
]);

export function isTransparentCollection(name: string): boolean {
  return INLINE_COLLECTIONS.has(name) || COLLAPSE_COLLECTIONS.has(name);
}

export type ColorTone = (typeof COLOR_TONES)[number];
export type ColorIntensityString = (typeof COLOR_INTENSITIES)[number];
export type ColorIntensity = ColorIntensityString | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type LayoutRole = (typeof LAYOUT_ROLES)[number];
export type LayoutDensity = (typeof LAYOUT_DENSITIES)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type SurfaceType = (typeof SURFACE_TYPES)[number];
export type InteractionState = (typeof INTERACTION_STATES)[number];

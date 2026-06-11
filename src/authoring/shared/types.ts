import type {
  ALPHA_STOPS,
  ALPHA_VARIANTS,
  BRAND_ALPHA_TOKENS,
  BRAND_COLOR_TOKENS,
  BREAKPOINTS,
  COLOR_INTENSITIES,
  COLOR_TONES,
  INTERACTIVE_PRIORITIES,
  INTERACTIVE_PALETTE_ROLES,
  INTERACTIVE_STATES,
  INTERACTIVE_VARIANTS,
  LAYOUT_DENSITIES,
  LAYOUT_PROPERTIES,
  LAYOUT_ROLES,
  ON_SURFACE_INTERACTIVE_ROLES,
  ON_SURFACE_STATIC_KINDS,
  ON_SURFACE_STATIC_ROLES,
  SCALE_STOPS,
  SEMANTIC_SURFACE_ROLES,
  THEME_MODES
} from "./constants.js";

export type ColorTone = (typeof COLOR_TONES)[number];
export type ScaleStop = (typeof SCALE_STOPS)[number];
export type AlphaStop = (typeof ALPHA_STOPS)[number];
export type AlphaVariant = (typeof ALPHA_VARIANTS)[number];
export type BrandAlphaToken = (typeof BRAND_ALPHA_TOKENS)[number];
export type BrandColorToken = (typeof BRAND_COLOR_TOKENS)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type ColorIntensity = (typeof COLOR_INTENSITIES)[number];
export type SemanticSurfaceRole = (typeof SEMANTIC_SURFACE_ROLES)[number];
export type ScaleSemanticSurfaceRole = Exclude<SemanticSurfaceRole, "surface-scrim">;
export type BreakpointName = (typeof BREAKPOINTS)[number];
export type LayoutRole = (typeof LAYOUT_ROLES)[number];
export type LayoutDensity = (typeof LAYOUT_DENSITIES)[number];
export type LayoutProperty = (typeof LAYOUT_PROPERTIES)[number];
export type OnSurfaceStaticKind = (typeof ON_SURFACE_STATIC_KINDS)[number];
export type InteractivePriority = (typeof INTERACTIVE_PRIORITIES)[number];
export type InteractiveVariant = (typeof INTERACTIVE_VARIANTS)[number];
export type InteractiveState = (typeof INTERACTIVE_STATES)[number];
export type OnSurfaceStaticRole = (typeof ON_SURFACE_STATIC_ROLES)[number];
export type OnSurfaceInteractiveRole = (typeof ON_SURFACE_INTERACTIVE_ROLES)[number];
export type InteractivePaletteRole = (typeof INTERACTIVE_PALETTE_ROLES)[number];
export type PriorityMappingMode = "shared" | "themed";
export type PriorityMappingScope = ThemeMode | "shared";
export type SurfaceType =
  | "default"
  | "raised"
  | "sunken"
  | "interactive-primary"
  | "interactive-secondary"
  | "interactive-tertiary";
export type SidecarForegroundRole =
  | "none"
  | "foreground"
  | "foreground-primary"
  | "foreground-secondary"
  | "foreground-tertiary"
  | "foreground-muted"
  | "foreground-accent";
export type SidecarLayoutDirection = "vertical" | "horizontal" | "grid";

export type VariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export interface RgbaValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AliasValue {
  alias: {
    collection: string;
    name: string;
  };
}

export type TokenPrimitiveValue = RgbaValue | number | string | boolean;
export type TokenModeValue = TokenPrimitiveValue | AliasValue;

export interface VariableToken {
  collection: string;
  name: string;
  type: VariableType;
  valuesByMode: Record<string, TokenModeValue>;
  description?: string;
  scopes?: string[];
  codeSyntax?: Partial<Record<"WEB", string>>;
}

export interface CollectionSpec {
  name: string;
  modes: string[];
  variables: VariableToken[];
}

export interface PortableVariableToken {
  name: string;
  type: VariableType;
  valuesByMode: Record<string, TokenModeValue>;
  description?: string;
  scopes?: string[];
  codeSyntax?: Partial<Record<"WEB", string>>;
}

export interface StyleflowTokensFile {
  version: "1.0.0";
  source: {
    kind: "figma" | "cloud";
    pluginVersion: string;
    exportedAt: string;
  };
  collections: Array<{
    name: string;
    modes: string[];
    variables: PortableVariableToken[];
  }>;
}

export interface ColorRampConfig {
  enabled: boolean;
  chromaticName: string;
  baseHex: string;
  semanticName: ColorTone;
  alpha: Record<ThemeMode, Record<AlphaVariant, ScaleStop>>;
  overrides?: Partial<Record<ScaleStop, string>>;
}

export interface DimensionScaleEntry { name: string; value: number; }

export interface StrokeScaleEntry { name: string; value: number; }

export type BreakpointValues = Record<BreakpointName, number>;

export type LayoutValueRef =
  | { scale: string }
  | { stroke: string }
  | { container: string }
  | { breakpoint: string }
  | { value: number }
  | { inherit: true };

export type LayoutMatrix = Record<LayoutRole, Record<LayoutDensity, Record<BreakpointName, Record<LayoutProperty, LayoutValueRef>>>>;

export interface TypographyRoleConfig {
  fontSlotId: string;
  defaultWeight: string;
  size: Record<BreakpointName, LayoutValueRef>;
  lineHeight: Record<BreakpointName, LayoutValueRef>;
}

export interface TypographyFontSlot {
  id: string;
  label: string;
  enabled: boolean;
  family: string;
  enabledWeights: string[];
  lightWeight: string;
  strongWeight: string;
}

export interface TypographyConfig {
  fonts: TypographyFontSlot[];
  roles: Record<string, TypographyRoleConfig>;
}

export interface FontCatalogFamily { family: string; styles: string[]; }

export interface BrandColorReference { tone: ColorTone; stop: ScaleStop; }

export interface BrandAlphaReference { tone: ColorTone; alpha: BrandAlphaToken; }

export interface SemanticColorReference { tone: ColorTone; intensity: ColorIntensity; }

export interface InteractiveBrandColorReference { tone: ColorTone; token: BrandColorToken; }

export interface InteractiveSlotReference { tone: ColorTone; variant: InteractiveVariant; }

export type InteractivePaletteStateConfig = Record<InteractivePaletteRole, InteractiveBrandColorReference>;
export type InteractiveThemePalette = Partial<Record<ColorTone, Partial<Record<InteractiveVariant, Partial<Record<InteractiveState, InteractivePaletteStateConfig>>>>>>;

export interface InteractivePriorityMappingConfig {
  useGlobalMapping: boolean;
  mapping: Partial<Record<PriorityMappingScope, InteractiveSlotReference>>;
}

export type SemanticSurfaceReference = BrandColorReference | BrandAlphaReference;
export type SemanticSurfaceRoleReferences = Partial<{
  [Role in SemanticSurfaceRole]: Role extends "surface-scrim" ? BrandAlphaReference : BrandColorReference;
}>;

export type SemanticSurfaceOverrides = Partial<
  Record<ThemeMode, Partial<Record<ColorTone, Partial<Record<ColorIntensity, SemanticSurfaceRoleReferences>>>>>
>;

export type OnSurfaceStaticConfig = Partial<
  Record<ColorTone, Partial<Record<ColorIntensity, Partial<Record<OnSurfaceStaticKind, SemanticColorReference>>>>>
>;

export interface OnSurfaceInteractiveConfig {
  palette: Partial<Record<ThemeMode, InteractiveThemePalette>>;
  priorityMappingMode: PriorityMappingMode;
  globalPriorityMap: Partial<Record<PriorityMappingScope, Partial<Record<InteractivePriority, InteractiveSlotReference>>>>;
  priorityMap: Partial<Record<ColorTone, Partial<Record<ColorIntensity, Partial<Record<InteractivePriority, InteractivePriorityMappingConfig>>>>>>;
}

export interface StyleflowConfig {
  version: string;
  project: {
    name: string;
    icon: string;
  };
  colors: {
    algorithm: "oklch";
    tones: Record<ColorTone, ColorRampConfig>;
  };
  dimensions: {
    scale: DimensionScaleEntry[];
    containerScale: DimensionScaleEntry[];
    strokes: StrokeScaleEntry[];
    breakpoints: BreakpointValues;
    layout: LayoutMatrix;
  };
  typography: TypographyConfig;
  semanticSurfaces: SemanticSurfaceOverrides;
  onSurfaceStatic: OnSurfaceStaticConfig;
  onSurfaceInteractive: OnSurfaceInteractiveConfig;
  themes: ThemeMode[];
  layoutRoles: LayoutRole[];
  sync: {
    strategy: "managed";
    lastSyncedAt?: string;
  };
}

export interface ValidationIssue { level: "error" | "warning"; path: string; message: string; }

export interface SyncPlan {
  collections: Array<{
    name: string;
    modes: string[];
    variableCount: number;
  }>;
  variablesTotal: number;
  removals: string[];
  issues: ValidationIssue[];
}

export interface ManagedImportResult { config: StyleflowConfig; warnings: string[]; }

export type SidecarColorTone = ColorTone | "none";

export interface SidecarApplySettings {
  layoutRole: LayoutRole;
  layoutDensity: LayoutDensity;
  layoutDirection: SidecarLayoutDirection;
  colorTone: SidecarColorTone;
  colorIntensity: ColorIntensity;
  surfaceType: SurfaceType;
  foregroundRole: SidecarForegroundRole;
  interactionState: InteractiveState;
}

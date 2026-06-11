export const STYLEFLOW_CONFIG_VERSION = "1.0.0";

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

export const REQUIRED_COLOR_TONES = ["main", "neutral"] as const;

export const SCALE_STOPS = [
  "000",
  "050",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
  "1000"
] as const;

export const ALPHA_STOPS = ["0", "5", "10", "20", "30", "40", "50", "60", "70", "80", "90", "solid"] as const;
export const ALPHA_VARIANTS = ["soft", "strong"] as const;
export const BRAND_ALPHA_TOKENS = [
  "soft/0",
  "soft/5",
  "soft/10",
  "soft/20",
  "soft/30",
  "soft/40",
  "soft/50",
  "soft/60",
  "soft/70",
  "soft/80",
  "soft/90",
  "soft/solid",
  "strong/0",
  "strong/5",
  "strong/10",
  "strong/20",
  "strong/30",
  "strong/40",
  "strong/50",
  "strong/60",
  "strong/70",
  "strong/80",
  "strong/90",
  "strong/solid"
] as const;

export const BRAND_COLOR_TOKENS = [
  "000",
  "050",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
  "1000",
  "brand",
  "alpha/soft/0",
  "alpha/soft/5",
  "alpha/soft/10",
  "alpha/soft/20",
  "alpha/soft/30",
  "alpha/soft/40",
  "alpha/soft/50",
  "alpha/soft/60",
  "alpha/soft/70",
  "alpha/soft/80",
  "alpha/soft/90",
  "alpha/soft/solid",
  "alpha/strong/0",
  "alpha/strong/5",
  "alpha/strong/10",
  "alpha/strong/20",
  "alpha/strong/30",
  "alpha/strong/40",
  "alpha/strong/50",
  "alpha/strong/60",
  "alpha/strong/70",
  "alpha/strong/80",
  "alpha/strong/90",
  "alpha/strong/solid"
] as const;

export const THEME_MODES = ["light", "dark"] as const;
export const COLOR_INTENSITIES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
export const LAYOUT_DENSITIES = ["sm", "md", "lg"] as const;
export const BREAKPOINTS = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;

export const LAYOUT_ROLES = [
  "chip",
  "control",
  "item",
  "tile",
  "stack",
  "panel",
  "section",
  "region",
  "container",
  "none"
] as const;

export const LAYOUT_PROPERTIES = [
  "padding-x",
  "padding-y",
  "gap",
  "radius",
  "border-width",
  "container-max-width"
] as const;

export const LOCAL_COLOR_ROLES = [
  "local/surface",
  "local/surface-scrim",
  "local/border",
  "local/border-soft",
  "local/border-strong",
  "local/border-accent",
  "local/foreground-primary",
  "local/foreground-secondary",
  "local/foreground-tertiary",
  "local/foreground-muted",
  "local/foreground-accent"
] as const;

export const ON_SURFACE_STATIC_KINDS = ["raised", "sunken"] as const;
export const INTERACTIVE_PRIORITIES = ["primary", "secondary", "tertiary"] as const;
export const INTERACTIVE_VARIANTS = ["soft", "strong"] as const;
export const INTERACTIVE_STATES = ["default", "hover", "active", "focus", "disabled"] as const;

export const ON_SURFACE_STATIC_ROLES = [
  "background",
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

export const ON_SURFACE_INTERACTIVE_ROLES = ["background", "border", "foreground", "focus-ring"] as const;
export const INTERACTIVE_PALETTE_ROLES = ["background", "border", "foreground"] as const;

export const ON_SURFACE_STATIC_ROLE_TO_LOCAL_ROLE = {
  background: "local/surface",
  "surface-scrim": "local/surface-scrim",
  border: "local/border",
  "border-soft": "local/border-soft",
  "border-strong": "local/border-strong",
  "border-accent": "local/border-accent",
  "foreground-primary": "local/foreground-primary",
  "foreground-secondary": "local/foreground-secondary",
  "foreground-tertiary": "local/foreground-tertiary",
  "foreground-muted": "local/foreground-muted",
  "foreground-accent": "local/foreground-accent"
} as const;

export const ON_SURFACE_INTERACTIVE_ROLE_TO_LOCAL_ROLE = {
  background: "local/surface",
  border: "local/border-strong",
  foreground: "local/foreground-primary",
  "focus-ring": "local/border-accent"
} as const;

export const SEMANTIC_SURFACE_ROLES = [
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

export const SEMANTIC_ROLE_TO_LOCAL_ROLE = {
  surface: "local/surface",
  "surface-scrim": "local/surface-scrim",
  border: "local/border",
  "border-soft": "local/border-soft",
  "border-strong": "local/border-strong",
  "border-accent": "local/border-accent",
  "foreground-primary": "local/foreground-primary",
  "foreground-secondary": "local/foreground-secondary",
  "foreground-tertiary": "local/foreground-tertiary",
  "foreground-muted": "local/foreground-muted",
  "foreground-accent": "local/foreground-accent"
} as const;

export const FIGMA_LIMITS = {
  maxModesPerCollection: 10,
  maxVariablesPerCollection: 5000
} as const;

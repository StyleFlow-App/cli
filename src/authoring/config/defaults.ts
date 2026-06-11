import {
  BREAKPOINTS,
  COLOR_TONES,
  LAYOUT_DENSITIES,
  LAYOUT_PROPERTIES,
  LAYOUT_ROLES,
  STYLEFLOW_CONFIG_VERSION,
  THEME_MODES
} from "../shared/constants.js";
import type {
  BreakpointName,
  ColorRampConfig,
  ColorTone,
  LayoutDensity,
  LayoutMatrix,
  LayoutProperty,
  LayoutRole,
  LayoutValueRef,
  ScaleStop,
  StyleflowConfig,
  TypographyConfig
} from "../shared/types.js";
import { canInheritLayoutProperty } from "../core/layout/inheritance.js";
import { createDefaultOnSurfaceInteractive, createDefaultOnSurfaceStatic } from "./onSurfaceDefaults.js";
const scale = (name: string): LayoutValueRef => ({ scale: name });
const stroke = (name: string): LayoutValueRef => ({ stroke: name });
const container = (name: string): LayoutValueRef => ({ container: name });

const toneDefaults: Record<ColorTone, Omit<ColorRampConfig, "semanticName">> = {
  main: { enabled: true, chromaticName: "blue", baseHex: "#2563eb", alpha: defaultAlphaConfig("main") },
  accent: { enabled: true, chromaticName: "violet", baseHex: "#7c3aed", alpha: defaultAlphaConfig("accent") },
  contrast: { enabled: true, chromaticName: "slate", baseHex: "#0f172a", alpha: defaultAlphaConfig("contrast") },
  neutral: { enabled: true, chromaticName: "neutral", baseHex: "#64748b", alpha: defaultAlphaConfig("neutral") },
  success: { enabled: true, chromaticName: "green", baseHex: "#16a34a", alpha: defaultAlphaConfig("success") },
  warning: { enabled: true, chromaticName: "amber", baseHex: "#d97706", alpha: defaultAlphaConfig("warning") },
  critical: { enabled: true, chromaticName: "red", baseHex: "#dc2626", alpha: defaultAlphaConfig("critical") },
  "support-1": { enabled: true, chromaticName: "cyan", baseHex: "#0891b2", alpha: defaultAlphaConfig("support-1") },
  "support-2": { enabled: true, chromaticName: "pink", baseHex: "#db2777", alpha: defaultAlphaConfig("support-2") },
  "support-3": { enabled: true, chromaticName: "lime", baseHex: "#65a30d", alpha: defaultAlphaConfig("support-3") }
};

export function defaultAlphaConfig(tone: ColorTone): ColorRampConfig["alpha"] {
  const softLight: ScaleStop = tone === "neutral" ? "000" : "200";
  const softDark: ScaleStop = tone === "neutral" ? "1000" : "800";
  return {
    light: { soft: softLight, strong: "600" },
    dark: { soft: softDark, strong: "400" }
  };
}

const layoutDefaults: Record<LayoutRole, Record<LayoutDensity, Record<LayoutProperty, LayoutValueRef>>> = {
  chip: {
    sm: baseLayout("1", "2px", "1", "full", "default", 0),
    md: baseLayout("2", "1", "1", "full", "default", 0),
    lg: baseLayout("3", "2", "1", "full", "default", 0)
  },
  control: {
    sm: baseLayout("2", "1", "1", "1", "default", 0),
    md: baseLayout("3", "2", "1", "2", "default", 0),
    lg: baseLayout("4", "2", "2", "2", "default", 0)
  },
  item: {
    sm: baseLayout("2", "1", "1", "1", "0", 0),
    md: baseLayout("3", "2", "2", "2", "default", 0),
    lg: baseLayout("4", "3", "2", "3", "default", 0)
  },
  tile: {
    sm: baseLayout("3", "3", "2", "3", "default", 0),
    md: baseLayout("4", "4", "3", "4", "default", 0),
    lg: baseLayout("5", "5", "3", "4", "default", 0)
  },
  stack: {
    sm: baseLayout("0", "0", "2", "0", "0", 0),
    md: baseLayout("0", "0", "3", "0", "0", 0),
    lg: baseLayout("0", "0", "4", "0", "0", 0)
  },
  panel: {
    sm: baseLayout("4", "4", "3", "4", "default", 0),
    md: baseLayout("5", "5", "4", "5", "default", 0),
    lg: baseLayout("6", "6", "5", "5", "default", 0)
  },
  section: {
    sm: baseLayout("0", "6", "4", "0", "0", 0),
    md: baseLayout("0", "8", "5", "0", "0", 0),
    lg: baseLayout("0", "12", "6", "0", "0", 0)
  },
  region: {
    sm: baseLayout("3", "3", "2", "0", "0", 0),
    md: baseLayout("4", "4", "3", "0", "0", 0),
    lg: baseLayout("5", "5", "4", "0", "0", 0)
  },
  container: {
    sm: baseLayout("4", "0", "0", "0", "0", 640),
    md: baseLayout("5", "0", "0", "0", "0", 768),
    lg: baseLayout("6", "0", "0", "0", "0", 1200)
  },
  none: {
    sm: baseLayout("0", "0", "0", "0", "0", 0),
    md: baseLayout("0", "0", "0", "0", "0", 0),
    lg: baseLayout("0", "0", "0", "0", "0", 0)
  }
};

export function createDefaultConfig(): StyleflowConfig {
  return {
    version: STYLEFLOW_CONFIG_VERSION,
    project: {
      name: "Styleflow",
      icon: "s"
    },
    colors: {
      algorithm: "oklch",
      tones: Object.fromEntries(
        COLOR_TONES.map((tone) => [tone, Object.assign({ semanticName: tone }, toneDefaults[tone])])
      ) as Record<ColorTone, ColorRampConfig>
    },
    dimensions: {
      scale: [
        { name: "0", value: 0 },
        { name: "px", value: 1 },
        { name: "2px", value: 2 },
        { name: "1", value: 4 },
        { name: "2", value: 8 },
        { name: "3", value: 12 },
        { name: "3-5", value: 14 },
        { name: "3-75", value: 15 },
        { name: "4", value: 16 },
        { name: "4-5", value: 18 },
        { name: "5", value: 20 },
        { name: "6", value: 24 },
        { name: "7", value: 28 },
        { name: "8", value: 32 },
        { name: "9", value: 36 },
        { name: "10", value: 40 },
        { name: "11", value: 44 },
        { name: "12", value: 48 },
        { name: "14", value: 56 },
        { name: "16", value: 64 },
        { name: "18", value: 72 },
        { name: "20", value: 80 },
        { name: "24", value: 96 },
        { name: "28", value: 112 },
        { name: "32", value: 128 },
        { name: "36", value: 144 },
        { name: "40", value: 160 },
        { name: "44", value: 176 },
        { name: "48", value: 192 },
        { name: "52", value: 208 },
        { name: "56", value: 224 },
        { name: "60", value: 240 },
        { name: "64", value: 256 },
        { name: "72", value: 288 },
        { name: "80", value: 320 },
        { name: "96", value: 384 },
        { name: "full", value: 999999 }
      ],
      containerScale: [
        { name: "0", value: 0 },
        { name: "640", value: 640 },
        { name: "768", value: 768 },
        { name: "1024", value: 1024 },
        { name: "1280", value: 1280 },
        { name: "1536", value: 1536 }
      ],
      strokes: [
        { name: "0", value: 0 },
        { name: "light", value: 1 },
        { name: "default", value: 1 },
        { name: "strong", value: 2 },
        { name: "ultra", value: 3 }
      ],
      breakpoints: {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
        "2xl": 1536
      },
      layout: createLayoutMatrix()
    },
    typography: createDefaultTypography(),
    semanticSurfaces: {},
    onSurfaceStatic: createDefaultOnSurfaceStatic(),
    onSurfaceInteractive: createDefaultOnSurfaceInteractive(),
    themes: THEME_MODES.slice(),
    layoutRoles: LAYOUT_ROLES.slice(),
    sync: {
      strategy: "managed"
    }
  };
}

function baseLayout(
  paddingX: string,
  paddingY: string,
  gap: string,
  radius: string,
  borderWidth: string,
  containerMaxWidth: number
): Record<LayoutProperty, LayoutValueRef> {
  return {
    "padding-x": scale(paddingX),
    "padding-y": scale(paddingY),
    gap: scale(gap),
    radius: scale(radius),
    "border-width": stroke(borderWidth),
    "container-max-width": container(String(containerMaxWidth))
  };
}

function createLayoutMatrix(): LayoutMatrix {
  const matrix = {} as LayoutMatrix;
  for (const role of LAYOUT_ROLES) {
    matrix[role] = {} as LayoutMatrix[LayoutRole];
    for (const density of LAYOUT_DENSITIES) {
      matrix[role][density] = {} as Record<BreakpointName, Record<LayoutProperty, LayoutValueRef>>;
      for (const breakpoint of BREAKPOINTS) {
        const concrete = responsiveLayout(role, density, breakpoint);
        matrix[role][density][breakpoint] = Object.fromEntries(
          LAYOUT_PROPERTIES.map((property) => [
            property,
            breakpoint !== "xs" && canInheritLayoutProperty(role, property)
              ? { inherit: true }
              : concrete[property]
          ])
        ) as Record<LayoutProperty, LayoutValueRef>;
      }
    }
  }
  return matrix;
}

function responsiveLayout(role: LayoutRole, density: LayoutDensity, breakpoint: BreakpointName) {
  const base = Object.assign({}, layoutDefaults[role][density]);
  if (role !== "container") {
    return base;
  }
  const widths: Record<BreakpointName, number> = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };
  return Object.assign({}, base, { "container-max-width": container(String(widths[breakpoint])) });
}

function createDefaultTypography(): TypographyConfig {
  const role = (defaultWeight: string, size: string, lineHeight: string) => ({
    fontSlotId: "main",
    defaultWeight,
    size: allBreakpoints(scale(size)),
    lineHeight: allBreakpoints(scale(lineHeight))
  });
  return {
    fonts: [
      {
        id: "main",
        label: "Main",
        enabled: true,
        family: "Inter",
        enabledWeights: ["Light", "Regular", "Semi Bold", "Bold"],
        lightWeight: "Light",
        strongWeight: "Semi Bold"
      },
      {
        id: "display",
        label: "Display",
        enabled: false,
        family: "Inter",
        enabledWeights: ["Light", "Regular", "Semi Bold", "Bold"],
        lightWeight: "Light",
        strongWeight: "Semi Bold"
      }
    ],
    roles: {
      "heading-0": role("Bold", "9", "10"),
      "heading-1": role("Bold", "8", "9"),
      "heading-2": role("Bold", "7", "8"),
      "heading-3": role("Semi Bold", "6", "7"),
      "heading-4": role("Semi Bold", "5", "6"),
      "heading-5": role("Semi Bold", "4-5", "6"),
      "heading-6": role("Semi Bold", "4", "5"),
      "body-lg": role("Regular", "4-5", "7"),
      "body-md": role("Regular", "4", "6"),
      "body-sm": role("Regular", "3-5", "5"),
      "body-xs": role("Regular", "3", "4-5")
    }
  };
}

function allBreakpoints(ref: LayoutValueRef): Record<BreakpointName, LayoutValueRef> {
  return Object.fromEntries(BREAKPOINTS.map((breakpoint) => [breakpoint, ref])) as Record<BreakpointName, LayoutValueRef>;
}

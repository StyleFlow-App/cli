import {
  COLOR_INTENSITIES,
  COLOR_TONES,
  INTERACTIVE_PRIORITIES,
  INTERACTIVE_PALETTE_ROLES,
  INTERACTIVE_STATES,
  INTERACTIVE_VARIANTS,
  ON_SURFACE_STATIC_KINDS,
  THEME_MODES
} from "../shared/constants.js";
import type {
  ColorIntensity,
  ColorTone,
  InteractiveBrandColorReference,
  InteractivePaletteRole,
  InteractivePaletteStateConfig,
  InteractivePriority,
  InteractivePriorityMappingConfig,
  InteractiveSlotReference,
  InteractiveState,
  InteractiveVariant,
  OnSurfaceInteractiveConfig,
  OnSurfaceStaticConfig,
  OnSurfaceStaticKind,
  PriorityMappingScope,
  SemanticColorReference,
  ThemeMode
} from "../shared/types.js";

const LIGHT_SURFACE_STOPS: Record<ColorIntensity, InteractiveBrandColorReference["token"]> = {
  "1": "000", "2": "050", "3": "100", "4": "200", "5": "300",
  "6": "500", "7": "600", "8": "700", "9": "900", "10": "950"
};

const DARK_SURFACE_STOPS: Record<ColorIntensity, InteractiveBrandColorReference["token"]> = {
  "1": "1000", "2": "950", "3": "900", "4": "800", "5": "700",
  "6": "600", "7": "500", "8": "300", "9": "100", "10": "050"
};

export function createDefaultOnSurfaceStatic(): OnSurfaceStaticConfig {
  const config: OnSurfaceStaticConfig = {};
  for (const tone of COLOR_TONES) {
    config[tone] = {};
    for (const intensity of COLOR_INTENSITIES) {
      config[tone][intensity] = {};
      for (const kind of ON_SURFACE_STATIC_KINDS) {
        config[tone][intensity][kind] = defaultOnSurfaceStaticRef(tone, intensity, kind);
      }
    }
  }
  return config;
}

export function createDefaultOnSurfaceInteractive(): OnSurfaceInteractiveConfig {
  const config: OnSurfaceInteractiveConfig = { palette: {}, priorityMappingMode: "shared", globalPriorityMap: {}, priorityMap: {} };
  config.globalPriorityMap.shared = {};
  for (const priority of INTERACTIVE_PRIORITIES) {
    config.globalPriorityMap.shared[priority] = defaultInteractiveGlobalPriorityRef("shared", priority);
  }
  for (const theme of THEME_MODES) {
    config.palette[theme] = {};
    config.globalPriorityMap[theme] = {};
    for (const priority of INTERACTIVE_PRIORITIES) {
      config.globalPriorityMap[theme]![priority] = defaultInteractiveGlobalPriorityRef(theme, priority);
    }
    for (const tone of COLOR_TONES) {
      config.palette[theme]![tone] = {};
      for (const variant of INTERACTIVE_VARIANTS) {
        config.palette[theme]![tone]![variant] = {};
        for (const state of INTERACTIVE_STATES) {
          config.palette[theme]![tone]![variant]![state] = defaultInteractivePaletteState(theme, tone, variant, state);
        }
      }
    }
  }
  for (const tone of COLOR_TONES) {
    config.priorityMap[tone] = {};
    for (const intensity of COLOR_INTENSITIES) {
      config.priorityMap[tone]![intensity] = {};
      for (const priority of INTERACTIVE_PRIORITIES) {
        config.priorityMap[tone]![intensity]![priority] = defaultInteractivePriorityMapping();
      }
    }
  }
  return config;
}

export function defaultOnSurfaceStaticRef(
  tone: ColorTone,
  intensity: ColorIntensity,
  kind: OnSurfaceStaticKind
): SemanticColorReference {
  const amount = kind === "raised" ? -1 : 1;
  return { tone, intensity: shiftIntensity(intensity, amount) };
}

export function defaultInteractivePaletteRef(
  theme: ThemeMode,
  tone: ColorTone,
  variant: InteractiveVariant,
  state: InteractiveState,
  role: InteractivePaletteRole
): InteractiveBrandColorReference {
  const soft: Record<InteractiveState, ColorIntensity> = {
    default: "2", hover: "3", active: "4", focus: "3", disabled: "1"
  };
  const strong: Record<InteractiveState, ColorIntensity> = {
    default: "7", hover: "8", active: "9", focus: "8", disabled: "5"
  };
  const intensity = variant === "soft" ? soft[state] : strong[state];
  return interactiveBrandRefFromSemantic({ tone, intensity }, role, theme);
}

export function defaultInteractivePaletteState(
  theme: ThemeMode,
  tone: ColorTone,
  variant: InteractiveVariant,
  state: InteractiveState
): InteractivePaletteStateConfig {
  return Object.fromEntries(
    INTERACTIVE_PALETTE_ROLES.map((role) => [role, defaultInteractivePaletteRef(theme, tone, variant, state, role)])
  ) as InteractivePaletteStateConfig;
}

export function interactiveBrandRefFromSemantic(
  ref: SemanticColorReference,
  role: InteractivePaletteRole,
  theme: ThemeMode = "light"
): InteractiveBrandColorReference {
  const surfaceStop = (theme === "dark" ? DARK_SURFACE_STOPS : LIGHT_SURFACE_STOPS)[ref.intensity];
  if (role === "background") {
    return { tone: ref.tone, token: surfaceStop };
  }
  if (role === "border") {
    return { tone: ref.tone, token: shiftedStop(surfaceStop, theme === "dark" ? -2 : 2) };
  }
  const foreground = theme === "dark"
    ? (Number(ref.intensity) >= 6 ? "950" : "050")
    : (Number(ref.intensity) >= 6 ? "050" : "950");
  return { tone: ref.tone, token: foreground };
}

export function defaultInteractiveGlobalPriorityRef(scope: PriorityMappingScope, priority: InteractivePriority): InteractiveSlotReference {
  const theme: ThemeMode = scope === "shared" ? "light" : scope;
  if (theme === "dark") {
    if (priority === "primary") {
      return { tone: "main", variant: "soft" };
    }
    if (priority === "secondary") {
      return { tone: "main", variant: "strong" };
    }
    return { tone: "neutral", variant: "strong" };
  }
  if (priority === "primary") {
    return { tone: "main", variant: "strong" };
  }
  if (priority === "secondary") {
    return { tone: "main", variant: "soft" };
  }
  return { tone: "neutral", variant: "soft" };
}

export function defaultInteractivePriorityMapping(): InteractivePriorityMappingConfig {
  return { useGlobalMapping: true, mapping: {} };
}

function shiftIntensity(intensity: ColorIntensity, amount: number): ColorIntensity {
  return String(Math.max(1, Math.min(10, Number(intensity) + amount))) as ColorIntensity;
}

function shiftedStop(stop: InteractiveBrandColorReference["token"], amount: number): InteractiveBrandColorReference["token"] {
  const stops: InteractiveBrandColorReference["token"][] = ["000", "050", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950", "1000"];
  const index = stops.indexOf(stop);
  return stops[Math.max(0, Math.min(stops.length - 1, index + amount))];
}

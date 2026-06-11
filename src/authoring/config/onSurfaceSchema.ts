import {
  ALPHA_STOPS,
  BRAND_COLOR_TOKENS,
  COLOR_INTENSITIES,
  COLOR_TONES,
  INTERACTIVE_PALETTE_ROLES,
  INTERACTIVE_PRIORITIES,
  INTERACTIVE_STATES,
  INTERACTIVE_VARIANTS,
  ON_SURFACE_STATIC_KINDS,
  THEME_MODES
} from "../shared/constants.js";
import type {
  AlphaStop,
  ColorIntensity,
  ColorTone,
  InteractiveBrandColorReference,
  InteractivePaletteStateConfig,
  InteractivePriorityMappingConfig,
  InteractiveSlotReference,
  InteractiveVariant,
  OnSurfaceInteractiveConfig,
  OnSurfaceStaticConfig,
  PriorityMappingMode,
  PriorityMappingScope,
  ThemeMode
} from "../shared/types.js";

export function normalizeOnSurfaceStaticConfig(value: unknown, defaults: OnSurfaceStaticConfig): OnSurfaceStaticConfig {
  const input = isObject(value) ? value : {};
  const result: OnSurfaceStaticConfig = {};
  for (const tone of COLOR_TONES) {
    result[tone] = {};
    const toneInput = isObject(input[tone]) ? input[tone] : {};
    for (const intensity of COLOR_INTENSITIES) {
      result[tone]![intensity] = {};
      const intensityInput = isObject(toneInput[intensity]) ? toneInput[intensity] : {};
      for (const kind of ON_SURFACE_STATIC_KINDS) {
        const ref = isSemanticRef(intensityInput[kind]) ? intensityInput[kind] : defaults[tone]?.[intensity]?.[kind];
        result[tone]![intensity]![kind] = ref || { tone, intensity };
      }
    }
  }
  return result;
}

export function normalizeOnSurfaceInteractiveConfig(
  value: unknown,
  defaults: OnSurfaceInteractiveConfig,
  themes: ThemeMode[] = THEME_MODES.slice()
): OnSurfaceInteractiveConfig {
  const input = isObject(value) ? value : {};
  const priorityMappingMode = normalizePriorityMappingMode(input);
  return {
    palette: normalizePalette(isObject(input.palette) ? input.palette : {}, defaults),
    priorityMappingMode,
    globalPriorityMap: normalizeGlobalPriorityMap(isObject(input.globalPriorityMap) ? input.globalPriorityMap : {}, defaults, themes),
    priorityMap: normalizePriorityMap(isObject(input.priorityMap) ? input.priorityMap : {}, defaults, themes)
  };
}

function normalizePalette(input: Record<string, unknown>, defaults: OnSurfaceInteractiveConfig): OnSurfaceInteractiveConfig["palette"] {
  const palette: OnSurfaceInteractiveConfig["palette"] = {};
  for (const theme of THEME_MODES) {
    palette[theme] = {};
    const themeInput = isObject(input[theme]) ? input[theme] : {};
    for (const tone of COLOR_TONES) {
      palette[theme]![tone] = {};
      const toneInput = isObject(themeInput[tone]) ? themeInput[tone] : {};
      for (const variant of INTERACTIVE_VARIANTS) {
        palette[theme]![tone]![variant] = {};
        const variantInput = isObject(toneInput[variant]) ? toneInput[variant] : {};
        for (const state of INTERACTIVE_STATES) {
          const stateInput = isObject(variantInput[state]) ? variantInput[state] : {};
          const fallback = defaults.palette[theme]?.[tone]?.[variant]?.[state];
          palette[theme]![tone]![variant]![state] = Object.fromEntries(
            INTERACTIVE_PALETTE_ROLES.map((role) => {
              const ref = normalizeInteractiveBrandRef(stateInput[role]);
              return [role, ref ?? fallback?.[role] ?? { tone, token: "brand" }];
            })
          ) as InteractivePaletteStateConfig;
        }
      }
    }
  }
  return palette;
}

function normalizeGlobalPriorityMap(
  input: Record<string, unknown>,
  defaults: OnSurfaceInteractiveConfig,
  themes: ThemeMode[]
): OnSurfaceInteractiveConfig["globalPriorityMap"] {
  const result: OnSurfaceInteractiveConfig["globalPriorityMap"] = {};
  const scopes: PriorityMappingScope[] = ["shared", ...THEME_MODES];
  for (const scope of scopes) {
    result[scope] = {};
    const scopeInput = isObject(input[scope]) ? input[scope] : {};
    const sharedInput = scope === "shared" ? firstMappingSource(input, themes) : undefined;
    for (const priority of INTERACTIVE_PRIORITIES) {
      const candidate = isSlotRef(scopeInput[priority]) ? scopeInput[priority] : sharedInput?.[priority];
      const ref = isSlotRef(candidate) ? candidate : defaults.globalPriorityMap[scope]?.[priority];
      result[scope]![priority] = ref ?? { tone: "main", variant: "soft" };
    }
  }
  return result;
}

function normalizePriorityMap(input: Record<string, unknown>, defaults: OnSurfaceInteractiveConfig, themes: ThemeMode[]): OnSurfaceInteractiveConfig["priorityMap"] {
  const result: OnSurfaceInteractiveConfig["priorityMap"] = {};
  for (const tone of COLOR_TONES) {
    result[tone] = {};
    const toneInput = isObject(input[tone]) ? input[tone] : {};
    for (const intensity of COLOR_INTENSITIES) {
      result[tone]![intensity] = {};
      const intensityInput = isObject(toneInput[intensity]) ? toneInput[intensity] : {};
      for (const priority of INTERACTIVE_PRIORITIES) {
        const candidate = intensityInput[priority];
        const fallback = defaults.priorityMap[tone]?.[intensity]?.[priority] ?? { useGlobalMapping: true, mapping: {} };
        result[tone]![intensity]![priority] = normalizeMapping(candidate, fallback, themes);
      }
    }
  }
  return result;
}

function normalizeMapping(value: unknown, fallback: InteractivePriorityMappingConfig, themes: ThemeMode[]): InteractivePriorityMappingConfig {
  if (!isObject(value)) {
    return fallback;
  }
  const source = isObject(value.mapping) ? value.mapping : undefined;
  const mapping: InteractivePriorityMappingConfig["mapping"] = {};
  for (const scope of ["shared", ...THEME_MODES] as PriorityMappingScope[]) {
    if (source && isSlotRef(source[scope])) {
      mapping[scope] = source[scope];
    }
  }
  if (source && !mapping.shared) {
    const candidate = firstSlotRef(source, themes);
    if (candidate) {
      mapping.shared = candidate;
    }
  }
  return { useGlobalMapping: value.useGlobalMapping !== false, mapping };
}

function normalizePriorityMappingMode(input: Record<string, unknown>): PriorityMappingMode {
  if (input.priorityMappingMode === "shared" || input.priorityMappingMode === "themed") {
    return input.priorityMappingMode;
  }
  return hasThemedScopes(input.globalPriorityMap) || hasThemedPriorityRows(input.priorityMap)
    ? "themed"
    : "shared";
}

function hasThemedScopes(value: unknown): boolean {
  return isObject(value) && (isObject(value.light) || isObject(value.dark));
}

function hasThemedPriorityRows(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  for (const tone of Object.values(value)) {
    if (!isObject(tone)) {
      continue;
    }
    for (const intensity of Object.values(tone)) {
      if (!isObject(intensity)) {
        continue;
      }
      for (const row of Object.values(intensity)) {
        if (isObject(row) && hasThemedScopes(row.mapping)) {
          return true;
        }
      }
    }
  }
  return false;
}

function firstMappingSource(input: Record<string, unknown>, themes: ThemeMode[]): Record<string, unknown> | undefined {
  const order: Array<PriorityMappingScope> = ["light", ...themes.filter((theme) => theme !== "light"), "dark"];
  for (const scope of order) {
    if (isObject(input[scope])) {
      return input[scope];
    }
  }
  return undefined;
}

function firstSlotRef(source: Record<string, unknown>, themes: ThemeMode[]): InteractiveSlotReference | undefined {
  for (const scope of ["light", ...themes.filter((theme) => theme !== "light"), "dark"] as PriorityMappingScope[]) {
    if (isSlotRef(source[scope])) {
      return source[scope];
    }
  }
  return undefined;
}

function isSemanticRef(value: unknown): value is { tone: ColorTone; intensity: ColorIntensity } {
  return isObject(value) && isColorTone(value.tone) && isColorIntensity(value.intensity);
}

function normalizeInteractiveBrandRef(value: unknown): InteractiveBrandColorReference | undefined {
  if (!isObject(value) || !isColorTone(value.tone) || typeof value.token !== "string") {
    return undefined;
  }
  const token = normalizeInteractiveBrandToken(value.token);
  return token ? { tone: value.tone, token } : undefined;
}

function normalizeInteractiveBrandToken(value: string): InteractiveBrandColorReference["token"] | undefined {
  if ((BRAND_COLOR_TOKENS as readonly string[]).includes(value)) {
    return value as InteractiveBrandColorReference["token"];
  }
  if (value === "alpha/white") {
    return "alpha/soft/40";
  }
  const legacyAlpha = value.slice("alpha/".length);
  if (value.indexOf("alpha/") === 0 && (ALPHA_STOPS as readonly string[]).includes(legacyAlpha)) {
    return `alpha/soft/${legacyAlpha as AlphaStop}` as InteractiveBrandColorReference["token"];
  }
  return undefined;
}

function isSlotRef(value: unknown): value is InteractiveSlotReference {
  return isObject(value) && isColorTone(value.tone) && isInteractiveVariant(value.variant);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColorTone(value: unknown): value is ColorTone {
  return typeof value === "string" && (COLOR_TONES as readonly string[]).includes(value);
}

function isColorIntensity(value: unknown): value is ColorIntensity {
  return typeof value === "string" && (COLOR_INTENSITIES as readonly string[]).includes(value);
}

function isInteractiveVariant(value: unknown): value is InteractiveVariant {
  return typeof value === "string" && (INTERACTIVE_VARIANTS as readonly string[]).includes(value);
}

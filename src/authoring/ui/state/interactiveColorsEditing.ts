import type {
  AlphaStop,
  AlphaVariant,
  BrandColorToken,
  ColorIntensity,
  ColorTone,
  InteractiveBrandColorReference,
  InteractivePaletteRole,
  InteractivePriority,
  InteractivePriorityMappingConfig,
  InteractiveSlotReference,
  InteractiveState,
  InteractiveVariant,
  PriorityMappingMode,
  PriorityMappingScope,
  ScaleStop,
  StyleflowConfig,
  ThemeMode
} from "../../shared/types.js";
import {
  defaultInteractiveGlobalPriorityRef,
  defaultInteractivePaletteRef,
  defaultInteractivePaletteState,
  defaultInteractivePriorityMapping
} from "../../config/onSurfaceDefaults.js";
import { hexToRgba } from "../../core/colors/convert.js";
import { generateColorRamp } from "../../core/colors/ramp.js";

export function getInteractivePaletteRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  variant: InteractiveVariant,
  state: InteractiveState,
  role: InteractivePaletteRole
): InteractiveBrandColorReference {
  return config.onSurfaceInteractive.palette[theme]?.[tone]?.[variant]?.[state]?.[role]
    || defaultInteractivePaletteRef(theme, tone, variant, state, role);
}

export function setInteractivePaletteRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  variant: InteractiveVariant,
  state: InteractiveState,
  role: InteractivePaletteRole,
  ref: InteractiveBrandColorReference
): StyleflowConfig {
  const next = cloneConfig(config);
  const themeConfig = next.onSurfaceInteractive.palette[theme] || {};
  const toneConfig = themeConfig[tone] || {};
  const variantConfig = toneConfig[variant] || {};
  const stateConfig = variantConfig[state] || defaultInteractivePaletteState(theme, tone, variant, state);
  stateConfig[role] = ref;
  variantConfig[state] = stateConfig;
  toneConfig[variant] = variantConfig;
  themeConfig[tone] = toneConfig;
  next.onSurfaceInteractive.palette[theme] = themeConfig;
  return next;
}

export function interactiveBrandRefToCss(config: StyleflowConfig, ref: InteractiveBrandColorReference, theme: ThemeMode = "light"): string {
  const ramp = generateColorRamp(config.colors.tones[ref.tone]);
  const alpha = parseAlphaToken(ref.token);
  if (alpha) {
    const sourceStop = config.colors.tones[ref.tone].alpha[theme]?.[alpha.variant] ?? config.colors.tones[ref.tone].alpha.light[alpha.variant];
    const opacity = alpha.stop === "solid" ? 1 : Number(alpha.stop) / 100;
    const rgba = hexToRgba(ramp.colors[sourceStop], opacity);
    return `rgba(${Math.round(rgba.r * 255)} ${Math.round(rgba.g * 255)} ${Math.round(rgba.b * 255)} / ${rgba.a})`;
  }
  return ref.token === "brand" ? config.colors.tones[ref.tone].baseHex : ramp.colors[ref.token as ScaleStop];
}

export function getGlobalPriorityRef(config: StyleflowConfig, scope: PriorityMappingScope, priority: InteractivePriority): InteractiveSlotReference {
  return config.onSurfaceInteractive.globalPriorityMap[scope]?.[priority] || defaultInteractiveGlobalPriorityRef(scope, priority);
}

export function setGlobalPriorityRef(config: StyleflowConfig, scope: PriorityMappingScope, priority: InteractivePriority, ref: InteractiveSlotReference): StyleflowConfig {
  const next = cloneConfig(config);
  const map = next.onSurfaceInteractive.globalPriorityMap[scope] || {};
  map[priority] = ref;
  next.onSurfaceInteractive.globalPriorityMap[scope] = map;
  return next;
}

export function setPriorityMappingMode(config: StyleflowConfig, mode: PriorityMappingMode): StyleflowConfig {
  const next = cloneConfig(config);
  next.onSurfaceInteractive.priorityMappingMode = mode;
  return next;
}

export function getPriorityMapping(config: StyleflowConfig, tone: ColorTone, intensity: ColorIntensity, priority: InteractivePriority): InteractivePriorityMappingConfig {
  return config.onSurfaceInteractive.priorityMap[tone]?.[intensity]?.[priority] || defaultInteractivePriorityMapping();
}

export function getInteractivePriorityRef(
  config: StyleflowConfig,
  scope: PriorityMappingScope,
  tone: ColorTone,
  intensity: ColorIntensity,
  priority: InteractivePriority
): InteractiveSlotReference {
  const row = getPriorityMapping(config, tone, intensity, priority);
  return row.useGlobalMapping ? getGlobalPriorityRef(config, scope, priority) : row.mapping[scope] || getGlobalPriorityRef(config, scope, priority);
}

export function setUseGlobalMapping(config: StyleflowConfig, tone: ColorTone, intensity: ColorIntensity, priority: InteractivePriority, enabled: boolean): StyleflowConfig {
  const next = cloneConfig(config);
  const current = getPriorityMapping(next, tone, intensity, priority);
  const mapping = { ...current.mapping };
  for (const scope of ["shared", ...next.themes] as PriorityMappingScope[]) {
    mapping[scope] = mapping[scope] || getGlobalPriorityRef(next, scope, priority);
  }
  next.onSurfaceInteractive.priorityMap[tone]![intensity]![priority] = { useGlobalMapping: enabled, mapping };
  return next;
}

export function setInteractivePriorityRef(
  config: StyleflowConfig,
  scope: PriorityMappingScope,
  tone: ColorTone,
  intensity: ColorIntensity,
  priority: InteractivePriority,
  ref: InteractiveSlotReference
): StyleflowConfig {
  const next = cloneConfig(config);
  const current = getPriorityMapping(next, tone, intensity, priority);
  next.onSurfaceInteractive.priorityMap[tone]![intensity]![priority] = {
    useGlobalMapping: false,
    mapping: { ...current.mapping, [scope]: ref }
  };
  return next;
}

export function interactiveToneOptions(config: StyleflowConfig): ColorTone[] {
  return Object.keys(config.colors.tones).filter((tone) => config.colors.tones[tone as ColorTone].enabled) as ColorTone[];
}

export function interactiveTokenOptions(): BrandColorToken[] {
  return [] as BrandColorToken[];
}

function cloneConfig(config: StyleflowConfig): StyleflowConfig {
  return JSON.parse(JSON.stringify(config)) as StyleflowConfig;
}

function parseAlphaToken(token: BrandColorToken): { variant: AlphaVariant; stop: AlphaStop } | undefined {
  const parts = token.split("/");
  if (parts[0] !== "alpha") {
    return undefined;
  }
  if (parts.length === 3) {
    return { variant: parts[1] as AlphaVariant, stop: parts[2] as AlphaStop };
  }
  if (parts.length === 2) {
    return { variant: "soft", stop: parts[1] as AlphaStop };
  }
  return undefined;
}

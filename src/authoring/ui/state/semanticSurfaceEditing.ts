import { BRAND_ALPHA_TOKENS, COLOR_INTENSITIES, SCALE_STOPS, SEMANTIC_SURFACE_ROLES } from "../../shared/constants.js";
import type {
  AlphaStop,
  AlphaVariant,
  BrandAlphaReference,
  BrandColorReference,
  ColorIntensity,
  ColorTone,
  ScaleStop,
  ScaleSemanticSurfaceRole,
  SemanticSurfaceOverrides,
  SemanticSurfaceReference,
  SemanticSurfaceRole,
  StyleflowConfig,
  ThemeMode
} from "../../shared/types.js";
import { contrastRatio } from "../../core/colors/contrast.js";
import { generateColorRamp } from "../../core/colors/ramp.js";
import { hexToRgba } from "../../core/colors/convert.js";
import { automaticAccentTone, enabledColorTones } from "../../config/selectors.js";

export function getSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: "surface-scrim"
): BrandAlphaReference;
export function getSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: ScaleSemanticSurfaceRole
): BrandColorReference;
export function getSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: SemanticSurfaceRole
): SemanticSurfaceReference;
export function getSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: SemanticSurfaceRole
): SemanticSurfaceReference {
  return config.semanticSurfaces[theme]?.[tone]?.[intensity]?.[role] ?? defaultSemanticSurfaceRef(config, theme, tone, intensity, role);
}

export function setSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: "surface-scrim",
  ref: BrandAlphaReference
): StyleflowConfig;
export function setSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: ScaleSemanticSurfaceRole,
  ref: BrandColorReference
): StyleflowConfig;
export function setSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: SemanticSurfaceRole,
  ref: SemanticSurfaceReference
): StyleflowConfig {
  const next = cloneConfig(config);
  const themeConfig = next.semanticSurfaces[theme] ?? {};
  const toneConfig = themeConfig[tone] ?? {};
  const intensityConfig = toneConfig[intensity] ?? {};
  (intensityConfig as Partial<Record<SemanticSurfaceRole, SemanticSurfaceReference>>)[role] = ref;
  toneConfig[intensity] = intensityConfig;
  themeConfig[tone] = toneConfig;
  next.semanticSurfaces[theme] = themeConfig;
  return next;
}

export function cloneSemanticSurfacesFromTone(
  config: StyleflowConfig,
  theme: ThemeMode,
  targetTone: ColorTone,
  sourceTone: ColorTone
): StyleflowConfig {
  const next = cloneConfig(config);
  const themeConfig = next.semanticSurfaces[theme] ?? {};
  const sourceConfig = themeConfig[sourceTone] ?? {};
  const targetConfig: NonNullable<NonNullable<SemanticSurfaceOverrides[ThemeMode]>[ColorTone]> = {};
  for (const intensity of COLOR_INTENSITIES) {
    const sourceIntensityConfig = sourceConfig[intensity] ?? {};
    const targetIntensityConfig: NonNullable<NonNullable<NonNullable<SemanticSurfaceOverrides[ThemeMode]>[ColorTone]>[ColorIntensity]> = {};
    for (const role of SEMANTIC_SURFACE_ROLES) {
      const sourceRef = sourceIntensityConfig[role] ?? defaultSemanticSurfaceRef(config, theme, sourceTone, intensity, role);
      (targetIntensityConfig as Partial<Record<SemanticSurfaceRole, SemanticSurfaceReference>>)[role] =
        sourceRef.tone === sourceTone ? Object.assign({}, sourceRef, { tone: targetTone }) : sourceRef;
    }
    targetConfig[intensity] = targetIntensityConfig;
  }
  themeConfig[targetTone] = targetConfig;
  next.semanticSurfaces[theme] = themeConfig;
  return next;
}

export function semanticRefToHex(config: StyleflowConfig, ref: SemanticSurfaceReference, theme: ThemeMode = "light"): string {
  if ("alpha" in ref) {
    const [variant, alphaStop] = ref.alpha.split("/") as [AlphaVariant, AlphaStop];
    const sourceStop = config.colors.tones[ref.tone].alpha[theme]?.[variant] ?? config.colors.tones[ref.tone].alpha.light[variant];
    const color = generateColorRamp(config.colors.tones[ref.tone]).colors[sourceStop];
    const opacity = alphaStop === "solid" ? 1 : Number(alphaStop) / 100;
    const rgba = hexToRgba(color, opacity);
    return `rgba(${Math.round(rgba.r * 255)}, ${Math.round(rgba.g * 255)}, ${Math.round(rgba.b * 255)}, ${rgba.a})`;
  }
  const ramp = generateColorRamp(config.colors.tones[ref.tone]);
  return ramp.colors[ref.stop];
}

export function semanticPreviewContrast(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  foregroundRole: ScaleSemanticSurfaceRole
): number {
  const surface = getSemanticSurfaceRef(config, theme, tone, intensity, "surface");
  const foreground = getSemanticSurfaceRef(config, theme, tone, intensity, foregroundRole);
  return contrastRatio(semanticRefToHex(config, foreground, theme), semanticRefToHex(config, surface, theme));
}

export function defaultSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: "surface-scrim"
): BrandAlphaReference;
export function defaultSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: ScaleSemanticSurfaceRole
): BrandColorReference;
export function defaultSemanticSurfaceRef(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  role: SemanticSurfaceRole
): SemanticSurfaceReference;
export function defaultSemanticSurfaceRef(config: StyleflowConfig, theme: ThemeMode, tone: ColorTone, intensity: ColorIntensity, role: SemanticSurfaceRole): SemanticSurfaceReference {
  const surfaceStop = surfaceStopForIntensity(theme, intensity);
  if (role === "surface") {
    return { tone, stop: surfaceStop };
  }
  if (role === "surface-scrim") {
    return { tone, alpha: "soft/40" };
  }
  if (role === "border" || role === "border-soft") {
    return { tone, stop: adjacentStop(surfaceStop, theme === "dark" ? -1 : 1) };
  }
  if (role === "border-strong") {
    return { tone, stop: adjacentStop(surfaceStop, theme === "dark" ? -2 : 2) };
  }
  if (role === "border-accent" || role === "foreground-accent") {
    const accent = automaticAccentTone(config);
    return { tone: tone === accent ? "main" : accent, stop: "600" };
  }
  if (role === "foreground-muted") {
    return { tone, stop: "400" };
  }
  if (role === "foreground-tertiary") {
    return { tone, stop: Number(intensity) >= 6 ? "300" : "700" };
  }
  if (role === "foreground-secondary") {
    return { tone, stop: Number(intensity) >= 6 ? "200" : "800" };
  }
  return { tone, stop: theme === "dark" ? (Number(intensity) >= 6 ? "950" : "050") : (Number(intensity) >= 6 ? "050" : "950") };
}

export function brandToneOptions(config: StyleflowConfig): ColorTone[] {
  return enabledColorTones(config);
}

export function brandStopOptions(): ScaleStop[] {
  return SCALE_STOPS.slice();
}

export function brandAlphaOptions(_tone?: ColorTone): BrandAlphaReference["alpha"][] {
  return BRAND_ALPHA_TOKENS.slice();
}

function surfaceStopForIntensity(theme: ThemeMode, intensity: ColorIntensity): ScaleStop {
  const light: Record<ColorIntensity, ScaleStop> = {
    "1": "000",
    "2": "050",
    "3": "100",
    "4": "200",
    "5": "300",
    "6": "500",
    "7": "600",
    "8": "700",
    "9": "900",
    "10": "950"
  };
  const dark: Record<ColorIntensity, ScaleStop> = {
    "1": "1000", "2": "950", "3": "900", "4": "800", "5": "700",
    "6": "600", "7": "500", "8": "300", "9": "100", "10": "050"
  };
  return (theme === "dark" ? dark : light)[intensity];
}

function adjacentStop(stop: ScaleStop, amount: number): ScaleStop {
  const index = SCALE_STOPS.indexOf(stop);
  return SCALE_STOPS[Math.max(0, Math.min(SCALE_STOPS.length - 1, index + amount))];
}

function cloneConfig(config: StyleflowConfig): StyleflowConfig {
  return JSON.parse(JSON.stringify(config)) as StyleflowConfig;
}

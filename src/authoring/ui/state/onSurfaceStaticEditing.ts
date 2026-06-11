import { COLOR_INTENSITIES, ON_SURFACE_STATIC_KINDS } from "../../shared/constants.js";
import type {
  ColorIntensity,
  ColorTone,
  OnSurfaceStaticConfig,
  OnSurfaceStaticKind,
  SemanticColorReference,
  StyleflowConfig
} from "../../shared/types.js";
import { defaultOnSurfaceStaticRef } from "../../config/onSurfaceDefaults.js";

export function getOnSurfaceStaticRef(
  config: StyleflowConfig,
  tone: ColorTone,
  intensity: ColorIntensity,
  kind: OnSurfaceStaticKind
): SemanticColorReference {
  return config.onSurfaceStatic[tone]?.[intensity]?.[kind] || defaultOnSurfaceStaticRef(tone, intensity, kind);
}

export function setOnSurfaceStaticRef(
  config: StyleflowConfig,
  tone: ColorTone,
  intensity: ColorIntensity,
  kind: OnSurfaceStaticKind,
  ref: SemanticColorReference
): StyleflowConfig {
  const next = cloneConfig(config);
  const toneConfig = next.onSurfaceStatic[tone] || {};
  const intensityConfig = toneConfig[intensity] || {};
  intensityConfig[kind] = ref;
  toneConfig[intensity] = intensityConfig;
  next.onSurfaceStatic[tone] = toneConfig;
  return next;
}

export function cloneOnSurfaceStaticFromTone(config: StyleflowConfig, targetTone: ColorTone, sourceTone: ColorTone): StyleflowConfig {
  const next = cloneConfig(config);
  const targetConfig: NonNullable<OnSurfaceStaticConfig[ColorTone]> = {};
  for (const intensity of COLOR_INTENSITIES) {
    targetConfig[intensity] = {};
    for (const kind of ON_SURFACE_STATIC_KINDS) {
      const sourceRef = getOnSurfaceStaticRef(config, sourceTone, intensity, kind);
      targetConfig[intensity][kind] = sourceRef.tone === sourceTone ? { tone: targetTone, intensity: sourceRef.intensity } : sourceRef;
    }
  }
  next.onSurfaceStatic[targetTone] = targetConfig;
  return next;
}

function cloneConfig(config: StyleflowConfig): StyleflowConfig {
  return JSON.parse(JSON.stringify(config)) as StyleflowConfig;
}

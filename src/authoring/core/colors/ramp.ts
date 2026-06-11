import { ALPHA_STOPS, SCALE_STOPS } from "../../shared/constants.js";
import type { AlphaStop, ColorRampConfig, RgbaValue, ScaleStop } from "../../shared/types.js";
import { hexToOklch, hexToRgba, oklchToHex } from "./convert.js";

const LIGHTNESS_BY_STOP: Record<ScaleStop, number> = {
  "000": 1,
  "050": 0.97,
  "100": 0.93,
  "200": 0.86,
  "300": 0.78,
  "400": 0.7,
  "500": 0.62,
  "600": 0.54,
  "700": 0.46,
  "800": 0.38,
  "900": 0.29,
  "950": 0.2,
  "1000": 0
};

export interface GeneratedRamp {
  chromaticName: string;
  baseStop: ScaleStop;
  colors: Record<ScaleStop, string>;
  alpha: Record<AlphaStop, RgbaValue>;
}

export function generateColorRamp(config: ColorRampConfig): GeneratedRamp {
  const base = hexToOklch(config.baseHex);
  const baseStop = closestScaleStop(base.l);
  const colors = {} as Record<ScaleStop, string>;
  for (const stop of SCALE_STOPS) {
    if (config.overrides?.[stop]) {
      colors[stop] = config.overrides[stop];
      continue;
    }
    if (stop === "000") {
      colors[stop] = "#ffffff";
      continue;
    }
    if (stop === "1000") {
      colors[stop] = "#000000";
      continue;
    }
    if (stop === baseStop) {
      colors[stop] = normalizeHex(config.baseHex);
      continue;
    }
    const lightness = LIGHTNESS_BY_STOP[stop];
    const chroma = base.c * chromaDamping(lightness);
    colors[stop] = oklchToHex({ l: lightness, c: chroma, h: base.h });
  }
  return {
    chromaticName: config.chromaticName,
    baseStop,
    colors,
    alpha: generateAlphaScale(config.baseHex)
  };
}

export function generateAlphaScale(hex: string): Record<AlphaStop, RgbaValue> {
  const alpha = {} as Record<AlphaStop, RgbaValue>;
  for (const stop of ALPHA_STOPS) {
    alpha[stop] = stop === "solid" ? hexToRgba(hex, 1) : hexToRgba(hex, Number(stop) / 100);
  }
  return alpha;
}

export function closestScaleStop(lightness: number): ScaleStop {
  const candidates = SCALE_STOPS.filter((stop) => stop !== "000" && stop !== "1000");
  return candidates.sort((a, b) => Math.abs(LIGHTNESS_BY_STOP[a] - lightness) - Math.abs(LIGHTNESS_BY_STOP[b] - lightness))[0];
}

export function getLightnessForStop(stop: ScaleStop): number {
  return LIGHTNESS_BY_STOP[stop];
}

function chromaDamping(lightness: number): number {
  return Math.max(0, Math.sin(Math.PI * lightness)) ** 0.72;
}

function normalizeHex(hex: string): string {
  return `#${hex.trim().replace("#", "").toLowerCase()}`;
}


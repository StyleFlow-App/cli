import type { RgbaValue } from "../../shared/types.js";

export interface Rgb255 {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function hexToRgb(hex: string): Rgb255 {
  const normalized = hex.trim().replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

export function rgbToHex(rgb: Rgb255): string {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function hexToRgba(hex: string, alpha = 1): RgbaValue {
  const rgb = hexToRgb(hex);
  return {
    r: round(rgb.r / 255),
    g: round(rgb.g / 255),
    b: round(rgb.b / 255),
    a: round(alpha)
  };
}

export function rgbaToHex(rgba: RgbaValue): string {
  return rgbToHex({
    r: Math.round(clamp01(rgba.r) * 255),
    g: Math.round(clamp01(rgba.g) * 255),
    b: Math.round(clamp01(rgba.b) * 255)
  });
}

export function hexToOklch(hex: string): Oklch {
  return rgbToOklch(hexToRgb(hex));
}

export function rgbToOklch(rgb: Rgb255): Oklch {
  const r = srgbToLinear(rgb.r / 255);
  const g = srgbToLinear(rgb.g / 255);
  const b = srgbToLinear(rgb.b / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const labL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.sqrt(a * a + labB * labB);
  const h = normalizeHue((Math.atan2(labB, a) * 180) / Math.PI);

  return { l: labL, c, h };
}

export function oklchToRgb(oklch: Oklch): Rgb255 {
  const hRadians = (oklch.h * Math.PI) / 180;
  const a = oklch.c * Math.cos(hRadians);
  const b = oklch.c * Math.sin(hRadians);

  const lPrime = oklch.l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = oklch.l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = oklch.l - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime * lPrime * lPrime;
  const m = mPrime * mPrime * mPrime;
  const s = sPrime * sPrime * sPrime;

  const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linearB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: Math.round(clamp01(linearToSrgb(linearR)) * 255),
    g: Math.round(clamp01(linearToSrgb(linearG)) * 255),
    b: Math.round(clamp01(linearToSrgb(linearB)) * 255)
  };
}

export function oklchToHex(oklch: Oklch): string {
  return rgbToHex(oklchToRgb(toGamut(oklch)));
}

export function toGamut(oklch: Oklch): Oklch {
  if (isInGamut(oklch)) {
    return oklch;
  }
  let low = 0;
  let high = oklch.c;
  let candidate = Object.assign({}, oklch, { c: 0 });
  for (let i = 0; i < 24; i += 1) {
    const c = (low + high) / 2;
    const next = Object.assign({}, oklch, { c });
    if (isInGamut(next)) {
      candidate = next;
      low = c;
    } else {
      high = c;
    }
  }
  return candidate;
}

function isInGamut(oklch: Oklch): boolean {
  const hRadians = (oklch.h * Math.PI) / 180;
  const a = oklch.c * Math.cos(hRadians);
  const b = oklch.c * Math.sin(hRadians);
  const lPrime = oklch.l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = oklch.l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = oklch.l - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
  return linear.every((channel) => channel >= -0.00001 && channel <= 1.00001);
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

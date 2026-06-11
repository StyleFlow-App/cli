import { hexToRgb } from "./convert.js";

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function bestContrastingStop(backgroundHex: string, candidates: Array<{ stop: string; hex: string }>, target: number): string {
  const passing = candidates
    .map((candidate) => Object.assign({}, candidate, { ratio: contrastRatio(candidate.hex, backgroundHex) }))
    .filter((candidate) => candidate.ratio >= target)
    .sort((a, b) => a.ratio - b.ratio);
  if (passing[0]) {
    return passing[0].stop;
  }
  return candidates
    .map((candidate) => Object.assign({}, candidate, { ratio: contrastRatio(candidate.hex, backgroundHex) }))
    .sort((a, b) => b.ratio - a.ratio)[0].stop;
}

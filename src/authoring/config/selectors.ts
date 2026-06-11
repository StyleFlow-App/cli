import { COLOR_TONES, LAYOUT_ROLES } from "../shared/constants.js";
import type { ColorTone, LayoutRole, StyleflowConfig } from "../shared/types.js";

export function enabledColorTones(config: StyleflowConfig): ColorTone[] {
  return COLOR_TONES.filter((tone) => config.colors.tones[tone].enabled);
}

export function enabledLayoutRoles(config: StyleflowConfig): LayoutRole[] {
  return LAYOUT_ROLES.filter((role) => config.layoutRoles.includes(role));
}

export function automaticAccentTone(config: StyleflowConfig): ColorTone {
  return config.colors.tones.accent.enabled ? "accent" : "main";
}

export function isFeedbackTone(tone: ColorTone): tone is "success" | "warning" | "critical" {
  return tone === "success" || tone === "warning" || tone === "critical";
}

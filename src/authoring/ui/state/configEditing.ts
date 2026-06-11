import type { AlphaVariant, BreakpointName, ColorTone, LayoutRole, LayoutValueRef, ScaleStop, StyleflowConfig, ThemeMode, TypographyFontSlot } from "../../shared/types.js";
import { LAYOUT_ROLES, THEME_MODES } from "../../shared/constants.js";
import { isInheritedLayoutRef } from "../../core/layout/inheritance.js";
import { ensureDimensionScaleEntry } from "../../core/layout/scaleCatalog.js";
import { resolveTypographyValue, type TypographyBreakpointField } from "../../core/typography/inheritance.js";
import { validateConfig } from "../../validation/configValidation.js";

export function updateProject(config: StyleflowConfig, field: "name" | "icon", value: string): StyleflowConfig {
  return { ...config, project: { ...config.project, [field]: value } };
}

export function updateTone(config: StyleflowConfig, tone: ColorTone, field: "baseHex" | "chromaticName", value: string): StyleflowConfig {
  return {
    ...config,
    colors: { ...config.colors, tones: { ...config.colors.tones, [tone]: { ...config.colors.tones[tone], [field]: value } } }
  };
}

export function updateToneAlpha(config: StyleflowConfig, tone: ColorTone, theme: ThemeMode, variant: AlphaVariant, value: ScaleStop): StyleflowConfig {
  const toneConfig = config.colors.tones[tone];
  return {
    ...config,
    colors: {
      ...config.colors,
      tones: {
        ...config.colors.tones,
        [tone]: {
          ...toneConfig,
          alpha: {
            ...toneConfig.alpha,
            [theme]: {
              ...toneConfig.alpha[theme],
              [variant]: value
            }
          }
        }
      }
    }
  };
}

export function toneDisableDependencies(config: StyleflowConfig, tone: ColorTone): string[] {
  if (tone === "main" || tone === "neutral" || !config.colors.tones[tone].enabled) {
    return [];
  }
  const candidate = setToneEnabledRaw(config, tone, false);
  return validateConfig(candidate)
    .filter((issue) => issue.message === "Referenced color must be enabled." && issue.path.indexOf(`.${tone}`) === -1)
    .map((issue) => issue.path);
}

export function setToneEnabled(config: StyleflowConfig, tone: ColorTone, enabled: boolean): StyleflowConfig {
  if (!enabled && (tone === "main" || tone === "neutral" || toneDisableDependencies(config, tone).length > 0)) {
    return config;
  }
  return setToneEnabledRaw(config, tone, enabled);
}

function setToneEnabledRaw(config: StyleflowConfig, tone: ColorTone, enabled: boolean): StyleflowConfig {
  return {
    ...config,
    colors: { ...config.colors, tones: { ...config.colors.tones, [tone]: { ...config.colors.tones[tone], enabled } } }
  };
}

export function setThemeEnabled(config: StyleflowConfig, theme: ThemeMode, enabled: boolean): StyleflowConfig {
  if (!enabled && config.themes.length === 1) {
    return config;
  }
  const themes = THEME_MODES.filter((value) => enabled ? value === theme || config.themes.includes(value) : value !== theme && config.themes.includes(value));
  return { ...config, themes };
}

export function setLayoutRoleEnabled(config: StyleflowConfig, role: LayoutRole, enabled: boolean): StyleflowConfig {
  if (!enabled && role === "none") {
    return config;
  }
  const layoutRoles = LAYOUT_ROLES.filter((value) => enabled ? value === role || config.layoutRoles.includes(value) : value !== role && config.layoutRoles.includes(value));
  return { ...config, layoutRoles };
}

export function updateTypographyRole(
  config: StyleflowConfig,
  roleName: string,
  field: "fontSlotId" | "defaultWeight",
  value: string
): StyleflowConfig {
  const current = config.typography.roles[roleName];
  const nextRole = { ...current, [field]: value };
  if (field === "fontSlotId") {
    const slot = config.typography.fonts.find((font) => font.enabled && font.id === value);
    if (slot && !slot.enabledWeights.includes(nextRole.defaultWeight)) {
      nextRole.defaultWeight = slot.strongWeight;
    }
  }
  return {
    ...config,
    typography: { ...config.typography, roles: { ...config.typography.roles, [roleName]: nextRole } }
  };
}

export function updateTypographyBreakpointRef(
  config: StyleflowConfig,
  roleName: string,
  field: TypographyBreakpointField,
  breakpoint: BreakpointName,
  ref: LayoutValueRef
): StyleflowConfig {
  const base = "scale" in ref ? ensureDimensionScaleEntry(config, ref.scale) : config;
  const role = base.typography.roles[roleName];
  return {
    ...base,
    typography: {
      ...base.typography,
      roles: {
        ...base.typography.roles,
        [roleName]: {
          ...role,
          [field]: { ...role[field], [breakpoint]: ref }
        }
      }
    }
  };
}

export function setTypographyBreakpointInheritance(
  config: StyleflowConfig,
  roleName: string,
  breakpoint: BreakpointName,
  enabled: boolean
): StyleflowConfig {
  if (breakpoint === "xs" || !config.typography.roles[roleName]) {
    return config;
  }
  const role = config.typography.roles[roleName];
  return {
    ...config,
    typography: {
      ...config.typography,
      roles: {
        ...config.typography.roles,
        [roleName]: {
          ...role,
          size: {
            ...role.size,
            [breakpoint]: enabled ? { inherit: true } : resolveTypographyValue(config, roleName, "size", breakpoint)
          },
          lineHeight: {
            ...role.lineHeight,
            [breakpoint]: enabled ? { inherit: true } : resolveTypographyValue(config, roleName, "lineHeight", breakpoint)
          }
        }
      }
    }
  };
}

export function isTypographyBreakpointInherited(config: StyleflowConfig, roleName: string, breakpoint: BreakpointName): boolean {
  if (breakpoint === "xs") {
    return false;
  }
  const role = config.typography.roles[roleName];
  return Boolean(role && isInheritedLayoutRef(role.size[breakpoint]) && isInheritedLayoutRef(role.lineHeight[breakpoint]));
}

export function updateTypographyFont(config: StyleflowConfig, id: string, updates: Partial<TypographyFontSlot>): StyleflowConfig {
  return {
    ...config,
    typography: { ...config.typography, fonts: config.typography.fonts.map((font) => font.id === id ? { ...font, ...updates } : font) }
  };
}

export function addTypographyFont(config: StyleflowConfig): StyleflowConfig {
  const number = config.typography.fonts.filter((font) => font.id.indexOf("font-") === 0).length + 1;
  const slot: TypographyFontSlot = {
    id: `font-${number}`,
    label: `Font ${number}`,
    enabled: true,
    family: "Inter",
    enabledWeights: ["Light", "Regular", "Semi Bold"],
    lightWeight: "Light",
    strongWeight: "Semi Bold"
  };
  return { ...config, typography: { ...config.typography, fonts: config.typography.fonts.concat(slot) } };
}

export function fontSlotDependencies(config: StyleflowConfig, id: string): string[] {
  return Object.entries(config.typography.roles).filter(([, role]) => role.fontSlotId === id).map(([name]) => name);
}

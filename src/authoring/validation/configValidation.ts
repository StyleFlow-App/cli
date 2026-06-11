import {
  BREAKPOINTS,
  ALPHA_VARIANTS,
  BRAND_ALPHA_TOKENS,
  COLOR_TONES,
  LAYOUT_DENSITIES,
  LAYOUT_PROPERTIES,
  LAYOUT_ROLES,
  REQUIRED_COLOR_TONES,
  SCALE_STOPS,
  SEMANTIC_SURFACE_ROLES
} from "../shared/constants.js";
import type { LayoutRole, LayoutValueRef, StyleflowConfig, ValidationIssue } from "../shared/types.js";
import { enabledColorTones, enabledLayoutRoles } from "../config/selectors.js";
import { canInheritLayoutProperty, isInheritedLayoutRef, previousBreakpointOf, resolveLayoutValue } from "../core/layout/inheritance.js";
import { dimensionScaleOptions } from "../core/layout/scaleCatalog.js";
import { resolveTypographyValue, type TypographyBreakpointField } from "../core/typography/inheritance.js";
import { validateOnSurfaceConfig } from "./onSurfaceValidation.js";

export function validateConfig(config: StyleflowConfig): ValidationIssue[] {
  return validateProject(config).concat(
    validateColors(config),
    validateThemesAndRoles(config),
    validateSemanticSurfaces(config),
    validateOnSurfaceConfig(config),
    validateDimensions(config),
    validateTypography(config)
  );
}

function validateProject(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!config.project.name.trim()) {
    issues.push(error("project.name", "Project name is required."));
  }
  if (!config.project.icon.trim()) {
    issues.push(error("project.icon", "Project icon is required."));
  }
  return issues;
}

function validateThemesAndRoles(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (config.themes.length === 0) {
    issues.push(error("themes", "At least one theme must be enabled."));
  }
  if (!config.layoutRoles.includes("none")) {
    issues.push(error("layoutRoles", "The none layout role must remain enabled."));
  }
  return issues;
}

function validateSemanticSurfaces(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enabled = new Set(enabledColorTones(config));
  for (const [theme, tones] of Object.entries(config.semanticSurfaces)) {
    if (!config.themes.includes(theme as (typeof config.themes)[number])) {
      continue;
    }
    for (const [tone, intensities] of Object.entries(tones ?? {})) {
      if (!enabled.has(tone as never)) {
        continue;
      }
      for (const [intensity, roles] of Object.entries(intensities ?? {})) {
        if (!["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].includes(intensity)) {
          issues.push(error(`semanticSurfaces.${theme}.${tone}.${intensity}`, "Semantic surface intensity must be 1-10."));
        }
        for (const [role, ref] of Object.entries(roles ?? {})) {
          if (!SEMANTIC_SURFACE_ROLES.includes(role as never)) {
            issues.push(error(`semanticSurfaces.${theme}.${tone}.${intensity}.${role}`, "Semantic surface role is not supported."));
            continue;
          }
          if (!isObject(ref)) {
            issues.push(error(`semanticSurfaces.${theme}.${tone}.${intensity}.${role}`, "Semantic surface reference is not supported."));
            continue;
          }
          if (!enabled.has(ref.tone as never)) {
            issues.push(error(`semanticSurfaces.${theme}.${tone}.${intensity}.${role}.tone`, "Referenced color must be enabled."));
          }
          if (role === "surface-scrim") {
            if (!BRAND_ALPHA_TOKENS.includes(ref.alpha as never)) {
              issues.push(error(`semanticSurfaces.${theme}.${tone}.${intensity}.${role}.alpha`, "Brand color alpha reference is not supported."));
            }
          } else if (!SCALE_STOPS.includes(ref.stop as never)) {
            issues.push(error(`semanticSurfaces.${theme}.${tone}.${intensity}.${role}.stop`, "Brand color reference stop is not supported."));
          }
        }
      }
    }
  }
  return issues;
}

function validateColors(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const tone of REQUIRED_COLOR_TONES) {
    if (!config.colors.tones[tone]?.enabled) {
      issues.push(error(`colors.tones.${tone}.enabled`, `${tone} must remain enabled.`));
    }
  }
  for (const tone of COLOR_TONES) {
    const toneConfig = config.colors.tones[tone];
    if (!toneConfig) {
      issues.push(error(`colors.tones.${tone}`, `${tone} tone is missing.`));
      continue;
    }
    if (!isKebabName(toneConfig.chromaticName)) {
      issues.push(error(`colors.tones.${tone}.chromaticName`, "Chromatic names must use kebab-case."));
    }
    if (!isHexColor(toneConfig.baseHex)) {
      issues.push(error(`colors.tones.${tone}.baseHex`, "Base color must be a valid hex color."));
    }
    for (const theme of config.themes) {
      for (const variant of ALPHA_VARIANTS) {
        if (!SCALE_STOPS.includes(toneConfig.alpha?.[theme]?.[variant] as never)) {
          issues.push(error(`colors.tones.${tone}.alpha.${theme}.${variant}`, "Alpha color intensity must use a 000-1000 scale stop."));
        }
      }
    }
  }
  return issues;
}

function validateDimensions(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scaleNames = new Set(dimensionScaleOptions(config).map((entry) => entry.name));
  const containerNames = new Set(config.dimensions.containerScale.map((entry) => entry.name));
  const strokeNames = new Set(config.dimensions.strokes.map((entry) => entry.name));
  for (const role of enabledLayoutRoles(config)) {
    for (const density of LAYOUT_DENSITIES) {
      for (const breakpoint of BREAKPOINTS) {
        for (const property of LAYOUT_PROPERTIES) {
          const ref = config.dimensions.layout[role]?.[density]?.[breakpoint]?.[property];
          if (!ref) {
            issues.push(error(`dimensions.layout.${role}.${density}.${breakpoint}.${property}`, "Layout value is missing."));
            continue;
          }
          issues.push.apply(issues, validateLayoutRef(config, ref, scaleNames, strokeNames, containerNames, role, density, breakpoint, property, `dimensions.layout.${role}.${density}.${breakpoint}.${property}`));
        }
      }
    }
  }
  return issues;
}

function validateTypography(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scaleNames = new Set(dimensionScaleOptions(config).map((entry) => entry.name));
  const enabledSlots = new Map(config.typography.fonts.filter((slot) => slot.enabled).map((slot) => [slot.id, slot]));
  const main = enabledSlots.get("main");
  if (!main) {
    issues.push(error("typography.fonts.main", "Main font must remain enabled."));
  }
  for (const slot of enabledSlots.values()) {
    if (!slot.family.trim()) {
      issues.push(error(`typography.fonts.${slot.id}.family`, "Font family is required."));
    }
    if (!slot.enabledWeights.includes(slot.lightWeight) || !slot.enabledWeights.includes(slot.strongWeight)) {
      issues.push(error(`typography.fonts.${slot.id}.weights`, "Light and strong weights must be enabled in the font slot."));
    }
  }
  for (const [roleName, role] of Object.entries(config.typography.roles)) {
    if (!isKebabName(roleName)) {
      issues.push(error(`typography.roles.${roleName}`, "Typography role names must use kebab-case."));
    }
    const slot = enabledSlots.get(role.fontSlotId);
    if (!slot) {
      issues.push(error(`typography.roles.${roleName}.fontSlotId`, "Typography role must use an enabled font slot."));
    } else if (!slot.enabledWeights.includes(role.defaultWeight)) {
      issues.push(error(`typography.roles.${roleName}.defaultWeight`, "Default weight must be enabled in its font slot."));
    }
    for (const breakpoint of BREAKPOINTS) {
      issues.push.apply(issues, validateTypographyRef(config, roleName, "size", breakpoint, role.size[breakpoint], scaleNames, `typography.roles.${roleName}.size.${breakpoint}`));
      issues.push.apply(issues, validateTypographyRef(config, roleName, "lineHeight", breakpoint, role.lineHeight[breakpoint], scaleNames, `typography.roles.${roleName}.lineHeight.${breakpoint}`));
    }
  }
  return issues;
}

function validateTypographyRef(
  config: StyleflowConfig,
  roleName: string,
  field: TypographyBreakpointField,
  breakpoint: (typeof BREAKPOINTS)[number],
  ref: LayoutValueRef,
  scaleNames: Set<string>,
  path: string
): ValidationIssue[] {
  if (isInheritedLayoutRef(ref)) {
    if (!previousBreakpointOf(breakpoint)) {
      return [error(path, "The root breakpoint xs cannot inherit typography values.")];
    }
    const resolved = resolveTypographyValue(config, roleName, field, breakpoint);
    if (isInheritedLayoutRef(resolved)) {
      return [error(path, "Inherited typography value cannot resolve to a concrete value.")];
    }
    return validateConcreteTypographyRef(resolved, scaleNames, path);
  }
  return validateConcreteTypographyRef(ref, scaleNames, path);
}

function validateConcreteTypographyRef(ref: LayoutValueRef, scaleNames: Set<string>, path: string): ValidationIssue[] {
  if ("scale" in ref && !scaleNames.has(ref.scale)) {
    return [error(path, `Unknown scale value: ${ref.scale}.`)];
  }
  if ("stroke" in ref || "container" in ref || "breakpoint" in ref || "inherit" in ref) {
    return [error(path, "Typography values must use scale tokens or finite numeric values.")];
  }
  if ("value" in ref && !Number.isFinite(ref.value)) {
    return [error(path, "Numeric values must be finite.")];
  }
  return [];
}

function validateLayoutRef(
  config: StyleflowConfig,
  ref: LayoutValueRef,
  scaleNames: Set<string>,
  strokeNames: Set<string>,
  containerNames: Set<string>,
  role: LayoutRole,
  density: (typeof LAYOUT_DENSITIES)[number],
  breakpoint: (typeof BREAKPOINTS)[number],
  property: (typeof LAYOUT_PROPERTIES)[number],
  path: string
): ValidationIssue[] {
  if (isInheritedLayoutRef(ref)) {
    if (!canInheritLayoutProperty(role, property)) {
      return [error(path, "This layout property cannot inherit values.")];
    }
    if (!previousBreakpointOf(breakpoint)) {
      return [error(path, "The root breakpoint xs cannot inherit layout values.")];
    }
    const resolved = resolveLayoutValue(config, role, density, breakpoint, property);
    if (isInheritedLayoutRef(resolved)) {
      return [error(path, "Inherited layout value cannot resolve to a concrete value.")];
    }
    return validateConcreteLayoutRef(resolved, scaleNames, strokeNames, containerNames, property, path);
  }
  return validateConcreteLayoutRef(ref, scaleNames, strokeNames, containerNames, property, path);
}

function validateConcreteLayoutRef(ref: LayoutValueRef, scaleNames: Set<string>, strokeNames: Set<string>, containerNames: Set<string>, property: (typeof LAYOUT_PROPERTIES)[number], path: string): ValidationIssue[] {
  if ("scale" in ref && !scaleNames.has(ref.scale)) {
    return [error(path, `Unknown scale value: ${ref.scale}.`)];
  }
  if ("stroke" in ref && !strokeNames.has(ref.stroke)) {
    return [error(path, `Unknown stroke value: ${ref.stroke}.`)];
  }
  if ("container" in ref && !containerNames.has(ref.container)) {
    return [error(path, `Unknown container max-width value: ${ref.container}.`)];
  }
  if ("container" in ref && property !== "container-max-width") {
    return [error(path, "Container scale values can only be used for container-max-width.")];
  }
  if ("stroke" in ref && property !== "border-width") {
    return [error(path, "Stroke values can only be used for border-width.")];
  }
  if ("scale" in ref && (property === "border-width" || property === "container-max-width")) {
    return [error(path, `Scale values cannot be used for ${property}.`)];
  }
  if ("value" in ref && !Number.isFinite(ref.value)) {
    return [error(path, "Numeric values must be finite.")];
  }
  return [];
}

function error(path: string, message: string): ValidationIssue {
  return { level: "error", path, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexColor(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim()) || /^#?[0-9a-fA-F]{3}$/.test(value.trim());
}

function isKebabName(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

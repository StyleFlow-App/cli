import {
  BRAND_COLOR_TOKENS,
  COLOR_INTENSITIES,
  INTERACTIVE_PALETTE_ROLES,
  INTERACTIVE_PRIORITIES,
  INTERACTIVE_STATES,
  INTERACTIVE_VARIANTS,
  ON_SURFACE_STATIC_KINDS
} from "../shared/constants.js";
import { enabledColorTones } from "../config/selectors.js";
import type { InteractiveSlotReference, PriorityMappingScope, StyleflowConfig, ValidationIssue } from "../shared/types.js";

export function validateOnSurfaceConfig(config: StyleflowConfig): ValidationIssue[] {
  return validateStatic(config).concat(validateInteractivePalette(config), validateGlobalMap(config), validatePriorityMap(config));
}

function validateStatic(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tones = enabledColorTones(config);
  const enabled = new Set(tones);
  for (const tone of tones) {
    for (const intensity of COLOR_INTENSITIES) {
      for (const kind of ON_SURFACE_STATIC_KINDS) {
        const ref = config.onSurfaceStatic[tone]?.[intensity]?.[kind];
        const path = `onSurfaceStatic.${tone}.${intensity}.${kind}`;
        if (!ref) {
          issues.push(error(path, "On-surface static reference is missing."));
        } else if (!enabled.has(ref.tone)) {
          issues.push(error(`${path}.tone`, "Referenced color must be enabled."));
        }
      }
    }
  }
  return issues;
}

function validateInteractivePalette(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tones = enabledColorTones(config);
  const enabled = new Set(tones);
  for (const theme of config.themes) {
    for (const tone of tones) {
      for (const variant of INTERACTIVE_VARIANTS) {
        for (const state of INTERACTIVE_STATES) {
          const path = `onSurfaceInteractive.palette.${theme}.${tone}.${variant}.${state}`;
          const refs = config.onSurfaceInteractive.palette[theme]?.[tone]?.[variant]?.[state];
          for (const role of INTERACTIVE_PALETTE_ROLES) {
            const ref = refs?.[role];
            if (!ref) {
              issues.push(error(`${path}.${role}`, "Interactive palette role reference is missing."));
            } else if (!enabled.has(ref.tone)) {
              issues.push(error(`${path}.${role}.tone`, "Referenced color must be enabled."));
            } else if (!BRAND_COLOR_TOKENS.includes(ref.token as never)) {
              issues.push(error(`${path}.${role}.token`, "Brand color token is not supported."));
            }
          }
        }
      }
    }
  }
  return issues;
}

function validateGlobalMap(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const enabled = new Set(enabledColorTones(config));
  for (const scope of activeMappingScopes(config)) {
    for (const priority of INTERACTIVE_PRIORITIES) {
      validateSlot(config.onSurfaceInteractive.globalPriorityMap[scope]?.[priority], `onSurfaceInteractive.globalPriorityMap.${scope}.${priority}`, enabled, issues);
    }
  }
  return issues;
}

function validatePriorityMap(config: StyleflowConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tones = enabledColorTones(config);
  const enabled = new Set(tones);
  for (const tone of tones) {
    for (const intensity of COLOR_INTENSITIES) {
      for (const priority of INTERACTIVE_PRIORITIES) {
        const row = config.onSurfaceInteractive.priorityMap[tone]?.[intensity]?.[priority];
        const path = `onSurfaceInteractive.priorityMap.${tone}.${intensity}.${priority}`;
        if (!row) {
          issues.push(error(path, "Interactive priority mapping is missing."));
        } else if (!row.useGlobalMapping) {
          for (const scope of activeMappingScopes(config)) {
            validateSlot(row.mapping[scope], `${path}.mapping.${scope}`, enabled, issues);
          }
        }
      }
    }
  }
  return issues;
}

function activeMappingScopes(config: StyleflowConfig): PriorityMappingScope[] {
  return config.onSurfaceInteractive.priorityMappingMode === "themed" ? config.themes : ["shared"];
}

function validateSlot(ref: InteractiveSlotReference | undefined, path: string, enabled: Set<string>, issues: ValidationIssue[]): void {
  if (!ref) {
    issues.push(error(path, "Interactive slot reference is missing."));
  } else if (!enabled.has(ref.tone)) {
    issues.push(error(`${path}.tone`, "Referenced color must be enabled."));
  } else if (!INTERACTIVE_VARIANTS.includes(ref.variant)) {
    issues.push(error(`${path}.variant`, "Interactive slot variant is not supported."));
  }
}

function error(path: string, message: string): ValidationIssue {
  return { level: "error", path, message };
}

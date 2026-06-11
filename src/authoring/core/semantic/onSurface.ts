import {
  COLLECTION_NAMES,
  COLOR_INTENSITIES,
  INTERACTIVE_PRIORITIES,
  INTERACTIVE_STATES,
  INTERACTIVE_VARIANTS,
  ON_SURFACE_INTERACTIVE_ROLES,
  ON_SURFACE_STATIC_KINDS,
  ON_SURFACE_STATIC_ROLES,
  ON_SURFACE_STATIC_ROLE_TO_LOCAL_ROLE
} from "../../shared/constants.js";
import type {
  CollectionSpec,
  ColorIntensity,
  ColorTone,
  InteractiveBrandColorReference,
  InteractivePaletteRole,
  InteractivePriority,
  InteractiveSlotReference,
  InteractiveState,
  InteractiveVariant,
  OnSurfaceInteractiveRole,
  OnSurfaceStaticRole,
  PriorityMappingScope,
  StyleflowConfig,
  ThemeMode
} from "../../shared/types.js";
import { enabledColorTones } from "../../config/selectors.js";
import { defaultInteractiveGlobalPriorityRef, defaultInteractivePaletteRef } from "../../config/onSurfaceDefaults.js";
import { addVariable, alias, createCollection } from "../tokens/model.js";

export interface OnSurfacePayloadOptions {
  staticCollectionName: string;
  staticModes: string[];
  interactiveCollectionName: string;
}

export function generateOnSurfacePayloadCollections(
  config: StyleflowConfig,
  options: OnSurfacePayloadOptions
): CollectionSpec[] {
  return [
    generateStaticCollection(config, options.staticCollectionName, options.staticModes),
    generateInteractiveCollection(config, options.interactiveCollectionName)
  ];
}

export function generateInteractiveContextCollections(config: StyleflowConfig, interactiveCollectionName: string): CollectionSpec[] {
  return INTERACTIVE_PRIORITIES.map((priority) => generateInteractiveContextCollection(config, priority, interactiveCollectionName));
}

function generateStaticCollection(config: StyleflowConfig, collectionName: string, modes: string[]): CollectionSpec {
  const collection = createCollection(collectionName, modes);
  for (const tone of enabledColorTones(config)) {
    for (const intensity of COLOR_INTENSITIES) {
      for (const kind of ON_SURFACE_STATIC_KINDS) {
        const target = config.onSurfaceStatic[tone]?.[intensity]?.[kind] || { tone, intensity };
        for (const role of ON_SURFACE_STATIC_ROLES) {
          addVariable(collection, `${tone}/${intensity}/${kind}/${role}`, "COLOR", aliasForModes(modes, COLLECTION_NAMES.semanticColor, `${target.tone}/${target.intensity}/${localRoleForStatic(role)}`));
        }
      }
    }
  }
  return collection;
}

function generateInteractiveCollection(config: StyleflowConfig, collectionName: string): CollectionSpec {
  const collection = createCollection(collectionName, config.themes);
  const tones = enabledColorTones(config);
  for (const slotTone of tones) {
    for (const variant of INTERACTIVE_VARIANTS) {
      for (const state of INTERACTIVE_STATES) {
        for (const role of ON_SURFACE_INTERACTIVE_ROLES) {
          addVariable(collection, `${slotTone}/${variant}/${state}/${role}`, "COLOR", Object.fromEntries(
            config.themes.map((theme) => [theme, brandAlias(interactiveTarget(config, theme, slotTone, variant, state, role))])
          ));
        }
      }
    }
  }
  return collection;
}

function generateInteractiveContextCollection(config: StyleflowConfig, priority: InteractivePriority, interactiveCollectionName: string): CollectionSpec {
  const themed = config.onSurfaceInteractive.priorityMappingMode === "themed";
  const modes = themed ? config.themes : ["Base"];
  const collection = createCollection(interactiveContextCollectionName(priority), modes);
  for (const contextTone of enabledColorTones(config)) {
    for (const intensity of COLOR_INTENSITIES) {
      for (const state of INTERACTIVE_STATES) {
        for (const role of ON_SURFACE_INTERACTIVE_ROLES) {
          addVariable(collection, `context/${contextTone}/${intensity}/${priority}/${state}/${role}`, "COLOR", Object.fromEntries(
            modes.map((mode) => {
              const scope: PriorityMappingScope = mode === "Base" ? "shared" : mode as ThemeMode;
              const target = priorityTarget(config, scope, contextTone, intensity, priority);
              return [mode, alias(interactiveCollectionName, `${target.tone}/${target.variant}/${state}/${role}`)];
            })
          ));
        }
      }
    }
  }
  return collection;
}

function aliasForModes(modes: string[], collection: string, name: string) {
  return Object.fromEntries(modes.map((mode) => [mode, alias(collection, name)]));
}

function brandAlias(ref: InteractiveBrandColorReference) {
  return alias(COLLECTION_NAMES.brandColors, `${ref.tone}/${ref.token}`);
}

function localRoleForStatic(role: OnSurfaceStaticRole): string {
  return ON_SURFACE_STATIC_ROLE_TO_LOCAL_ROLE[role];
}

function interactiveTarget(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  variant: InteractiveVariant,
  state: InteractiveState,
  role: OnSurfaceInteractiveRole
): InteractiveBrandColorReference {
  const paletteRole = role === "focus-ring" ? "border" : role as InteractivePaletteRole;
  return config.onSurfaceInteractive.palette[theme]?.[tone]?.[variant]?.[state]?.[paletteRole]
    || defaultInteractivePaletteRef(theme, tone, variant, state, paletteRole);
}

export function priorityTarget(
  config: StyleflowConfig,
  scope: PriorityMappingScope,
  tone: ColorTone,
  intensity: ColorIntensity,
  priority: InteractivePriority
): InteractiveSlotReference {
  const global = config.onSurfaceInteractive.globalPriorityMap[scope]?.[priority] || defaultInteractiveGlobalPriorityRef(scope, priority);
  const mapping = config.onSurfaceInteractive.priorityMap[tone]?.[intensity]?.[priority];
  return mapping?.useGlobalMapping === false ? mapping.mapping[scope] || global : global;
}

export function interactiveContextCollectionName(priority: InteractivePriority): string {
  if (priority === "primary") {
    return COLLECTION_NAMES.onSurfaceInteractivePrimary;
  }
  if (priority === "secondary") {
    return COLLECTION_NAMES.onSurfaceInteractiveSecondary;
  }
  return COLLECTION_NAMES.onSurfaceInteractiveTertiary;
}

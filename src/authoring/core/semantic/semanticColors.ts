import {
  COLLECTION_NAMES,
  COLOR_INTENSITIES,
  INTERACTIVE_PRIORITIES,
  INTERACTIVE_STATES,
  LOCAL_COLOR_ROLES,
  ON_SURFACE_INTERACTIVE_ROLES,
  ON_SURFACE_STATIC_KINDS,
  ON_SURFACE_STATIC_ROLES,
  SEMANTIC_ROLE_TO_LOCAL_ROLE,
  SEMANTIC_SURFACE_ROLES,
  SCALE_STOPS
} from "../../shared/constants.js";
import type { CollectionSpec, ColorIntensity, ColorTone, ScaleStop, SemanticSurfaceRole, StyleflowConfig, ThemeMode } from "../../shared/types.js";
import { automaticAccentTone, enabledColorTones } from "../../config/selectors.js";
import { interactiveContextCollectionName } from "./onSurface.js";
import type { RampMap } from "../colors/colorTokens.js";
import { bestContrastingStop } from "../colors/contrast.js";
import { addVariable, alias, createCollection } from "../tokens/model.js";

const LIGHT_SURFACE_STOPS: Record<ColorIntensity, ScaleStop> = {
  "1": "000", "2": "050", "3": "100", "4": "200", "5": "300",
  "6": "500", "7": "600", "8": "700", "9": "900", "10": "950"
};

const DARK_SURFACE_STOPS: Record<ColorIntensity, ScaleStop> = {
  "1": "1000", "2": "950", "3": "900", "4": "800", "5": "700",
  "6": "600", "7": "500", "8": "300", "9": "100", "10": "050"
};

const candidateStops = SCALE_STOPS.slice();

export function generateSemanticColorCollection(config: StyleflowConfig, ramps: RampMap): CollectionSpec {
  const collection = createCollection(COLLECTION_NAMES.semanticColor, config.themes);
  for (const tone of enabledColorTones(config)) {
    for (const intensity of COLOR_INTENSITIES) {
      const values = semanticValuesForTone(config, ramps, tone, intensity);
      for (const role of LOCAL_COLOR_ROLES) {
        addVariable(
          collection,
          `${tone}/${intensity}/${role}`,
          "COLOR",
          Object.fromEntries(config.themes.map((theme) => [theme, overrideAliasForLocalRole(config, theme, tone, intensity, role) ?? values[theme][role]]))
        );
      }
    }
  }
  return collection;
}

function overrideAliasForLocalRole(
  config: StyleflowConfig,
  theme: ThemeMode,
  tone: ColorTone,
  intensity: ColorIntensity,
  localRole: (typeof LOCAL_COLOR_ROLES)[number]
) {
  const semanticRole = localRoleToSemanticRole(localRole);
  const override = semanticRole ? config.semanticSurfaces[theme]?.[tone]?.[intensity]?.[semanticRole] : undefined;
  return override ? semanticAlias(override) : undefined;
}

function localRoleToSemanticRole(localRole: (typeof LOCAL_COLOR_ROLES)[number]): SemanticSurfaceRole | undefined {
  return SEMANTIC_SURFACE_ROLES.find((role) => SEMANTIC_ROLE_TO_LOCAL_ROLE[role] === localRole);
}

export function generateColorModeCollections(config: StyleflowConfig, staticCollectionName: string = COLLECTION_NAMES.onSurfaceStatic): CollectionSpec[] {
  const tones = enabledColorTones(config);
  const colorTone = createCollection(COLLECTION_NAMES.colorTone, tones);
  for (const intensity of COLOR_INTENSITIES) {
    for (const role of LOCAL_COLOR_ROLES) {
      addVariable(
        colorTone,
        `${intensity}/${role}`,
        "COLOR",
        Object.fromEntries(tones.map((tone) => [tone, alias(COLLECTION_NAMES.semanticColor, `${tone}/${intensity}/${role}`)]))
      );
    }
    addColorToneOnSurfaceVariables(colorTone, tones, intensity, staticCollectionName);
  }

  const colorIntensity = createCollection(COLLECTION_NAMES.colorIntensity, COLOR_INTENSITIES.slice());
  for (const role of LOCAL_COLOR_ROLES) {
    addVariable(
      colorIntensity,
      role,
      "COLOR",
      Object.fromEntries(COLOR_INTENSITIES.map((intensity) => [intensity, alias(COLLECTION_NAMES.colorTone, `${intensity}/${role}`)]))
    );
  }
  addColorIntensityOnSurfaceVariables(colorIntensity);
  return [colorTone, colorIntensity];
}

function addColorToneOnSurfaceVariables(collection: CollectionSpec, tones: ColorTone[], intensity: ColorIntensity, staticCollectionName: string): void {
  for (const kind of ON_SURFACE_STATIC_KINDS) {
    for (const role of ON_SURFACE_STATIC_ROLES) {
      addVariable(
        collection,
        `${intensity}/on-surface/static/${kind}/${role}`,
        "COLOR",
        Object.fromEntries(tones.map((tone) => [tone, alias(staticCollectionName, `${tone}/${intensity}/${kind}/${role}`)]))
      );
    }
  }
  for (const priority of INTERACTIVE_PRIORITIES) {
    for (const state of INTERACTIVE_STATES) {
      for (const role of ON_SURFACE_INTERACTIVE_ROLES) {
        addVariable(
          collection,
          `${intensity}/on-surface/interactive/${priority}/${state}/${role}`,
          "COLOR",
          Object.fromEntries(tones.map((tone) => [
            tone,
            alias(interactiveContextCollectionName(priority), `context/${tone}/${intensity}/${priority}/${state}/${role}`)
          ]))
        );
      }
    }
  }
}

function addColorIntensityOnSurfaceVariables(collection: CollectionSpec): void {
  for (const kind of ON_SURFACE_STATIC_KINDS) {
    for (const role of ON_SURFACE_STATIC_ROLES) {
      addVariable(collection, `on-surface/static/${kind}/${role}`, "COLOR", Object.fromEntries(
        COLOR_INTENSITIES.map((intensity) => [intensity, alias(COLLECTION_NAMES.colorTone, `${intensity}/on-surface/static/${kind}/${role}`)])
      ));
    }
  }
  for (const priority of INTERACTIVE_PRIORITIES) {
    for (const state of INTERACTIVE_STATES) {
      for (const role of ON_SURFACE_INTERACTIVE_ROLES) {
        addVariable(collection, `on-surface/interactive/${priority}/${state}/${role}`, "COLOR", Object.fromEntries(
          COLOR_INTENSITIES.map((intensity) => [intensity, alias(COLLECTION_NAMES.colorTone, `${intensity}/on-surface/interactive/${priority}/${state}/${role}`)])
        ));
      }
    }
  }
}

function semanticValuesForTone(config: StyleflowConfig, ramps: RampMap, tone: ColorTone, intensity: ColorIntensity) {
  const ramp = ramps[tone];
  const accentTone = tone === automaticAccentTone(config) ? "main" : automaticAccentTone(config);
  const accentRamp = ramps[accentTone];
  return Object.fromEntries(
    config.themes.map((theme) => {
      const surfaceStop = theme === "dark" ? DARK_SURFACE_STOPS[intensity] : LIGHT_SURFACE_STOPS[intensity];
      const surfaceHex = ramp.colors[surfaceStop];
      const primaryStop = bestContrastingStop(surfaceHex, candidateStops.map((stop) => ({ stop, hex: ramp.colors[stop] })), 4.5) as ScaleStop;
      const secondaryStop = bestContrastingStop(surfaceHex, candidateStops.map((stop) => ({ stop, hex: ramp.colors[stop] })), 3) as ScaleStop;
      const accentStop = bestContrastingStop(surfaceHex, candidateStops.map((stop) => ({ stop, hex: accentRamp.colors[stop] })), 3) as ScaleStop;
      return [theme, {
        "local/surface": colorAlias(tone, surfaceStop),
        "local/surface-scrim": alphaAlias(tone, "soft/40"),
        "local/border": colorAlias(tone, adjacentStop(surfaceStop, theme, 1)),
        "local/border-soft": colorAlias(tone, adjacentStop(surfaceStop, theme, 1)),
        "local/border-strong": colorAlias(tone, adjacentStop(surfaceStop, theme, 2)),
        "local/border-accent": colorAlias(accentTone, accentStop),
        "local/foreground-primary": colorAlias(tone, primaryStop),
        "local/foreground-secondary": colorAlias(tone, secondaryStop),
        "local/foreground-tertiary": colorAlias(tone, softerForegroundStop(primaryStop, theme)),
        "local/foreground-muted": colorAlias(tone, theme === "dark" ? "500" : "400"),
        "local/foreground-accent": colorAlias(accentTone, accentStop)
      }];
    })
  ) as Record<ThemeMode, Record<(typeof LOCAL_COLOR_ROLES)[number], ReturnType<typeof alias>>>;
}

function colorAlias(tone: ColorTone, stop: ScaleStop) {
  return alias(COLLECTION_NAMES.brandColors, `${tone}/${stop}`);
}

function alphaAlias(tone: ColorTone, alpha: string) {
  return alias(COLLECTION_NAMES.brandColors, `${tone}/alpha/${alpha}`);
}

function semanticAlias(ref: { tone: ColorTone; stop: ScaleStop } | { tone: ColorTone; alpha: string }) {
  return "alpha" in ref ? alphaAlias(ref.tone, ref.alpha) : colorAlias(ref.tone, ref.stop);
}

function adjacentStop(stop: ScaleStop, theme: ThemeMode, amount: number): ScaleStop {
  const index = SCALE_STOPS.indexOf(stop);
  const direction = theme === "dark" ? -1 : 1;
  return SCALE_STOPS[Math.max(0, Math.min(SCALE_STOPS.length - 1, index + direction * amount))];
}

function softerForegroundStop(primaryStop: ScaleStop, theme: ThemeMode): ScaleStop {
  const index = SCALE_STOPS.indexOf(primaryStop);
  return SCALE_STOPS[theme === "dark" ? Math.min(SCALE_STOPS.length - 1, index + 2) : Math.max(0, index - 2)];
}

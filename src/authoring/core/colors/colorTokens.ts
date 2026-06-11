import { ALPHA_STOPS, ALPHA_VARIANTS, COLLECTION_NAMES, COLOR_TONES, SCALE_STOPS } from "../../shared/constants.js";
import type { CollectionSpec, ColorTone, StyleflowConfig, ThemeMode } from "../../shared/types.js";
import { enabledColorTones } from "../../config/selectors.js";
import { hexToRgba } from "./convert.js";
import { generateColorRamp, type GeneratedRamp } from "./ramp.js";
import { addVariable, alias, createCollection } from "../tokens/model.js";

export type RampMap = Record<ColorTone, GeneratedRamp>;

export function generateColorCollections(config: StyleflowConfig): { collections: CollectionSpec[]; ramps: RampMap } {
  const primitives = createCollection(COLLECTION_NAMES.primitives, ["Base"]);
  const brandColors = createCollection(COLLECTION_NAMES.brandColors, config.themes);
  const ramps = {} as RampMap;
  const enabledTones = enabledColorTones(config);

  for (const tone of COLOR_TONES) {
    ramps[tone] = generateColorRamp(config.colors.tones[tone]);
  }

  for (const tone of enabledTones) {
    const ramp = ramps[tone];
    for (const stop of SCALE_STOPS) {
      addVariable(primitives, `color/primitive/${ramp.chromaticName}/${stop}`, "COLOR", { Base: hexToRgba(ramp.colors[stop]) });
    }
    for (const sourceStop of SCALE_STOPS) {
      for (const stop of ALPHA_STOPS) {
        addVariable(primitives, `color/primitive/${ramp.chromaticName}/alpha/${sourceStop}/${stop}`, "COLOR", {
          Base: stop === "solid" ? hexToRgba(ramp.colors[sourceStop], 1) : hexToRgba(ramp.colors[sourceStop], Number(stop) / 100)
        });
      }
    }
    for (const stop of SCALE_STOPS) {
      addVariable(brandColors, `${tone}/${stop}`, "COLOR", themedValues(config, () => alias(COLLECTION_NAMES.primitives, `color/primitive/${ramp.chromaticName}/${stop}`)));
    }
    addVariable(brandColors, `${tone}/brand`, "COLOR", themedValues(config, () => alias(COLLECTION_NAMES.primitives, `color/primitive/${ramp.chromaticName}/${ramp.baseStop}`)));
    for (const variant of ALPHA_VARIANTS) {
      for (const stop of ALPHA_STOPS) {
        addVariable(brandColors, `${tone}/alpha/${variant}/${stop}`, "COLOR", themedValues(config, (theme) => {
          const sourceStop = config.colors.tones[tone].alpha[theme][variant];
          return alias(COLLECTION_NAMES.primitives, `color/primitive/${ramp.chromaticName}/alpha/${sourceStop}/${stop}`);
        }));
      }
    }
  }

  return { collections: [primitives, brandColors], ramps };
}

function themedValues<T>(config: StyleflowConfig, value: (theme: ThemeMode) => T): Record<ThemeMode, T> {
  return Object.fromEntries(config.themes.map((theme) => [theme, value(theme)])) as Record<ThemeMode, T>;
}

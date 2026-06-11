import { ALPHA_VARIANTS, BREAKPOINTS, COLOR_TONES, LAYOUT_DENSITIES, LAYOUT_PROPERTIES, LAYOUT_ROLES, SCALE_STOPS, STYLEFLOW_CONFIG_VERSION, THEME_MODES } from "../shared/constants.js";
import type { ColorRampConfig, ColorTone, LayoutDensity, LayoutMatrix, LayoutRole, LayoutValueRef, StyleflowConfig, ThemeMode, TypographyConfig, TypographyFontSlot } from "../shared/types.js";
import { canInheritLayoutProperty } from "../core/layout/inheritance.js";
import { createDefaultConfig, defaultAlphaConfig } from "./defaults.js";
import { normalizeOnSurfaceInteractiveConfig, normalizeOnSurfaceStaticConfig } from "./onSurfaceSchema.js";

export function normalizeConfig(input: unknown): StyleflowConfig {
  const defaults = createDefaultConfig();
  if (!isObject(input) || input.version !== STYLEFLOW_CONFIG_VERSION) {
    return defaults;
  }
  const partial = input as Partial<StyleflowConfig>;
  const themes = normalizeThemes(partial.themes);
  const merged: StyleflowConfig = Object.assign({}, defaults, partial, {
    version: STYLEFLOW_CONFIG_VERSION,
    project: Object.assign({}, defaults.project, partial.project),
    colors: {
      algorithm: "oklch",
      tones: Object.fromEntries(
        COLOR_TONES.map((tone) => {
          const supplied = partial.colors?.tones?.[tone];
          return [tone, normalizeColorRamp(tone, supplied, defaults.colors.tones[tone])];
        })
      ) as StyleflowConfig["colors"]["tones"]
    },
    dimensions: Object.assign({}, defaults.dimensions, partial.dimensions, {
      scale: partial.dimensions?.scale ?? defaults.dimensions.scale,
      containerScale: partial.dimensions?.containerScale ?? defaults.dimensions.containerScale,
      strokes: partial.dimensions?.strokes ?? defaults.dimensions.strokes,
      breakpoints: Object.assign({}, defaults.dimensions.breakpoints, partial.dimensions?.breakpoints),
      layout: normalizeLayoutMatrix(partial.dimensions?.layout, defaults.dimensions.layout)
    }),
    typography: normalizeTypography(partial.typography, defaults.typography),
    semanticSurfaces: normalizeSemanticSurfaces(partial.semanticSurfaces ?? defaults.semanticSurfaces),
    onSurfaceStatic: normalizeOnSurfaceStaticConfig(partial.onSurfaceStatic, defaults.onSurfaceStatic),
    onSurfaceInteractive: normalizeOnSurfaceInteractiveConfig(partial.onSurfaceInteractive, defaults.onSurfaceInteractive, themes),
    themes,
    layoutRoles: normalizeLayoutRoles(partial.layoutRoles),
    sync: Object.assign({}, defaults.sync, partial.sync, { strategy: "managed" })
  });
  merged.colors.tones.main.enabled = true;
  merged.colors.tones.neutral.enabled = true;
  normalizeContainerScaleRefs(merged);
  return merged;
}

function normalizeColorRamp(tone: ColorTone, supplied: ColorRampConfig | undefined, defaults: ColorRampConfig): ColorRampConfig {
  return Object.assign({}, defaults, supplied, {
    enabled: typeof supplied?.enabled === "boolean" ? supplied.enabled : defaults.enabled,
    semanticName: tone,
    alpha: normalizeAlphaConfig(tone, supplied?.alpha)
  });
}

function normalizeAlphaConfig(tone: ColorTone, input: unknown): ColorRampConfig["alpha"] {
  const defaults = defaultAlphaConfig(tone);
  const output = JSON.parse(JSON.stringify(defaults)) as ColorRampConfig["alpha"];
  if (!isObject(input)) {
    return output;
  }
  for (const theme of THEME_MODES) {
    const themeInput = input[theme];
    if (!isObject(themeInput)) {
      continue;
    }
    for (const variant of ALPHA_VARIANTS) {
      if (typeof themeInput[variant] === "string" && (SCALE_STOPS as readonly string[]).includes(themeInput[variant])) {
        output[theme][variant] = themeInput[variant] as ColorRampConfig["alpha"][ThemeMode][typeof variant];
      }
    }
  }
  return output;
}

function normalizeSemanticSurfaces(input: StyleflowConfig["semanticSurfaces"]): StyleflowConfig["semanticSurfaces"] {
  const next = JSON.parse(JSON.stringify(input)) as StyleflowConfig["semanticSurfaces"];
  for (const themeConfig of Object.values(next)) {
    for (const toneConfig of Object.values(themeConfig ?? {})) {
      for (const intensityConfig of Object.values(toneConfig ?? {})) {
        const ref = intensityConfig?.["surface-scrim"];
        if (ref && "alpha" in ref && typeof ref.alpha === "string") {
          ref.alpha = normalizeAlphaToken(ref.alpha) as typeof ref.alpha;
        }
      }
    }
  }
  return next;
}

function normalizeAlphaToken(value: string): string {
  if (value === "white") {
    return "soft/40";
  }
  if (value.startsWith("soft/") || value.startsWith("strong/")) {
    return value;
  }
  return `soft/${value}`;
}

function normalizeLayoutMatrix(input: unknown, defaults: LayoutMatrix): LayoutMatrix {
  const matrix = cloneLayoutMatrix(defaults);
  if (!isObject(input)) {
    return matrix;
  }
  for (const role of LAYOUT_ROLES) {
    const roleInput = input[role];
    if (!isObject(roleInput)) {
      continue;
    }
    for (const density of LAYOUT_DENSITIES) {
      const densityInput = roleInput[density];
      if (!isObject(densityInput)) {
        continue;
      }
      applyLegacyDensityLayout(matrix, role, density, densityInput);
      for (const breakpoint of BREAKPOINTS) {
        const breakpointInput = densityInput[breakpoint];
        if (!isObject(breakpointInput)) {
          continue;
        }
        for (const property of LAYOUT_PROPERTIES) {
          const ref = normalizeLayoutRef(breakpointInput[property]);
          if (ref) {
            matrix[role][density][breakpoint][property] = ref;
          }
        }
      }
    }
  }
  return matrix;
}

function applyLegacyDensityLayout(
  matrix: LayoutMatrix,
  role: LayoutRole,
  density: LayoutDensity,
  densityInput: Record<string, unknown>
): void {
  for (const property of LAYOUT_PROPERTIES) {
    const ref = normalizeLayoutRef(densityInput[property]);
    if (ref) {
      matrix[role][density].xs[property] = ref;
      for (const breakpoint of BREAKPOINTS) {
        if (breakpoint !== "xs" && canInheritLayoutProperty(role, property)) {
          matrix[role][density][breakpoint][property] = { inherit: true };
        }
      }
    }
  }
}

function cloneLayoutMatrix(layout: LayoutMatrix): LayoutMatrix {
  return JSON.parse(JSON.stringify(layout)) as LayoutMatrix;
}

function normalizeLayoutRef(value: unknown): LayoutValueRef | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  if (typeof value.scale === "string") {
    return { scale: value.scale };
  }
  if (typeof value.stroke === "string") {
    return { stroke: value.stroke };
  }
  if (typeof value.container === "string") {
    return { container: value.container };
  }
  if (typeof value.breakpoint === "string") {
    return { breakpoint: value.breakpoint };
  }
  if (typeof value.value === "number") {
    return { value: value.value };
  }
  if (value.inherit === true) {
    return { inherit: true };
  }
  return undefined;
}

function normalizeTypography(input: unknown, defaults: TypographyConfig): TypographyConfig {
  if (!isObject(input)) {
    return defaults;
  }
  const fontsInput = Array.isArray(input.fonts) ? input.fonts : [];
  const suppliedFonts = fontsInput.filter(isTypographyFontSlot);
  const fonts = suppliedFonts.length > 0
    ? suppliedFonts.map((slot) => Object.assign({}, slot, { enabledWeights: slot.enabledWeights.slice() }))
    : defaults.fonts;
  const main = fonts.find((slot) => slot.id === "main");
  if (!main) {
    fonts.unshift(defaults.fonts[0]);
  } else {
    main.enabled = true;
  }
  return {
    fonts,
    roles: Object.assign({}, defaults.roles, isObject(input.roles) ? input.roles : {})
  };
}

function normalizeContainerScaleRefs(config: StyleflowConfig): void {
  const known = new Set(config.dimensions.containerScale.map((entry) => entry.name));
  for (const role of Object.keys(config.dimensions.layout)) {
    const roleLayout = config.dimensions.layout[role as keyof typeof config.dimensions.layout];
    for (const density of Object.keys(roleLayout)) {
      const densityLayout = roleLayout[density as keyof typeof roleLayout];
      for (const breakpoint of Object.keys(densityLayout)) {
        const breakpointLayout = densityLayout[breakpoint as keyof typeof densityLayout];
        const ref = breakpointLayout["container-max-width"];
        if (ref && "value" in ref) {
          const name = String(ref.value);
          breakpointLayout["container-max-width"] = { container: name };
          if (!known.has(name)) {
            config.dimensions.containerScale.push({ name, value: ref.value });
            known.add(name);
          }
        }
      }
    }
  }
}

export function parseConfigJson(json: string): StyleflowConfig {
  return normalizeConfig(JSON.parse(json));
}

export function stringifyConfig(config: StyleflowConfig): string {
  return JSON.stringify(config, null, 2);
}

function normalizeThemes(value: unknown): StyleflowConfig["themes"] {
  if (!Array.isArray(value)) {
    return THEME_MODES.slice();
  }
  const themes = value.filter((theme): theme is "light" | "dark" => theme === "light" || theme === "dark");
  return themes.length > 0 ? themes : THEME_MODES.slice();
}

function normalizeLayoutRoles(value: unknown): LayoutRole[] {
  const values = Array.isArray(value)
    ? value.filter((role): role is LayoutRole => typeof role === "string" && (LAYOUT_ROLES as readonly string[]).includes(role))
    : LAYOUT_ROLES.slice();
  return Array.from(new Set(values.concat("none"))) as LayoutRole[];
}

function isTypographyFontSlot(value: unknown): value is TypographyFontSlot {
  return isObject(value)
    && typeof value.id === "string"
    && typeof value.label === "string"
    && typeof value.enabled === "boolean"
    && typeof value.family === "string"
    && Array.isArray(value.enabledWeights)
    && value.enabledWeights.every((item) => typeof item === "string")
    && typeof value.lightWeight === "string"
    && typeof value.strongWeight === "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type StyleFlowBuildType = "dev" | "production";

export type StyleFlowStrategy = "public-contract" | "usage-based" | "full";
export type StyleFlowDynamicMode = "error" | "contract";

export const STYLEFLOW_STRATEGIES: readonly StyleFlowStrategy[] = ["public-contract", "usage-based", "full"];
export const STYLEFLOW_DYNAMIC_MODES: readonly StyleFlowDynamicMode[] = ["error", "contract"];

export interface StyleFlowRuntimeSafelist {
  themes?: string[];
  tones?: string[];
  intensities?: string[];
  layoutRoles?: string[];
  densities?: string[];
  surfaceTypes?: string[];
  textStyles?: string[] | "*";
  tailwindClasses?: string[];
}

export interface StyleFlowConfig {
  tokens: {
    source: string;
  };
  output: {
    dir: string;
    minify?: boolean;
    /**
     * Ripristina il comportamento storico: emette `tokens.css` con il dump
     * completo (primitive + layer alias) e disattiva il collasso/inline.
     * Default `false` (riduzione attiva, un solo `styleflow.css`).
     */
    legacyTokensCss?: boolean;
  };
  tailwind: {
    enabled: boolean;
  };
  runtime: {
    strategy?: StyleFlowStrategy;
    dynamic?: StyleFlowDynamicMode;
    safelist?: StyleFlowRuntimeSafelist;
    usageManifests?: string[];
  };
  typography?: {
    emitBase?: boolean;
    emitOverrideTemplate?: boolean;
    overrideFile?: string;
  };
  utilities?: {
    emit?: boolean;
  };
  build: {
    type: StyleFlowBuildType;
    content: string[];
  };
  cloud?: {
    activeManifestUrl?: string;
  };
}

export function defineStyleFlowConfig(config: StyleFlowConfig): StyleFlowConfig {
  return config;
}

export function createDefaultStyleFlowConfig(): StyleFlowConfig {
  return {
    tokens: { source: "./tokens/styleflow.tokens.json" },
    output: { dir: ".styleflow", minify: false },
    tailwind: { enabled: true },
    runtime: {
      strategy: "usage-based",
      dynamic: "error",
      safelist: {},
      usageManifests: []
    },
    typography: {
      emitBase: true,
      emitOverrideTemplate: false,
      overrideFile: "./src/styles/styleflow-typography.css"
    },
    utilities: { emit: true },
    build: { type: "dev", content: ["./src"] },
    cloud: {}
  };
}

export function normalizeStyleFlowConfig(input: unknown): StyleFlowConfig {
  const defaults = createDefaultStyleFlowConfig();
  if (!input || typeof input !== "object") {
    return defaults;
  }
  const candidate = input as Partial<StyleFlowConfig>;
  const strategy = candidate.runtime?.strategy ?? defaults.runtime.strategy ?? "usage-based";
  if (!STYLEFLOW_STRATEGIES.includes(strategy)) {
    throw new Error(`Unsupported runtime strategy: ${strategy}. Use public-contract, usage-based, or full.`);
  }
  const dynamic = candidate.runtime?.dynamic ?? defaults.runtime.dynamic ?? "error";
  if (!STYLEFLOW_DYNAMIC_MODES.includes(dynamic)) {
    throw new Error(`Unsupported runtime dynamic mode: ${dynamic}. Use error or contract.`);
  }
  if (candidate.build?.type && candidate.build.type !== "dev" && candidate.build.type !== "production") {
    throw new Error(`Unsupported build type: ${candidate.build.type}. Use dev or production.`);
  }
  const safelist = normalizeSafelist(candidate.runtime?.safelist);
  return {
    tokens: { source: candidate.tokens?.source ?? defaults.tokens.source },
    output: {
      dir: candidate.output?.dir ?? defaults.output.dir,
      minify: candidate.output?.minify ?? defaults.output.minify,
      legacyTokensCss: candidate.output?.legacyTokensCss === true
    },
    tailwind: { enabled: candidate.tailwind?.enabled ?? defaults.tailwind.enabled },
    runtime: {
      strategy,
      dynamic,
      safelist,
      usageManifests: stringArray(candidate.runtime?.usageManifests) ? candidate.runtime.usageManifests : defaults.runtime.usageManifests
    },
    typography: {
      emitBase: candidate.typography?.emitBase ?? defaults.typography?.emitBase,
      emitOverrideTemplate: candidate.typography?.emitOverrideTemplate ?? defaults.typography?.emitOverrideTemplate,
      overrideFile: candidate.typography?.overrideFile ?? defaults.typography?.overrideFile
    },
    utilities: {
      emit: candidate.utilities?.emit ?? defaults.utilities?.emit
    },
    build: {
      type: candidate.build?.type ?? defaults.build.type,
      content: Array.isArray(candidate.build?.content) && candidate.build.content.every((path) => typeof path === "string")
        ? candidate.build.content
        : defaults.build.content
    },
    cloud: {
      activeManifestUrl: typeof candidate.cloud?.activeManifestUrl === "string" ? candidate.cloud.activeManifestUrl : undefined
    }
  };
}

function normalizeSafelist(input: unknown): StyleFlowRuntimeSafelist {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const candidate = input as StyleFlowRuntimeSafelist;
  return {
    themes: stringArray(candidate.themes) ? candidate.themes : undefined,
    tones: stringArray(candidate.tones) ? candidate.tones : undefined,
    intensities: stringArray(candidate.intensities) ? candidate.intensities : undefined,
    layoutRoles: stringArray(candidate.layoutRoles) ? candidate.layoutRoles : undefined,
    densities: stringArray(candidate.densities) ? candidate.densities : undefined,
    surfaceTypes: stringArray(candidate.surfaceTypes) ? candidate.surfaceTypes : undefined,
    textStyles: candidate.textStyles === "*" ? "*" : stringArray(candidate.textStyles) ? candidate.textStyles : undefined,
    tailwindClasses: stringArray(candidate.tailwindClasses) ? candidate.tailwindClasses : undefined
  };
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

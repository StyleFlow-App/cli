import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { createJiti } from "jiti";
import {
  normalizeStyleFlowConfig,
  type StyleFlowBuildType,
  type StyleFlowConfig,
  type StyleFlowDynamicMode,
  type StyleFlowStrategy
} from "../config/index.js";
import { parseStyleflowTokens, type StyleflowTokensFile } from "../format/index.js";
import type { ValidationIssue } from "./model.js";
import { generateBaseCss, generateTypographyOverrideCss } from "./baseCss.js";
import { generateContractJson, generateContractTs, publicContract } from "./contractOutput.js";
import { generateStyleflowCss } from "./entryCss.js";
import { generateRuntimeCssOutput } from "./runtimeCss.js";
import { generateThemeCss } from "./themeCss.js";
import { generateTokensCss } from "./tokensCss.js";
import { generateTypesOutput } from "./typesOutput.js";
import { scanRuntimeUsage, type RuntimeUsage, type RuntimeUsageContract } from "./usage.js";
import { formatIssues, validateTokenContract } from "./validate.js";
import {
  COLLECTION_NAMES,
  COLOR_INTENSITIES,
  COLOR_TONES,
  LAYOUT_DENSITIES,
  LAYOUT_ROLES,
  SURFACE_TYPES,
  THEME_MODES,
} from "../contracts.js";

/**
 * File generati in modo condizionale dal compiler. Quelli non presenti
 * nell'output corrente vengono rimossi dalla cartella per evitare artefatti
 * stantii (es. `tokens.css` quando il collasso dei layer è attivo).
 */
const MANAGED_OUTPUT_FILES = ["tokens.css", "theme.css", "base.css", "tailwind-safelist.css", "usage-report.json"] as const;

export interface RemoteManifestContract {
  themes: string[];
  tones: string[];
  intensities: string[];
  layoutRoles: string[];
  densities: string[];
}

export interface RemoteManifest {
  project: string;
  version: string;
  tokenHash: string;
  generatedAt: string;
  publicContract: RemoteManifestContract;
  includedInBuild: RemoteManifestContract;
  deprecated: Record<string, string[]>;
  hash: string;
  integrity: string;
}

export interface CompileOptions {
  cwd?: string;
  configPath?: string;
  write?: boolean;
  allowContrastWarnings?: boolean;
  buildType?: StyleFlowBuildType;
  strategy?: StyleFlowStrategy;
  dynamic?: StyleFlowDynamicMode;
  minify?: boolean;
  usageReport?: boolean;
  manifest?: RemoteManifest;
}

export interface StyleflowReport {
  version: string;
  sourceTokens: number;
  includedTokens: number;
  generatedFiles: string[];
  buildType: StyleFlowBuildType;
  strategy: StyleFlowStrategy;
  cssBytes: number;
  contentFiles: number;
  usageManifestFiles: string[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface CompilationResult {
  config: StyleFlowConfig;
  tokens: StyleflowTokensFile;
  outputs: Record<string, string>;
  report: StyleflowReport;
}

export async function validateStyleflow(options: CompileOptions = {}): Promise<CompilationResult> {
  return runCompilation(Object.assign({}, options, { write: false }));
}

export async function compileStyleflow(options: CompileOptions = {}): Promise<CompilationResult> {
  return runCompilation(Object.assign({}, options, { write: options.write !== false }));
}

async function runCompilation(options: CompileOptions): Promise<CompilationResult> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options.configPath ?? "styleflow.config.ts");
  const sourcePath = resolve(cwd, config.tokens.source);
  const tokens = parseStyleflowTokens(JSON.parse(await readFile(sourcePath, "utf8")) as unknown);
  if (options.manifest && options.manifest.tokenHash !== tokenHash(tokens)) {
    throw new Error("Active manifest token hash does not match the local styleflow.tokens.json artifact.");
  }
  const issues = validateTokenContract(tokens, { allowContrastWarnings: options.allowContrastWarnings });
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  if (errors.length > 0) {
    const message = errors.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`StyleFlow validation failed:\n${message}`);
  }

  const outputDir = resolve(cwd, config.output.dir);
  const buildType = options.buildType ?? config.build.type;
  const strategy = resolveStrategy(options, config);
  const usage = await computeUsage(strategy, tokens, options.manifest, cwd, config, options.dynamic);
  if (usage) {
    const usageIssues = [...usage.issues, ...validateUsageAgainstArtifact(tokens, usage)];
    if (usageIssues.length > 0) {
      throw new Error(`StyleFlow validation failed:\n${formatIssues(usageIssues)}`);
    }
  }
  // Modalità di default: layer alias collassati, tokens.css eliminato, un solo
  // styleflow.css. `output.legacyTokensCss` ripristina il dump multi-file storico.
  const transparent = config.output.legacyTokensCss !== true;
  const runtime = generateRuntimeCssOutput(tokens, usage, { transparent });
  const included = usage ? runtime.tokenKeys : undefined;
  const themeCss = config.tailwind.enabled ? generateThemeCss(tokens) : "";
  const baseCss = generateBaseCss(tokens, { utilities: config.utilities?.emit !== false, typography: config.typography?.emitBase !== false });
  const tokensCss = transparent ? "" : generateTokensCss(tokens, included, Boolean(usage));
  const outputs: Record<string, string> = {};
  if (themeCss) outputs["theme.css"] = themeCss;
  if (tokensCss) outputs["tokens.css"] = tokensCss;
  outputs["runtime.css"] = runtime.css;
  if (baseCss) outputs["base.css"] = baseCss;
  outputs["styleflow.css"] = generateStyleflowCss({ theme: themeCss, tokens: tokensCss, runtime: runtime.css, base: baseCss });
  outputs["types.ts"] = generateTypesOutput(tokens);
  outputs["contract.json"] = generateContractJson(tokens);
  outputs["contract.ts"] = generateContractTs(tokens);
  if (usage && usage.tailwindClasses.size > 0) {
    outputs["tailwind-safelist.css"] = generateTailwindSafelistCss(usage);
  }
  if (options.usageReport) {
    outputs["usage-report.json"] = `${JSON.stringify(usage ? serializeUsage(usage) : { strategy, full: true }, null, 2)}\n`;
  }
  const minify = options.minify ?? config.output.minify ?? false;
  if (minify) {
    for (const file of Object.keys(outputs).filter((name) => name.endsWith(".css"))) {
      outputs[file] = minifyCss(outputs[file]);
    }
  }
  if (strategy === "usage-based" && usage && usage.contentFiles.length === 0) {
    warnings.push({
      level: "warning",
      path: "build.content",
      message: "usage-based build did not find source files; only default runtime tokens were included."
    });
  }
  // Misura il singolo file effettivamente importato (styleflow.css), non la
  // somma: gli altri .css sono debug e sono già contenuti nel bundle.
  const cssBytes = Buffer.byteLength(outputs["styleflow.css"], "utf8");
  if (cssBytes > 500_000) {
    warnings.push({
      level: "warning",
      path: "output.css",
      message: budgetWarningMessage(strategy, cssBytes)
    });
  }
  const generatedFiles = [...Object.keys(outputs), "report.json"];
  const report: StyleflowReport = {
    version: tokens.version,
    sourceTokens: tokens.collections.reduce((sum, collection) => sum + collection.variables.length, 0),
    includedTokens: included?.size ?? tokens.collections.reduce((sum, collection) => sum + collection.variables.length, 0),
    generatedFiles: generatedFiles.map((file) => `${config.output.dir}/${file}`),
    buildType,
    strategy,
    cssBytes,
    contentFiles: usage?.contentFiles.length ?? 0,
    usageManifestFiles: usage?.usageManifestFiles ?? [],
    errors,
    warnings
  };
  outputs["report.json"] = `${JSON.stringify(report, null, 2)}\n`;
  if (options.write) {
    await mkdir(outputDir, { recursive: true });
    await Promise.all(Object.entries(outputs).map(([file, content]) => writeFile(resolve(outputDir, file), content, "utf8")));
    // Rimuove gli artefatti generati in passato e non più emessi (es. tokens.css
    // quando il collasso è attivo), così la cartella resta allineata all'output.
    await Promise.all(MANAGED_OUTPUT_FILES
      .filter((file) => !(file in outputs))
      .map((file) => rm(resolve(outputDir, file), { force: true })));
    if (config.typography?.emitOverrideTemplate && config.typography.overrideFile) {
      await ensureTextFile(resolve(cwd, config.typography.overrideFile), generateTypographyOverrideCss(tokens));
    }
  }
  return { config, tokens, outputs, report };
}

export function tokenHash(tokens: StyleflowTokensFile): string {
  return `sha256-${createHash("sha256").update(canonicalJson(tokens)).digest("hex")}`;
}

export function canonicalJson(input: unknown): string {
  return JSON.stringify(canonicalValue(input));
}

export function verifyRemoteManifest(input: unknown): RemoteManifest {
  if (!isRecord(input) || !isContract(input.publicContract) || !isContract(input.includedInBuild)
      || typeof input.project !== "string" || typeof input.version !== "string"
      || typeof input.tokenHash !== "string" || typeof input.generatedAt !== "string"
      || typeof input.hash !== "string" || typeof input.integrity !== "string"
      || !isRecord(input.deprecated)) {
    throw new Error("Remote StyleFlow manifest is invalid.");
  }
  const manifest = input as unknown as RemoteManifest;
  const { hash: _hash, integrity: _integrity, ...unsigned } = manifest;
  const canonical = canonicalJson(unsigned);
  const hash = `sha256-${createHash("sha256").update(canonical).digest("hex")}`;
  const integrity = `sha256-${createHash("sha256").update(canonical).digest("base64")}`;
  if (manifest.hash !== hash || manifest.integrity !== integrity) {
    throw new Error("Remote StyleFlow manifest integrity verification failed.");
  }
  return manifest;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

/**
 * Risolve la strategia effettiva. `options.strategy`/`options.buildType` (override
 * programmatici e CLI via STYLEFLOW_BUILD_TYPE) hanno precedenza; in assenza, vince
 * `config.runtime.strategy`. `build.type` resta come fallback deprecato.
 */
function resolveStrategy(options: CompileOptions, config: StyleFlowConfig): StyleFlowStrategy {
  if (options.strategy) {
    return options.strategy;
  }
  if (options.buildType === "production") {
    return "usage-based";
  }
  return config.runtime.strategy ?? "usage-based";
}

async function computeUsage(
  strategy: StyleFlowStrategy,
  tokens: StyleflowTokensFile,
  manifest: RemoteManifest | undefined,
  cwd: string,
  config: StyleFlowConfig,
  dynamicOverride?: StyleFlowDynamicMode
): Promise<RuntimeUsage | undefined> {
  if (manifest) {
    return usageFromManifest(manifest);
  }
  if (strategy === "usage-based") {
    return scanRuntimeUsage(cwd, config.build.content, {
      contract: runtimeContract(tokens),
      dynamic: dynamicOverride ?? config.runtime.dynamic ?? "error",
      safelist: config.runtime.safelist,
      usageManifests: config.runtime.usageManifests
    });
  }
  if (strategy === "public-contract") {
    return usageFromPublicContract(tokens);
  }
  return undefined; // full: nessun pruning, emette l'intero set di token.
}

/**
 * Costruisce un RuntimeUsage che include l'intero contract pubblico dichiarato.
 * Alimenta lo stesso pruning di usage-based, così runtime.css copre tutta la
 * matrice mentre tokens.css viene ridotto alle sole foglie referenziate (niente
 * dump all-modes "da Figma"). `textStyles: ["*"]` mantiene tutta la tipografia.
 */
function usageFromPublicContract(tokens: StyleflowTokensFile): RuntimeUsage {
  const contract = runtimeContract(tokens);
  return {
    themes: new Set(contract.themes),
    tones: new Set(contract.tones),
    intensities: new Set(contract.intensities),
    layoutRoles: new Set(contract.layoutRoles),
    densities: new Set(contract.densities),
    surfaceTypes: new Set(contract.surfaceTypes),
    textStyles: new Set<string>(["*"]),
    typographyVariables: new Set<string>(),
    tailwindClasses: new Set<string>(),
    contentFiles: [],
    usageManifestFiles: [],
    issues: []
  };
}

function budgetWarningMessage(strategy: StyleFlowStrategy, cssBytes: number): string {
  const base = `Generated CSS is ${cssBytes} bytes`;
  if (strategy === "usage-based") {
    return `${base}; usage-based output exceeds the recommended 500000 byte budget — review build.content coverage and the safelist.`;
  }
  if (strategy === "public-contract") {
    return `${base}; public-contract emits the full declared contract and is expected above the 500000 byte budget — use usage-based to drop below it.`;
  }
  return `${base}; the full strategy emits every token mode for debugging and is far above the 500000 byte budget — use public-contract or usage-based for production.`;
}

function usageFromManifest(manifest: RemoteManifest): Awaited<ReturnType<typeof scanRuntimeUsage>> {
  const contract = manifest.includedInBuild;
  return {
    themes: new Set(contract.themes.filter((value): value is (typeof THEME_MODES)[number] => (THEME_MODES as readonly string[]).includes(value))),
    tones: new Set(contract.tones.filter((value): value is (typeof COLOR_TONES)[number] => (COLOR_TONES as readonly string[]).includes(value))),
    intensities: new Set(contract.intensities.filter((value): value is (typeof COLOR_INTENSITIES)[number] => (COLOR_INTENSITIES as readonly string[]).includes(value))),
    layoutRoles: new Set(contract.layoutRoles.filter((value): value is (typeof LAYOUT_ROLES)[number] => (LAYOUT_ROLES as readonly string[]).includes(value))),
    densities: new Set(contract.densities.filter((value): value is (typeof LAYOUT_DENSITIES)[number] => (LAYOUT_DENSITIES as readonly string[]).includes(value))),
    surfaceTypes: new Set(SURFACE_TYPES),
    textStyles: new Set<string>(["*"]),
    typographyVariables: new Set<string>(),
    tailwindClasses: new Set<string>(),
    contentFiles: [],
    usageManifestFiles: [],
    issues: []
  };
}

function runtimeContract(tokens: StyleflowTokensFile): RuntimeUsageContract {
  const contract = publicContract(tokens);
  const pick = <T extends string>(values: string[], allowed: readonly T[]): T[] =>
    values.filter((value): value is T => (allowed as readonly string[]).includes(value));
  return {
    themes: pick(contract.themes, THEME_MODES),
    tones: pick(contract.tones, COLOR_TONES),
    intensities: pick(contract.intensities, COLOR_INTENSITIES),
    layoutRoles: pick(contract.layoutRoles, LAYOUT_ROLES),
    densities: pick(contract.densities, LAYOUT_DENSITIES),
    surfaceTypes: pick(contract.surfaceTypes, SURFACE_TYPES),
    textStyles: contract.textStyles.map((style) => style.id)
  };
}

function isContract(value: unknown): value is RemoteManifestContract {
  if (!isRecord(value)) return false;
  return ["themes", "tones", "intensities", "layoutRoles", "densities"].every((axis) =>
    Array.isArray(value[axis]) && value[axis].every((entry) => typeof entry === "string"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateUsageAgainstArtifact(tokens: StyleflowTokensFile, usage: Awaited<ReturnType<typeof scanRuntimeUsage>>): ValidationIssue[] {
  const modes = (collection: string) => new Set(tokens.collections.find((item) => item.name === collection)?.modes ?? []);
  const availableThemes = modes(COLLECTION_NAMES.semanticColor);
  const availableTones = modes(COLLECTION_NAMES.colorTone);
  const availableIntensities = modes(COLLECTION_NAMES.colorIntensity);
  const availableRoles = modes(COLLECTION_NAMES.layoutRole);
  const availableDensities = modes(COLLECTION_NAMES.layoutRoleDensity);
  const availableTextStyles = new Set(publicContract(tokens).textStyles.map((style) => style.id));
  const issues: ValidationIssue[] = [];
  for (const value of usage.themes) {
    if ((THEME_MODES as readonly string[]).includes(value) && !availableThemes.has(value)) {
      issues.push({ level: "error", path: "usage.theme", message: `Theme is not generated: ${value}.` });
    }
  }
  for (const value of usage.tones) {
    if ((COLOR_TONES as readonly string[]).includes(value) && !availableTones.has(value)) {
      issues.push({ level: "error", path: "usage.tone", message: `Color tone is not generated: ${value}.` });
    }
  }
  for (const value of usage.intensities) {
    if ((COLOR_INTENSITIES as readonly string[]).includes(value) && !availableIntensities.has(value)) {
      issues.push({ level: "error", path: "usage.intensity", message: `Color intensity is not generated: ${value}.` });
    }
  }
  for (const value of usage.layoutRoles) {
    if ((LAYOUT_ROLES as readonly string[]).includes(value) && !availableRoles.has(value)) {
      issues.push({ level: "error", path: "usage.layoutRole", message: `Layout role is not generated: ${value}.` });
    }
  }
  for (const value of usage.densities) {
    if ((LAYOUT_DENSITIES as readonly string[]).includes(value) && !availableDensities.has(value)) {
      issues.push({ level: "error", path: "usage.density", message: `Layout density is not generated: ${value}.` });
    }
  }
  for (const value of usage.textStyles) {
    if (value !== "*" && !availableTextStyles.has(value)) {
      issues.push({ level: "error", path: "usage.textStyle", message: `Text style is not generated: ${value}.` });
    }
  }
  return issues;
}

function generateTailwindSafelistCss(usage: RuntimeUsage): string {
  const classes = Array.from(usage.tailwindClasses).sort().join(" ");
  return `/* Generated by StyleFlow from runtime usage manifests. */\n@source inline(${JSON.stringify(classes)});\n`;
}

function serializeUsage(usage: RuntimeUsage) {
  return {
    themes: Array.from(usage.themes).sort(),
    tones: Array.from(usage.tones).sort(),
    intensities: Array.from(usage.intensities).sort(),
    layoutRoles: Array.from(usage.layoutRoles).sort(),
    densities: Array.from(usage.densities).sort(),
    surfaceTypes: Array.from(usage.surfaceTypes).sort(),
    textStyles: Array.from(usage.textStyles).sort(),
    typographyVariables: Array.from(usage.typographyVariables).sort(),
    tailwindClasses: Array.from(usage.tailwindClasses).sort(),
    contentFiles: usage.contentFiles,
    usageManifestFiles: usage.usageManifestFiles,
    issues: usage.issues
  };
}

function minifyCss(css: string): string {
  let result = "";
  let quote = "";
  let pendingSpace = false;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (!quote && char === "/" && next === "*") {
      index += 2;
      while (index < css.length && !(css[index] === "*" && css[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }
    if (quote) {
      result += char;
      if (char === "\\" && next) {
        result += next;
        index += 1;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      result += char;
      pendingSpace = false;
      continue;
    }
    if (/\s/.test(char)) {
      pendingSpace = result.length > 0;
      continue;
    }
    if ("{}:;,>+~".includes(char)) {
      result = result.replace(/\s+$/, "");
      result += char;
      pendingSpace = false;
      continue;
    }
    if (pendingSpace && !"{},:;>+~".includes(result[result.length - 1] ?? "")) {
      result += " ";
    }
    result += char;
    pendingSpace = false;
  }
  return `${result.trim()}\n`;
}

export async function loadConfig(cwd: string, configPath: string): Promise<StyleFlowConfig> {
  const absolutePath = resolve(cwd, configPath);
  try {
    const jiti = createJiti(import.meta.url);
    const imported = await jiti.import(absolutePath) as { default?: unknown } | unknown;
    const value = typeof imported === "object" && imported !== null && "default" in imported ? imported.default : imported;
    return normalizeStyleFlowConfig(value);
  } catch (error) {
    throw new Error(`Unable to load ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function ensureTextFile(path: string, content: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return false;
  } catch {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    return true;
  }
}

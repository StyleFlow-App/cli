import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import type { StyleFlowDynamicMode, StyleFlowRuntimeSafelist } from "../config/index.js";
import {
  COLOR_INTENSITIES,
  COLOR_TONES,
  LAYOUT_DENSITIES,
  LAYOUT_ROLES,
  SURFACE_TYPES,
  THEME_MODES,
  type ColorIntensityString,
  type ColorTone,
  type LayoutDensity,
  type LayoutRole,
  type SurfaceType,
  type ThemeMode
} from "../contracts.js";

const supportedExtensions = new Set([".astro", ".css", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".vue", ".svelte"]);

export interface RuntimeUsageContract {
  themes: readonly ThemeMode[];
  tones: readonly ColorTone[];
  intensities: readonly ColorIntensityString[];
  layoutRoles: readonly LayoutRole[];
  densities: readonly LayoutDensity[];
  surfaceTypes: readonly SurfaceType[];
  textStyles: readonly string[];
}

export interface RuntimeUsageOptions {
  contract?: RuntimeUsageContract;
  dynamic?: StyleFlowDynamicMode;
  safelist?: StyleFlowRuntimeSafelist;
  usageManifests?: string[];
}

export interface RuntimeUsageIssue {
  level: "error";
  path: string;
  message: string;
}

export interface RuntimeUsage {
  themes: Set<ThemeMode>;
  tones: Set<ColorTone>;
  intensities: Set<ColorIntensityString>;
  layoutRoles: Set<LayoutRole>;
  densities: Set<LayoutDensity>;
  surfaceTypes: Set<SurfaceType>;
  textStyles: Set<string>;
  typographyVariables: Set<string>;
  tailwindClasses: Set<string>;
  contentFiles: string[];
  usageManifestFiles: string[];
  issues: RuntimeUsageIssue[];
}

export async function scanRuntimeUsage(cwd: string, content: string[], options: RuntimeUsageOptions = {}): Promise<RuntimeUsage> {
  const contract = options.contract ?? defaultContract();
  const dynamic = options.dynamic ?? "error";
  const coverage = new Set<RuntimeAxis>();
  const usage: RuntimeUsage = {
    themes: new Set(),
    tones: new Set(["neutral"]),
    intensities: new Set(["1"]),
    layoutRoles: new Set(["none"]),
    densities: new Set(["md"]),
    surfaceTypes: new Set(),
    textStyles: new Set(),
    typographyVariables: new Set(),
    tailwindClasses: new Set(),
    contentFiles: [],
    usageManifestFiles: [],
    issues: []
  };
  constrainDefaultsToContract(usage, contract);
  applySafelist(usage, options.safelist, coverage);
  await applyUsageManifests(cwd, usage, options.usageManifests ?? [], coverage);
  const contentFiles = Array.from(new Set((await Promise.all(content.map((path) => collectFiles(resolve(cwd, path))))).flat())).sort();
  usage.contentFiles = contentFiles;
  for (const file of contentFiles) {
    scanContent(await readFile(file, "utf8"), usage, {
      contract,
      coverage,
      dynamic,
      file: relative(cwd, file)
    });
  }
  return usage;
}

type RuntimeAxis = "theme" | "tone" | "intensity" | "layoutRole" | "density" | "surfaceType" | "textStyle";

const runtimeAxes: readonly RuntimeAxis[] = ["theme", "tone", "intensity", "layoutRole", "density", "surfaceType", "textStyle"];

interface ScanContext {
  contract: RuntimeUsageContract;
  coverage: ReadonlySet<RuntimeAxis>;
  dynamic: StyleFlowDynamicMode;
  file: string;
}

function scanContent(content: string, usage: RuntimeUsage, context: ScanContext): void {
  captureAxis(content, ["theme", "data-theme"], THEME_MODES, usage.themes, "theme", usage, context);
  captureAxis(content, ["tone", "data-color-tone"], COLOR_TONES, usage.tones, "tone", usage, context);
  captureAxis(content, ["intensity", "data-color-intensity"], COLOR_INTENSITIES, usage.intensities, "intensity", usage, context);
  captureAxis(content, ["layoutRole", "data-layout-role"], LAYOUT_ROLES, usage.layoutRoles, "layoutRole", usage, context);
  captureAxis(content, ["density", "data-layout-density"], LAYOUT_DENSITIES, usage.densities, "density", usage, context);
  captureAxis(content, ["surfaceType", "data-surface-type"], SURFACE_TYPES, usage.surfaceTypes, "surfaceType", usage, context);
  captureTextStyles(content, usage, context);
  for (const match of content.matchAll(/--typography-[a-z0-9-]+/g)) {
    usage.typographyVariables.add(match[0]);
  }
  if (/<(?:Ui|UI)\b[^>]*\{\s*\.\.\./s.test(content)) {
    if (context.dynamic === "contract") {
      addContract(usage, context.contract);
    } else if (hasRuntimeAxisCoverage(context.coverage)) {
      return;
    } else {
      usage.issues.push({
        level: "error",
        path: `usage.dynamic:${context.file}`,
        message: "Component spread prevents static StyleFlow runtime pruning. Add runtime.safelist/runtime.usageManifests coverage or compile with --dynamic contract."
      });
    }
  }
}

function hasRuntimeAxisCoverage(coverage: ReadonlySet<RuntimeAxis>): boolean {
  return runtimeAxes.every((axis) => coverage.has(axis));
}

function captureTextStyles(content: string, usage: RuntimeUsage, context: ScanContext): void {
  const literal = /(?:textStyle|data-text-style)\s*=\s*["']([a-z0-9-]+)["']/g;
  for (const match of content.matchAll(literal)) {
    usage.textStyles.add(match[1]);
  }

  if (/(?:textStyle|data-text-style)\s*=\s*\{/.test(content)) {
    if (context.dynamic === "contract") {
      usage.textStyles.add("*");
      return;
    }
    if (context.coverage.has("textStyle")) {
      return;
    }
    usage.issues.push({
      level: "error",
      path: `usage.textStyle:${context.file}`,
      message: "Dynamic textStyle/data-text-style is not covered by runtime.safelist or a usage manifest."
    });
  }
}

function captureAxis<T extends string>(
  content: string,
  attributes: string[],
  values: readonly T[],
  target: Set<T>,
  axis: RuntimeAxis,
  usage: RuntimeUsage,
  context: ScanContext
): void {
  const attributePattern = attributes.map(escapeRegex).join("|");
  const valuePattern = values.map(escapeRegex).join("|");
  const literal = new RegExp(`(?:${attributePattern})\\s*=\\s*["'](${valuePattern})["']`, "g");
  for (const match of content.matchAll(literal)) {
    target.add(match[1] as T);
  }
  const dynamic = new RegExp(`(?:${attributePattern})\\s*=\\s*\\{`);
  if (dynamic.test(content)) {
    if (context.dynamic === "contract") {
      addAll(target, contractValues(axis, context.contract) as readonly T[]);
      return;
    }
    if (context.coverage.has(axis)) {
      return;
    }
    usageIssue(usage, axis, context);
  }
}

function usageIssue(usage: RuntimeUsage, axis: RuntimeAxis, context: ScanContext): void {
  const axisLabel = axis === "layoutRole" ? "layoutRole" : axis === "surfaceType" ? "surfaceType" : axis;
  usage.issues.push({
    level: "error",
    path: `usage.${axis}:${context.file}`,
    message: `Dynamic ${axisLabel} is not covered by runtime.safelist or a usage manifest.`
  });
}

function addAll<T>(target: Set<T>, values: readonly T[]): void {
  for (const value of values) {
    target.add(value);
  }
}

function addContract(usage: RuntimeUsage, contract: RuntimeUsageContract): void {
  addAll(usage.themes, contract.themes);
  addAll(usage.tones, contract.tones);
  addAll(usage.intensities, contract.intensities);
  addAll(usage.layoutRoles, contract.layoutRoles);
  addAll(usage.densities, contract.densities);
  addAll(usage.surfaceTypes, contract.surfaceTypes);
  usage.textStyles.add("*");
}

function contractValues(axis: RuntimeAxis, contract: RuntimeUsageContract): readonly string[] {
  if (axis === "theme") return contract.themes;
  if (axis === "tone") return contract.tones;
  if (axis === "intensity") return contract.intensities;
  if (axis === "layoutRole") return contract.layoutRoles;
  if (axis === "density") return contract.densities;
  if (axis === "surfaceType") return contract.surfaceTypes;
  return contract.textStyles;
}

function constrainDefaultsToContract(usage: RuntimeUsage, contract: RuntimeUsageContract): void {
  deleteUnavailable(usage.tones, contract.tones);
  deleteUnavailable(usage.intensities, contract.intensities);
  deleteUnavailable(usage.layoutRoles, contract.layoutRoles);
  deleteUnavailable(usage.densities, contract.densities);
}

function deleteUnavailable<T extends string>(target: Set<T>, available: readonly T[]): void {
  for (const value of Array.from(target)) {
    if (!available.includes(value)) {
      target.delete(value);
    }
  }
}

function applySafelist(usage: RuntimeUsage, safelist: StyleFlowRuntimeSafelist | undefined, coverage: Set<RuntimeAxis>): void {
  if (!safelist) {
    return;
  }
  applySelection(usage.themes, safelist.themes, "theme", coverage);
  applySelection(usage.tones, safelist.tones, "tone", coverage);
  applySelection(usage.intensities, safelist.intensities, "intensity", coverage);
  applySelection(usage.layoutRoles, safelist.layoutRoles, "layoutRole", coverage);
  applySelection(usage.densities, safelist.densities, "density", coverage);
  applySelection(usage.surfaceTypes, safelist.surfaceTypes, "surfaceType", coverage);
  applyTextStyleSelection(usage, safelist.textStyles, coverage);
  addStrings(usage.tailwindClasses, safelist.tailwindClasses);
}

async function applyUsageManifests(cwd: string, usage: RuntimeUsage, manifests: string[], coverage: Set<RuntimeAxis>): Promise<void> {
  for (const manifestPath of manifests) {
    const absolutePath = resolve(cwd, manifestPath);
    const input = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
    usage.usageManifestFiles.push(relative(cwd, absolutePath));
    applyUsageManifest(usage, input, coverage);
  }
}

function applyUsageManifest(usage: RuntimeUsage, input: unknown, coverage: Set<RuntimeAxis>): void {
  if (Array.isArray(input)) {
    addStrings(usage.tailwindClasses, input);
    return;
  }
  if (!input || typeof input !== "object") {
    return;
  }
  const manifest = input as StyleFlowRuntimeSafelist & { classes?: string[] };
  applySelection(usage.themes, manifest.themes, "theme", coverage);
  applySelection(usage.tones, manifest.tones, "tone", coverage);
  applySelection(usage.intensities, manifest.intensities, "intensity", coverage);
  applySelection(usage.layoutRoles, manifest.layoutRoles, "layoutRole", coverage);
  applySelection(usage.densities, manifest.densities, "density", coverage);
  applySelection(usage.surfaceTypes, manifest.surfaceTypes, "surfaceType", coverage);
  applyTextStyleSelection(usage, manifest.textStyles, coverage);
  addStrings(usage.tailwindClasses, manifest.tailwindClasses);
  addStrings(usage.tailwindClasses, manifest.classes);
}

function applySelection<T extends string>(target: Set<T>, values: readonly string[] | undefined, axis: RuntimeAxis, coverage: Set<RuntimeAxis>): void {
  if (!values) {
    return;
  }
  coverage.add(axis);
  for (const value of values) {
    target.add(value as T);
  }
}

function applyTextStyleSelection(usage: RuntimeUsage, values: string[] | "*" | undefined, coverage: Set<RuntimeAxis>): void {
  if (!values) {
    return;
  }
  coverage.add("textStyle");
  if (values === "*") {
    usage.textStyles.add("*");
    return;
  }
  addStrings(usage.textStyles, values);
}

function addStrings(target: Set<string>, values: readonly string[] | undefined): void {
  if (!values) {
    return;
  }
  for (const value of values) {
    target.add(value);
  }
}

function defaultContract(): RuntimeUsageContract {
  return {
    themes: THEME_MODES,
    tones: COLOR_TONES,
    intensities: COLOR_INTENSITIES,
    layoutRoles: LAYOUT_ROLES,
    densities: LAYOUT_DENSITIES,
    surfaceTypes: SURFACE_TYPES,
    textStyles: []
  };
}

async function collectFiles(path: string): Promise<string[]> {
  let details;
  try {
    details = await stat(path);
  } catch {
    return [];
  }
  if (details.isFile()) {
    return supportedExtensions.has(extname(path)) ? [path] : [];
  }
  if (!details.isDirectory()) {
    return [];
  }
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => collectFiles(resolve(path, entry.name))));
  return nested.flat();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

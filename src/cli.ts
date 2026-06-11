#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { watch } from "chokidar";
import {
  STYLEFLOW_DYNAMIC_MODES,
  STYLEFLOW_STRATEGIES,
  type StyleFlowBuildType,
  type StyleFlowDynamicMode,
  type StyleFlowStrategy
} from "./config/index.js";
import { compileStyleflow, ensureTextFile, loadConfig, validateStyleflow, verifyRemoteManifest, type RemoteManifest, type StyleflowReport } from "./compiler/index.js";

const args = process.argv.slice(2);
const manifestArgumentIndex = args.indexOf("--manifest");
const manifestMode = manifestArgumentIndex >= 0 ? args[manifestArgumentIndex + 1] : undefined;
const presetArgumentIndex = args.indexOf("--preset");
const presetMode = presetArgumentIndex >= 0 ? args[presetArgumentIndex + 1] : undefined;
const strategyArgumentIndex = args.indexOf("--strategy");
const strategyMode = strategyArgumentIndex >= 0 ? args[strategyArgumentIndex + 1] : undefined;
const dynamicArgumentIndex = args.indexOf("--dynamic");
const dynamicMode = dynamicArgumentIndex >= 0 ? args[dynamicArgumentIndex + 1] : undefined;
const flagValueIndexes = new Set<number>();
if (manifestArgumentIndex >= 0) {
  flagValueIndexes.add(manifestArgumentIndex + 1);
}
if (presetArgumentIndex >= 0) {
  flagValueIndexes.add(presetArgumentIndex + 1);
}
if (strategyArgumentIndex >= 0) {
  flagValueIndexes.add(strategyArgumentIndex + 1);
}
if (dynamicArgumentIndex >= 0) {
  flagValueIndexes.add(dynamicArgumentIndex + 1);
}
const commands = args.filter((argument, index) => (
  !argument.startsWith("--")
  && !flagValueIndexes.has(index)
));
const flags = args.filter((argument) => argument.startsWith("--"));
const command = commands[0] ?? "build";
const allowContrastWarnings = flags.includes("--allow-contrast-warnings");
const minify = flags.includes("--minify");
const usageReport = flags.includes("--usage-report");
const cwd = process.cwd();
const shellBuildType = process.env.STYLEFLOW_BUILD_TYPE;

try {
  if (commands.length > 1) {
    throw new Error(`Unexpected argument "${commands[1]}".`);
  }
  const unknownFlag = flags.find((flag) => ![
    "--allow-contrast-warnings",
    "--manifest",
    "--preset",
    "--strategy",
    "--dynamic",
    "--minify",
    "--usage-report"
  ].includes(flag));
  if (unknownFlag) {
    throw new Error(`Unknown flag "${unknownFlag}". Use --allow-contrast-warnings to emit CSS while reporting contrast issues.`);
  }
  if (manifestArgumentIndex >= 0 && manifestMode !== "active") {
    throw new Error('Use "--manifest active" to compile against the configured active cloud manifest.');
  }
  if (manifestMode && command !== "build" && command !== "validate") {
    throw new Error("--manifest active applies to build and validate only.");
  }
  if (presetArgumentIndex >= 0 && command !== "init") {
    throw new Error("--preset applies to init only.");
  }
  if (presetArgumentIndex >= 0 && presetMode !== "astro-wp") {
    throw new Error('Use "--preset astro-wp" to initialize the Astro + WordPress boilerplate preset.');
  }
  if (strategyArgumentIndex >= 0 && !STYLEFLOW_STRATEGIES.includes(strategyMode as StyleFlowStrategy)) {
    throw new Error(`Unsupported --strategy "${strategyMode}". Use public-contract, usage-based, or full.`);
  }
  if (dynamicArgumentIndex >= 0 && !STYLEFLOW_DYNAMIC_MODES.includes(dynamicMode as StyleFlowDynamicMode)) {
    throw new Error(`Unsupported --dynamic "${dynamicMode}". Use error or contract.`);
  }
  if (command === "init" && allowContrastWarnings) {
    throw new Error("--allow-contrast-warnings applies to validate, build, and watch only.");
  }
  if (command === "init" && (strategyMode || dynamicMode || minify || usageReport)) {
    throw new Error("--strategy, --dynamic, --minify, and --usage-report apply to validate, build, and watch only.");
  }
  if (command === "init") {
    await initProject();
  } else if (command === "build") {
    await buildProject();
  } else if (command === "validate") {
    await validateProject();
  } else if (command === "watch") {
    await watchProject();
  } else {
    throw new Error(`Unknown command "${command}". Use init, build, validate, or watch.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function initProject(): Promise<void> {
  const contentPaths = presetMode === "astro-wp"
    ? ["./apps/web/src", "./packages/ui/src", "./apps/cms/src"]
    : ["./src"];
  const typographyOverridePath = presetMode === "astro-wp"
    ? "./apps/web/src/styles/base/styleflow-typography.css"
    : "./src/styles/styleflow-typography.css";
  const configCreated = await ensureTextFile(resolve(cwd, "styleflow.config.ts"), `import { defineStyleFlowConfig } from "@styleflow.app/cli/config";

export default defineStyleFlowConfig({
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
    emitOverrideTemplate: true,
    overrideFile: ${JSON.stringify(typographyOverridePath)}
  },
  utilities: { emit: true },
  build: { type: "dev", content: ${JSON.stringify(contentPaths)} }
});
`);
  await ensureTextFile(resolve(cwd, typographyOverridePath), `/* StyleFlow typography overrides.
 * Edit these variables to adapt Figma typography tokens to the web font files
 * and line-height syntax used by this project.
 */
:root {
  --sf-font-body: Inter, Arial, sans-serif;
  --sf-font-heading: Inter, Arial, sans-serif;
  --sf-weight-body: 400;
  --sf-weight-heading: 700;
  --sf-leading-body: 1.5;
  --sf-leading-heading: 1.1;
}
`);
  await ensureTextFile(resolve(cwd, "tokens", "README.md"), `# StyleFlow tokens

Export \`styleflow.tokens.json\` from the StyleFlow Figma plugin into this directory, then run:

\`\`\`sh
npx @styleflow.app/cli validate
npx @styleflow.app/cli build
\`\`\`

To render an export with known contrast issues during local inspection, run \`npx @styleflow.app/cli build --allow-contrast-warnings\`. Contrast findings stay visible as warnings; invalid token structure remains blocking.

\`styleflow build\` uses the usage-based runtime strategy by default. StyleFlow scans the configured \`build.content\` directories and retains only runtime selections and their token dependencies. Use \`--strategy public-contract\` or \`--strategy full\` only when you intentionally need broader debug output.

For Tailwind v4 applications, import the single StyleFlow entry after Tailwind:

\`\`\`css
@import "tailwindcss";
@import "../.styleflow/styleflow.css";
@import ${JSON.stringify(typographyOverridePath)};
\`\`\`

\`styleflow.css\` bundles the Tailwind \`@theme\` bridge, the runtime tokens and resolvers, and base utilities. The individual \`theme.css\`/\`runtime.css\`/\`base.css\` files are still emitted for debugging.

Use \`@styleflow.app/cli/ui\` for the typed \`Ui\` wrapper; the same local-token utility classes can be nested under different StyleFlow contexts.
`);
  await ensureTextFile(resolve(cwd, ".styleflow", ".gitignore"), "*\n!.gitignore\n");
  console.log(configCreated ? "Created styleflow.config.ts and StyleFlow directories." : "StyleFlow directories checked; existing config preserved.");
}

async function buildProject(): Promise<void> {
  const result = await compileStyleflow({
    cwd,
    allowContrastWarnings,
    buildType: await buildTypeOverride(),
    manifest: await activeManifest(),
    strategy: strategyMode as StyleFlowStrategy | undefined,
    dynamic: dynamicMode as StyleFlowDynamicMode | undefined,
    minify,
    usageReport
  });
  printResult("StyleFlow build completed", result.report);
}

async function validateProject(): Promise<void> {
  const result = await validateStyleflow({
    cwd,
    allowContrastWarnings,
    buildType: await buildTypeOverride(),
    manifest: await activeManifest(),
    strategy: strategyMode as StyleFlowStrategy | undefined,
    dynamic: dynamicMode as StyleFlowDynamicMode | undefined,
    minify,
    usageReport
  });
  console.log(`StyleFlow validation passed\nStrategy: ${result.report.strategy}\nBuild type: ${result.report.buildType}\nTokens: ${result.report.sourceTokens}\n${warningSummary(result.report.warnings)}`);
}

async function watchProject(): Promise<void> {
  const configPath = resolve(cwd, "styleflow.config.ts");
  const envPath = resolve(cwd, ".env");
  const watcher = watch([configPath, envPath], { ignoreInitial: true });
  let sourcePath = "";
  let contentPaths: string[] = [];
  const refreshSourceAndBuild = async (): Promise<void> => {
    const config = await loadConfig(cwd, "styleflow.config.ts");
    const nextSourcePath = resolve(cwd, config.tokens.source);
    if (sourcePath && sourcePath !== nextSourcePath) {
      await watcher.unwatch(sourcePath);
    }
    if (sourcePath !== nextSourcePath) {
      watcher.add(nextSourcePath);
      sourcePath = nextSourcePath;
    }
    const overrideBuildType = await buildTypeOverride();
    const strategy = (strategyMode as StyleFlowStrategy | undefined)
      ?? (overrideBuildType === "production" ? "usage-based" : config.runtime.strategy ?? "usage-based");
    const nextContentPaths = strategy === "usage-based" ? config.build.content.map((path) => resolve(cwd, path)) : [];
    const removedPaths = contentPaths.filter((path) => !nextContentPaths.includes(path));
    if (removedPaths.length > 0) {
      await watcher.unwatch(removedPaths);
    }
    const addedPaths = nextContentPaths.filter((path) => !contentPaths.includes(path));
    if (addedPaths.length > 0) {
      watcher.add(addedPaths);
    }
    contentPaths = nextContentPaths;
    await buildProject();
  };
  await refreshSourceAndBuild();
  console.log("Watching StyleFlow config, tokens, environment, and usage-based content...");
  watcher.on("all", async (_event, changedPath) => {
    try {
      if (changedPath === configPath || changedPath === envPath) {
        await refreshSourceAndBuild();
      } else {
        await buildProject();
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
  });
}

function printResult(label: string, report: StyleflowReport): void {
  const kib = (report.cssBytes / 1024).toFixed(1);
  console.log(`${label}\nStrategy: ${report.strategy}\nBuild type: ${report.buildType}\nTokens: ${report.includedTokens}/${report.sourceTokens}${report.strategy === "usage-based" ? ` from ${report.contentFiles} content files` : ""}\nCSS: ${kib} KiB\nGenerated:\n${report.generatedFiles.map((file) => `- ${file}`).join("\n")}\n${warningSummary(report.warnings)}`);
}

function warningSummary(warnings: StyleflowReport["warnings"]): string {
  if (warnings.length === 0) {
    return "Warnings: 0";
  }
  return `Warnings: ${warnings.length}\n${warnings.map((warning) => `- ${warning.path}: ${warning.message}`).join("\n")}`;
}

async function buildTypeOverride(): Promise<StyleFlowBuildType | undefined> {
  const envValue = shellBuildType ?? await buildTypeFromDotEnv();
  if (envValue === undefined || envValue === "") {
    return undefined;
  }
  if (envValue !== "dev" && envValue !== "production") {
    throw new Error(`Invalid STYLEFLOW_BUILD_TYPE "${envValue}". Use dev or production.`);
  }
  return envValue;
}

async function buildTypeFromDotEnv(): Promise<string | undefined> {
  let contents: string;
  try {
    contents = await readFile(resolve(cwd, ".env"), "utf8");
  } catch {
    return undefined;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?STYLEFLOW_BUILD_TYPE\s*=\s*(.*?)\s*$/);
    if (match) {
      return match[1].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return undefined;
}

async function activeManifest(): Promise<RemoteManifest | undefined> {
  if (manifestMode !== "active") return undefined;
  const config = await loadConfig(cwd, "styleflow.config.ts");
  const url = config.cloud?.activeManifestUrl;
  if (!url) {
    throw new Error("styleflow.config.ts must define cloud.activeManifestUrl when using --manifest active.");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load active StyleFlow manifest: HTTP ${response.status}.`);
  }
  return verifyRemoteManifest(await response.json());
}

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDefaultConfig } from "../../figma/styleflow/src/config/defaults";
import { generateStyleflowCollections } from "../../figma/styleflow/src/core/tokens/generate";
import { tokenArtifactFromCollections } from "../../figma/styleflow/src/plugin/artifact/tokenArtifact";
import { canonicalJson, compileStyleflow, tokenHash, verifyRemoteManifest, type RemoteManifest } from "../src/compiler/index";
import type { StyleflowTokensFile } from "../src/format/index";

let fixture: StyleflowTokensFile;
const workdirs: string[] = [];

beforeAll(() => {
  fixture = tokenArtifactFromCollections(generateStyleflowCollections(createDefaultConfig()), "2026-05-25T00:00:00.000Z");
});

afterEach(async () => {
  await Promise.all(workdirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("StyleFlow compiler", () => {
  it("generates the complete public runtime contract deterministically", async () => {
    const first = await compileFixture(fixture);
    const second = await compileFixture(fixture);

    expect(first.outputs).toEqual(second.outputs);
    expect(first.outputs["runtime.css"]).toContain('[data-theme="dark"]');
    expect(first.outputs["runtime.css"]).toContain('[data-surface-type="interactive-primary"]:hover:not([data-interaction-state])');
    expect(first.outputs["runtime.css"]).toContain('[data-interaction-state="focus"]');
    expect(first.outputs["runtime.css"]).toContain("@media (min-width: 640px)");
    expect(first.outputs["runtime.css"]).toContain("--typography-heading-default-heading-1-size");
    expect(first.outputs["runtime.css"]).toContain('[data-text-style="heading-default-heading-1"]');
    expect(first.outputs["runtime.css"]).not.toContain("--typography-heading-1-size");
    expect(first.outputs["runtime.css"]).toContain("--sf-color-intensity--local--surface: var(--sf-color-tone--1--local--surface);");
    expect(first.outputs["theme.css"]).toContain("@theme inline");
    expect(first.outputs["theme.css"]).toContain("--container-local-container");
    expect(first.outputs["theme.css"]).toContain("--text-heading-default-heading-1");
    expect(first.outputs["base.css"]).toContain(".sf-ui");
    expect(first.outputs["base.css"]).toContain('[data-foreground="muted"]');
    expect(first.outputs["base.css"]).toContain("--sf-font-body");
    expect(first.outputs["types.ts"]).not.toContain("FeedbackType");
    expect(first.outputs["types.ts"]).toContain('export type TextStyleId = "body-default-body-lg"');
    expect(first.outputs["contract.json"]).toContain('"tones"');
    expect(first.outputs["contract.json"]).toContain('"heading-default-heading-1"');
    expect(first.outputs["contract.ts"]).toContain("styleflowTextStyles");
    expect(first.outputs["runtime.css"]).not.toContain("data-feedback");
    expect(first.report.sourceTokens).toBeGreaterThan(1000);
    expect(first.report.warnings[0].path).toBe("output.css");
  });

  it("emits reset blocks so a default-mode axis nested under a non-default value returns to baseline", async () => {
    const css = (await compileFixture(fixture)).outputs["runtime.css"];

    // Ogni asse a valore di default deve essere resettabile esplicitamente, non solo su :root.
    expect(css).toContain(':root,\n[data-color-tone="neutral"]');
    expect(css).toContain(':root,\n[data-color-intensity="1"]');
    expect(css).toContain(':root,\n[data-layout-density="md"]');
    expect(css).toContain(':root,\n[data-layout-role="none"]');

    // Il blocco di reset deve precedere i blocchi non-default: a parità di specificità
    // (0,1,0) tra :root e [data-color-tone="..."], su <html data-color-tone="accent">
    // deve continuare a vincere accent (ordine sorgente).
    expect(css.indexOf('[data-color-tone="neutral"]')).toBeLessThan(css.indexOf('[data-color-tone="accent"]'));
    expect(css.indexOf('[data-color-tone="neutral"]')).toBeLessThan(css.indexOf('[data-color-tone="main"]'));
    expect(css.indexOf('[data-layout-role="none"]')).toBeLessThan(css.indexOf('[data-layout-role="section"]'));

    // Il reset del tono ripristina la variabile di tono al valore neutral.
    expect(css).toContain("--sf-color-tone--1--local--surface: var(--sf-semantic-color--neutral--1--local--surface);");
  });

  it("blocks unresolved aliases", async () => {
    const invalid = structuredClone(fixture);
    const variable = invalid.collections.find((collection) => collection.name === "BrandColors")!.variables[0];
    variable.valuesByMode.Base = { alias: { collection: "Primitives", name: "missing/token" } };

    await expect(compileFixture(invalid)).rejects.toThrow("Unresolved alias");
    await expect(compileFixture(invalid, { allowContrastWarnings: true })).rejects.toThrow("Unresolved alias");
  });

  it("blocks unrecognized numeric CSS paths", async () => {
    const invalid = structuredClone(fixture);
    invalid.collections.find((collection) => collection.name === "Primitives")!.variables.push({
      name: "unsupported/value",
      type: "FLOAT",
      valuesByMode: { Base: 12 }
    });

    await expect(compileFixture(invalid)).rejects.toThrow("Numeric token does not have a supported CSS dimension mapping");
  });

  it("blocks foreground-primary contrast failures", async () => {
    const invalid = contrastFailureFixture();

    await expect(compileFixture(invalid)).rejects.toThrow("Foreground primary contrast is below 4.5:1");
  });

  it("can emit output while reporting contrast failures as warnings", async () => {
    const result = await compileFixture(contrastFailureFixture(), { allowContrastWarnings: true });

    expect(result.outputs["runtime.css"]).toContain('[data-theme="dark"]');
    expect(result.report.errors).toEqual([]);
    expect(result.report.warnings).toContainEqual({
      level: "warning",
      path: "SemanticColor/main/1/light",
      message: "Foreground primary contrast is below 4.5:1."
    });
  });

  it("prunes production CSS to statically used runtime selections and alias dependencies", async () => {
    const development = await compileFixture(fixture);
    const production = await compileFixture(fixture, {
      buildType: "production",
      content: `<Ui tone="main" intensity="2" layoutRole="control" density="md" surfaceType="interactive-primary" className="button" />`
    });

    expect(production.report.buildType).toBe("production");
    expect(production.report.contentFiles).toBe(1);
    expect(production.report.includedTokens).toBeLessThan(production.report.sourceTokens);
    expect(production.outputs["runtime.css"]).toContain('[data-surface-type="interactive-primary"]');
    expect(production.outputs["runtime.css"]).not.toContain('[data-surface-type="interactive-secondary"]');
    expect(production.outputs).not.toHaveProperty("tokens.css");
    expect(production.outputs["styleflow.css"]).not.toContain("--light:");
    expect(production.outputs["styleflow.css"].length).toBeLessThan(development.outputs["styleflow.css"].length);
    expect(production.outputs["runtime.css"].length).toBeLessThan(development.outputs["runtime.css"].length);
  });

  it("prunes text style runtime selectors to detected usage", async () => {
    const result = await compileFixture(fixture, {
      buildType: "production",
      content: `<Heading data-text-style="heading-default-heading-2">Title</Heading>`
    });

    expect(result.outputs["runtime.css"]).toContain('[data-text-style="heading-default-heading-2"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-text-style="body-default-body-md"]');
    expect(result.outputs["runtime.css"]).toContain("--typography-heading-default-heading-2-size");
    expect(result.outputs["runtime.css"]).not.toContain("--typography-body-default-body-md-size");
  });

  it("blocks dynamic runtime axes by default", async () => {
    await expect(compileFixture(fixture, {
      buildType: "production",
      content: `<Ui tone={tone} intensity="1" />`
    })).rejects.toThrow("Dynamic tone is not covered");
  });

  it("retains a contract runtime axis when dynamic contract mode is requested", async () => {
    const result = await compileFixture(fixture, {
      buildType: "production",
      dynamic: "contract",
      content: `<Ui tone={tone} intensity="1" />`
    });

    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="support-3"]');
  });

  it("uses the token contract, not global constants, when expanding dynamic axes", async () => {
    const result = await compileFixture(reducedToneFixture(), {
      allowContrastWarnings: true,
      buildType: "production",
      dynamic: "contract",
      content: `<Ui tone={tone} intensity="1" />`
    });

    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="main"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="support-1"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="contrast"]');
  });

  it("allows dynamic runtime axes when safelisted", async () => {
    const result = await compileFixture(fixture, {
      buildType: "production",
      safelist: { tones: ["main"] },
      content: `<Ui tone={tone} intensity="1" />`
    });

    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="main"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="support-3"]');
  });

  it("allows UI spreads when a usage manifest covers runtime axes", async () => {
    const result = await compileFixture(fixture, {
      buildType: "production",
      usageManifest: {
        themes: ["light"],
        tones: ["main"],
        intensities: ["1"],
        layoutRoles: ["control"],
        densities: ["md"],
        surfaceTypes: ["interactive-primary"],
        textStyles: ["body-default-body-md"]
      },
      content: `<UI {...attrs} />`
    });

    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="main"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="support-3"]');
  });

  it("scans Astro files for production runtime selections", async () => {
    const result = await compileFixture(fixture, {
      buildType: "production",
      contentPath: "src/Block.astro",
      content: `<UI tone="accent" intensity="8" layoutRole="section" density="lg" surfaceType="raised" />`
    });

    expect(result.report.contentFiles).toBe(1);
    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="accent"]');
    expect(result.outputs["runtime.css"]).toContain('[data-layout-role="section"]');
    expect(result.outputs["runtime.css"]).toContain('[data-surface-type="raised"]');
  });

  it("compiles a dark-only artifact with reduced tone and layout role axes", async () => {
    const reduced = reducedFixture();
    const result = await compileFixture(reduced, { allowContrastWarnings: true });

    expect(result.outputs["runtime.css"]).toContain(':root,\n[data-theme="dark"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-theme="light"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="accent"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-layout-role="tile"]');
    expect(result.outputs["types.ts"]).toContain('export type ThemeMode = "dark"');
    expect(result.outputs["types.ts"]).toContain('export type LayoutRole = "control" | "none"');
  });

  it("rejects a production reference to a tone omitted from the artifact", async () => {
    await expect(compileFixture(reducedFixture(), {
      allowContrastWarnings: true,
      buildType: "production",
      content: `<Ui tone="accent" />`
    })).rejects.toThrow("Color tone is not generated: accent");
  });

  it("limits a build to a verified active manifest contract", async () => {
    const manifest = signedManifest(fixture, {
      themes: ["light"],
      tones: ["main"],
      intensities: ["5"],
      layoutRoles: ["control"],
      densities: ["md"]
    });
    const result = await compileFixture(fixture, { manifest: verifyRemoteManifest(manifest) });

    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="main"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="accent"]');
  });

  it("rejects malformed manifest integrity and a token hash mismatch", async () => {
    const manifest = signedManifest(fixture, {
      themes: ["light"],
      tones: ["main"],
      intensities: ["5"],
      layoutRoles: ["control"],
      densities: ["md"]
    });

    expect(() => verifyRemoteManifest({ ...manifest, integrity: "sha256-bad" })).toThrow("integrity");
    await expect(compileFixture(fixture, { manifest: { ...manifest, tokenHash: "sha256-other" } })).rejects.toThrow("token hash");
  });

  it("emits the full contract and prunes runtime under the public-contract strategy", async () => {
    const full = await compileFixture(fixture, { strategy: "full" });
    const contract = await compileFixture(fixture, { strategy: "public-contract" });

    expect(contract.report.strategy).toBe("public-contract");
    // public-contract still covers the entire declared runtime contract
    expect(contract.outputs["runtime.css"]).toContain('[data-theme="dark"]');
    expect(contract.outputs["runtime.css"]).toContain('[data-color-tone="accent"]');
    expect(contract.outputs["runtime.css"]).toContain('[data-surface-type="interactive-primary"]');
    expect(contract.outputs["runtime.css"]).toContain('[data-text-style="heading-default-heading-1"]');
    // tokens.css is no longer emitted; there is no legacy per-mode "--light:" dump
    expect(full.outputs).not.toHaveProperty("tokens.css");
    expect(full.outputs["styleflow.css"]).not.toContain("--light:");
    expect(contract.outputs["styleflow.css"]).not.toContain("--light:");
    // public-contract prunes the runtime/theme layer to referenced leaves; full keeps everything
    expect(contract.outputs["styleflow.css"].length).toBeLessThan(full.outputs["styleflow.css"].length);
    expect(contract.report.includedTokens).toBeLessThan(contract.report.sourceTokens);
    // the "did not find source files" warning is usage-based only and must not fire here
    expect(contract.report.warnings.some((warning) => warning.path === "build.content")).toBe(false);
  });

  it("collapses transparent layers and exposes a single dangling-free styleflow.css", async () => {
    const result = await compileFixture(fixture, { strategy: "public-contract" });
    const css = result.outputs["styleflow.css"];

    // styleflow.css is the single bundled entry; tokens.css is gone
    expect(result.outputs).not.toHaveProperty("tokens.css");
    expect(css).toContain("@theme inline");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain(".sf-ui");

    // Primitives and OnSurfaceInteractive* are collapsed/inlined, never emitted as --sf-*
    expect(css).not.toContain("--sf-primitives");
    expect(css).not.toContain("--sf-on-surface-interactive");
    // BrandColors stay named but carry resolved hex (rgb), and dimensions map to Tailwind
    expect(css).toMatch(/--sf-brand-colors[^:]*:\s*rgb\(/);
    expect(css).toContain("calc(var(--spacing) *");

    // No dangling references: every var(--sf-*) used WITHOUT a fallback must be defined.
    // (The --sf-font-*/--sf-weight-*/--sf-leading-* typography knobs live in the user's
    // override file and are always referenced with a fallback, so they are excluded.)
    const defined = new Set(Array.from(css.matchAll(/(--sf-[a-z0-9-]+)\s*:/g), (match) => match[1]));
    const referenced = new Set(Array.from(css.matchAll(/var\((--sf-[a-z0-9-]+)\s*\)/g), (match) => match[1]));
    const dangling = Array.from(referenced).filter((name) => !defined.has(name));
    expect(dangling).toEqual([]);
  });

  it("uses usage-based as the normalized default strategy", async () => {
    const result = await compileFixture(fixture, {
      omitRuntime: true,
      content: `<Ui tone="main" intensity="2" />`
    });

    expect(result.report.strategy).toBe("usage-based");
    expect(result.outputs["runtime.css"]).toContain('[data-color-tone="main"]');
    expect(result.outputs["runtime.css"]).not.toContain('[data-color-tone="support-3"]');
  });

  it("emits usage reports, minified CSS, and Tailwind safelists from usage manifests", async () => {
    const result = await compileFixture(fixture, {
      buildType: "production",
      usageReport: true,
      minify: true,
      usageManifest: {
        tones: ["main"],
        tailwindClasses: ["grid", "md:grid-cols-2"]
      },
      content: `<Ui tone={tone} intensity="1" />`
    });

    expect(result.outputs["usage-report.json"]).toContain('"tones"');
    expect(result.report.usageManifestFiles).toEqual(["usage.json"]);
    expect(result.outputs["tailwind-safelist.css"]).toContain('@source inline("grid md:grid-cols-2")');
    expect(result.outputs["runtime.css"]).not.toContain("\n\n");
  });
});

function contrastFailureFixture(): StyleflowTokensFile {
  const invalid = structuredClone(fixture);
  const semantic = invalid.collections.find((collection) => collection.name === "SemanticColor")!;
  const surface = semantic.variables.find((variable) => variable.name === "main/1/local/surface")!;
  const foreground = semantic.variables.find((variable) => variable.name === "main/1/local/foreground-primary")!;
  foreground.valuesByMode.light = surface.valuesByMode.light;
  return invalid;
}

function reducedFixture(): StyleflowTokensFile {
  const config = createDefaultConfig();
  config.colors.tones.accent.enabled = false;
  config.colors.tones.success.enabled = false;
  config.themes = ["dark"];
  config.layoutRoles = ["control", "none"];
  return tokenArtifactFromCollections(generateStyleflowCollections(config), "2026-05-25T00:00:00.000Z");
}

function reducedToneFixture(): StyleflowTokensFile {
  const config = createDefaultConfig();
  for (const tone of ["accent", "contrast", "success", "warning", "critical", "support-1", "support-2", "support-3"] as const) {
    config.colors.tones[tone].enabled = false;
  }
  return tokenArtifactFromCollections(generateStyleflowCollections(config), "2026-05-25T00:00:00.000Z");
}

function signedManifest(tokens: StyleflowTokensFile, includedInBuild: RemoteManifest["includedInBuild"]): RemoteManifest {
  const unsigned = {
    project: "cloud-project",
    version: "1",
    tokenHash: tokenHash(tokens),
    generatedAt: "2026-05-26T00:00:00.000Z",
    publicContract: includedInBuild,
    includedInBuild,
    deprecated: {}
  };
  const canonical = canonicalJson(unsigned);
  return {
    ...unsigned,
    hash: `sha256-${createHash("sha256").update(canonical).digest("hex")}`,
    integrity: `sha256-${createHash("sha256").update(canonical).digest("base64")}`
  };
}

async function compileFixture(tokens: StyleflowTokensFile, options: {
  allowContrastWarnings?: boolean;
  buildType?: "dev" | "production";
  strategy?: "public-contract" | "usage-based" | "full";
  dynamic?: "error" | "contract";
  minify?: boolean;
  usageReport?: boolean;
  safelist?: Record<string, string[] | "*">;
  usageManifest?: unknown;
  omitRuntime?: boolean;
  content?: string;
  contentPath?: string;
  manifest?: RemoteManifest;
} = {}) {
  const cwd = await mkdtemp(join(tmpdir(), "styleflow-compiler-"));
  workdirs.push(cwd);
  await writeFile(join(cwd, "styleflow.tokens.json"), JSON.stringify(tokens), "utf8");
  const usageManifests = [];
  if (options.usageManifest) {
    await writeFile(join(cwd, "usage.json"), JSON.stringify(options.usageManifest), "utf8");
    usageManifests.push("./usage.json");
  }
  if (options.content) {
    await mkdir(join(cwd, "src"), { recursive: true });
    await writeFile(join(cwd, options.contentPath ?? "src/App.tsx"), options.content, "utf8");
  }
  await writeFile(join(cwd, "styleflow.config.mjs"), `export default {
  tokens: { source: "./styleflow.tokens.json" },
  output: { dir: ".styleflow", minify: ${options.minify ? "true" : "false"} },
  tailwind: { enabled: true },
  ${options.omitRuntime ? "" : `runtime: { strategy: "${options.strategy ?? "full"}", dynamic: "${options.dynamic ?? "error"}", safelist: ${JSON.stringify(options.safelist ?? {})}, usageManifests: ${JSON.stringify(usageManifests)} },`}
  typography: { emitBase: true, emitOverrideTemplate: false, overrideFile: "./src/styles/styleflow-typography.css" },
  utilities: { emit: true },
  build: { type: "dev", content: ["./src"] }
};\n`, "utf8");
  const {
    content: _content,
    contentPath: _contentPath,
    strategy: _strategy,
    dynamic: _dynamic,
    safelist: _safelist,
    usageManifest: _usageManifest,
    omitRuntime: _omitRuntime,
    ...compileOptions
  } = options;
  return compileStyleflow({ cwd, configPath: "styleflow.config.mjs", write: false, ...compileOptions });
}

import { describe, expect, it } from "vitest";
import {
  createDefaultStyleflowConfig,
  dimensionScaleOptions,
  generateTokensFromConfig,
  isTypographyBreakpointInherited,
  parseStyleflowConfig,
  setRoleBreakpointInheritance,
  setSemanticSurfaceRef,
  setTypographyBreakpointInheritance,
  stringifyStyleflowConfig,
  updateTone,
  updateToneAlpha,
  updateTypographyBreakpointRef,
  validateStyleflowConfig
} from "../src/authoring/index";

describe("StyleFlow config authoring contract", () => {
  it("round-trips a plugin-compatible config and generates cloud token artifacts", () => {
    const config = updateTone(createDefaultStyleflowConfig(), "main", "baseHex", "#498bc8");
    const parsed = parseStyleflowConfig(JSON.parse(stringifyStyleflowConfig(config)) as unknown);
    const generated = generateTokensFromConfig(parsed, "2026-05-26T12:00:00.000Z");

    expect(parsed.project.name).toBe("Styleflow");
    expect(generated.version).toBe("1.0.0");
    expect(generated.source.kind).toBe("cloud");
    expect(generated.source.exportedAt).toBe("2026-05-26T12:00:00.000Z");
    expect(generated.collections.find((collection) => collection.name === "BrandColors")).toBeTruthy();
    expect(generated.collections.find((collection) => collection.name === "Typography")?.variables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "heading/default/heading-1/style",
        type: "STRING",
        valuesByMode: { Base: "Bold" }
      }),
      expect.objectContaining({
        name: "heading/default/heading-1/weight",
        type: "FLOAT",
        valuesByMode: { Base: 700 }
      })
    ]));
    expect(validateStyleflowConfig(parsed).some((issue) => issue.level === "error")).toBe(false);
  });

  it("edits high-level color values and real semantic references without mutating the saved input", () => {
    const config = createDefaultStyleflowConfig();
    const changedTone = updateTone(config, "accent", "baseHex", "#7bac3c");
    const changedRef = setSemanticSurfaceRef(changedTone, "light", "main", "1", "surface", {
      tone: "accent",
      stop: "100"
    });
    const tokens = generateTokensFromConfig(changedRef, "2026-05-26T00:00:00.000Z");
    const semantic = tokens.collections.find((collection) => collection.name === "SemanticColor");

    expect(changedRef.colors.tones.accent.baseHex).toBe("#7bac3c");
    expect(changedRef.semanticSurfaces.light?.main?.["1"]?.surface).toEqual({ tone: "accent", stop: "100" });
    expect(config.colors.tones.accent.baseHex).not.toBe("#7bac3c");
    expect(semantic?.variables.some((variable) => variable.name === "main/1/local/surface")).toBe(true);
  });

  it("generates soft and strong alpha tokens for scrim authoring", () => {
    const config = setSemanticSurfaceRef(createDefaultStyleflowConfig(), "light", "main", "1", "surface-scrim", {
      tone: "neutral",
      alpha: "soft/40"
    });
    const tokens = generateTokensFromConfig(config, "2026-05-26T00:00:00.000Z");
    const brand = tokens.collections.find((collection) => collection.name === "BrandColors");
    const semantic = tokens.collections.find((collection) => collection.name === "SemanticColor");

    expect(brand?.variables.find((variable) => variable.name === "neutral/alpha/soft/40")?.valuesByMode.light).toEqual({
      alias: {
        collection: "Primitives",
        name: "color/primitive/neutral/alpha/000/40"
      }
    });
    expect(semantic?.variables.find((variable) => variable.name === "main/1/local/surface-scrim")?.valuesByMode.light).toEqual({
      alias: {
        collection: "BrandColors",
        name: "neutral/alpha/soft/40"
      }
    });
    expect(brand?.variables.some((variable) => variable.name === "neutral/alpha/white")).toBe(false);
    expect(validateStyleflowConfig(config).some((issue) => issue.level === "error")).toBe(false);
  });

  it("updates alpha source intensity per theme and variant without mutating the saved input", () => {
    const config = createDefaultStyleflowConfig();
    const changed = updateToneAlpha(config, "main", "light", "soft", "300");
    const tokens = generateTokensFromConfig(changed, "2026-05-26T00:00:00.000Z");
    const brand = tokens.collections.find((collection) => collection.name === "BrandColors");

    expect(config.colors.tones.main.alpha.light.soft).toBe("200");
    expect(changed.colors.tones.main.alpha.light.soft).toBe("300");
    expect(brand?.variables.find((variable) => variable.name === "main/alpha/soft/40")?.valuesByMode.light).toEqual({
      alias: {
        collection: "Primitives",
        name: "color/primitive/blue/alpha/300/40"
      }
    });
    expect(validateStyleflowConfig(changed).some((issue) => issue.level === "error")).toBe(false);
  });

  it("keeps layout breakpoint inheritance and container max-width defaults in the public authoring API", () => {
    let config = createDefaultStyleflowConfig();

    expect(config.dimensions.layout.panel.md.sm.gap).toEqual({ inherit: true });
    expect(config.dimensions.layout.container.md.sm["container-max-width"]).toEqual({ container: "640" });

    config = setRoleBreakpointInheritance(config, "container", "sm", true);

    expect(config.dimensions.layout.container.md.sm["padding-x"]).toEqual({ inherit: true });
    expect(config.dimensions.layout.container.md.sm["container-max-width"]).toEqual({ container: "640" });
  });

  it("updates typography breakpoint size and line-height through the public authoring API", () => {
    const config = createDefaultStyleflowConfig();
    const updatedSize = updateTypographyBreakpointRef(config, "body-md", "size", "lg", { scale: "15" });
    const updatedLineHeight = updateTypographyBreakpointRef(updatedSize, "body-md", "lineHeight", "lg", { value: 28 });
    const tokens = generateTokensFromConfig(updatedLineHeight, "2026-05-26T00:00:00.000Z");
    const primitives = tokens.collections.find((collection) => collection.name === "Primitives");

    expect(config.typography.roles["body-md"].size.lg).toEqual({ scale: "4" });
    expect(config.typography.roles["body-md"].lineHeight.lg).toEqual({ scale: "6" });
    expect(dimensionScaleOptions(config).some((entry) => entry.name === "120")).toBe(true);
    expect(updatedLineHeight.dimensions.scale.find((entry) => entry.name === "15")).toEqual({ name: "15", value: 60 });
    expect(updatedLineHeight.typography.roles["body-md"].size.lg).toEqual({ scale: "15" });
    expect(updatedLineHeight.typography.roles["body-md"].lineHeight.lg).toEqual({ value: 28 });
    expect(primitives?.variables.find((variable) => variable.name === "dimension/primitive/scale/15")?.valuesByMode.Base).toBe(60);
    expect(validateStyleflowConfig(updatedLineHeight).some((issue) => issue.level === "error")).toBe(false);
  });

  it("inherits typography breakpoint values from the smaller breakpoint", () => {
    let config = createDefaultStyleflowConfig();
    config = updateTypographyBreakpointRef(config, "body-md", "size", "sm", { scale: "5" });
    config = updateTypographyBreakpointRef(config, "body-md", "lineHeight", "sm", { scale: "8" });
    const inherited = setTypographyBreakpointInheritance(config, "body-md", "md", true);
    const tokens = generateTokensFromConfig(inherited, "2026-05-26T00:00:00.000Z");
    const breakpoints = tokens.collections.find((collection) => collection.name === "Breakpoints");

    expect(isTypographyBreakpointInherited(inherited, "body-md", "md")).toBe(true);
    expect(validateStyleflowConfig(inherited).some((issue) => issue.level === "error")).toBe(false);
    expect(breakpoints?.variables.find((variable) => variable.name === "typography/body/default/body-md/size")?.valuesByMode.md).toEqual({
      alias: {
        collection: "Primitives",
        name: "dimension/primitive/scale/5"
      }
    });
    expect(breakpoints?.variables.find((variable) => variable.name === "typography/body/default/body-md/line-height")?.valuesByMode.md).toEqual({
      alias: {
        collection: "Primitives",
        name: "dimension/primitive/scale/8"
      }
    });
  });

  it("normalizes legacy density-level layout values through parseStyleflowConfig", () => {
    const base = createDefaultStyleflowConfig();
    const parsed = parseStyleflowConfig({
      ...base,
      dimensions: {
        ...base.dimensions,
        layout: {
          chip: {
            sm: {
              "padding-x": { scale: "8" }
            }
          },
          container: {
            md: {
              "container-max-width": { value: 900 }
            }
          }
        }
      }
    });

    expect(parsed.dimensions.layout.chip.sm.xs["padding-x"]).toEqual({ scale: "8" });
    expect(parsed.dimensions.layout.chip.sm.sm["padding-x"]).toEqual({ inherit: true });
    expect(parsed.dimensions.layout.container.md.xs["container-max-width"]).toEqual({ container: "900" });
    expect(parsed.dimensions.layout.container.md.sm["container-max-width"]).toEqual({ container: "640" });
    expect(validateStyleflowConfig(parsed).some((issue) => issue.level === "error")).toBe(false);
  });
});

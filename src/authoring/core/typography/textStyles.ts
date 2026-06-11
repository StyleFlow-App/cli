import type { LayoutValueRef, StyleflowConfig, TypographyFontSlot } from "../../shared/types.js";
import { dimensionScaleEntryForName } from "../layout/scaleCatalog.js";

export type TypographyStyleGroup = "heading" | "body";
export type TypographyStyleVariant = "light" | "strong" | "default";

export interface TypographyTextStyleSpec {
  name: string;
  group: TypographyStyleGroup;
  variant: TypographyStyleVariant;
  roleName: string;
  sourceRole: string;
  family: string;
  weight: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: number;
}

const variants: TypographyStyleVariant[] = ["light", "strong", "default"];

export function generateTypographyTextStyles(config: StyleflowConfig): TypographyTextStyleSpec[] {
  return (["heading", "body"] as TypographyStyleGroup[]).flatMap((group) =>
    variants.flatMap((variant) =>
      baseRoles(config, group).map((roleName) => createTextStyleSpec(config, group, roleName, variant))
    )
  );
}

export function typographyVariablePrefix(spec: TypographyTextStyleSpec): string {
  return `${spec.group}/${spec.variant}/${spec.roleName}`;
}

function baseRoles(config: StyleflowConfig, group: TypographyStyleGroup): string[] {
  const pattern = group === "heading" ? /^heading-[0-9]+$/ : /^body-(?:lg|md|sm|xs)$/;
  return Object.keys(config.typography.roles).filter((roleName) => pattern.test(roleName));
}

function createTextStyleSpec(
  config: StyleflowConfig,
  group: TypographyStyleGroup,
  roleName: string,
  variant: TypographyStyleVariant
): TypographyTextStyleSpec {
  const role = config.typography.roles[roleName];
  const slot = fontSlot(config, role.fontSlotId);
  const weight = variant === "light" ? slot.lightWeight : variant === "strong" ? slot.strongWeight : role.defaultWeight;
  return {
    name: `${group}/${variant}/${roleName}`,
    group,
    variant,
    roleName,
    sourceRole: roleName,
    family: slot.family,
    weight,
    fontWeight: fontWeight(weight),
    fontSize: resolveTextValue(config, role.size.xs),
    lineHeight: resolveTextValue(config, role.lineHeight.xs)
  };
}

function fontSlot(config: StyleflowConfig, id: string): TypographyFontSlot {
  return config.typography.fonts.find((slot) => slot.enabled && slot.id === id)
    ?? config.typography.fonts.find((slot) => slot.id === "main")!;
}

export function fontWeight(value: string): number {
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  return ({ thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 } as Record<string, number>)[normalized] ?? 400;
}

function resolveTextValue(config: StyleflowConfig, ref: LayoutValueRef): number {
  if ("value" in ref) {
    return ref.value;
  }
  if ("scale" in ref) {
    const entry = dimensionScaleEntryForName(config, ref.scale);
    if (entry) {
      return entry.value;
    }
  }
  throw new Error("Text styles require finite scale or numeric typography values at the xs breakpoint.");
}

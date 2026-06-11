import { BREAKPOINTS, LAYOUT_DENSITIES, LAYOUT_PROPERTIES } from "../../shared/constants.js";
import type { BreakpointName, LayoutDensity, LayoutProperty, LayoutRole, LayoutValueRef, StyleflowConfig } from "../../shared/types.js";
import { canInheritLayoutProperty, isInheritedLayoutRef, resolveLayoutValue } from "../../core/layout/inheritance.js";
import { dimensionScaleOptions, ensureDimensionScaleEntry } from "../../core/layout/scaleCatalog.js";

export function setLayoutValue(
  config: StyleflowConfig,
  role: LayoutRole,
  density: LayoutDensity,
  breakpoint: BreakpointName,
  property: LayoutProperty,
  value: LayoutValueRef
): StyleflowConfig {
  const base = "scale" in value ? ensureDimensionScaleEntry(config, value.scale) : config;
  const next = cloneConfig(base);
  next.dimensions.layout[role][density][breakpoint][property] = value;
  return next;
}

export function setRoleBreakpointInheritance(
  config: StyleflowConfig,
  role: LayoutRole,
  breakpoint: BreakpointName,
  enabled: boolean
): StyleflowConfig {
  if (breakpoint === "xs") {
    return config;
  }
  const next = cloneConfig(config);
  for (const density of LAYOUT_DENSITIES) {
    for (const property of LAYOUT_PROPERTIES) {
      if (!canInheritLayoutProperty(role, property)) {
        continue;
      }
      next.dimensions.layout[role][density][breakpoint][property] = enabled
        ? { inherit: true }
        : resolveLayoutValue(config, role, density, breakpoint, property);
    }
  }
  return next;
}

export function isRoleBreakpointInherited(config: StyleflowConfig, role: LayoutRole, breakpoint: BreakpointName): boolean {
  if (breakpoint === "xs") {
    return false;
  }
  return LAYOUT_DENSITIES.every((density) =>
    LAYOUT_PROPERTIES
      .filter((property) => canInheritLayoutProperty(role, property))
      .every((property) => isInheritedLayoutRef(config.dimensions.layout[role][density][breakpoint][property]))
  );
}

export function layoutValueToSelectValue(ref: LayoutValueRef): string {
  if ("scale" in ref) {
    return `scale:${ref.scale}`;
  }
  if ("stroke" in ref) {
    return `stroke:${ref.stroke}`;
  }
  if ("container" in ref) {
    return `container:${ref.container}`;
  }
  if ("value" in ref) {
    return `value:${ref.value}`;
  }
  if ("breakpoint" in ref) {
    return `breakpoint:${ref.breakpoint}`;
  }
  return "inherit";
}

export function selectValueToLayoutValue(value: string): LayoutValueRef {
  const [kind, raw] = value.split(":");
  if (kind === "scale") {
    return { scale: raw };
  }
  if (kind === "stroke") {
    return { stroke: raw };
  }
  if (kind === "container") {
    return { container: raw };
  }
  if (kind === "value") {
    return { value: Number(raw) };
  }
  if (kind === "breakpoint") {
    return { breakpoint: raw };
  }
  return { inherit: true };
}

export function resolvedSelectValue(
  config: StyleflowConfig,
  role: LayoutRole,
  density: LayoutDensity,
  breakpoint: BreakpointName,
  property: LayoutProperty
): string {
  return layoutValueToSelectValue(resolveLayoutValue(config, role, density, breakpoint, property));
}

export function layoutOptionsForProperty(config: StyleflowConfig, property: LayoutProperty): Array<{ label: string; value: string }> {
  if (property === "border-width") {
    return config.dimensions.strokes.map((entry) => ({ label: entry.name, value: `stroke:${entry.name}` }));
  }
  if (property === "container-max-width") {
    return config.dimensions.containerScale.map((entry) => ({ label: entry.name, value: `container:${entry.name}` }));
  }
  return dimensionScaleOptions(config).map((entry) => ({ label: entry.name, value: `scale:${entry.name}` }));
}

export function previousBreakpointLabel(breakpoint: BreakpointName): string {
  const index = BREAKPOINTS.indexOf(breakpoint);
  return index > 0 ? BREAKPOINTS[index - 1] : "none";
}

function cloneConfig(config: StyleflowConfig): StyleflowConfig {
  return JSON.parse(JSON.stringify(config)) as StyleflowConfig;
}

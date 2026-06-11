import { BREAKPOINTS } from "../../shared/constants.js";
import type { BreakpointName, LayoutDensity, LayoutProperty, LayoutRole, LayoutValueRef, StyleflowConfig } from "../../shared/types.js";

export function canInheritLayoutProperty(role: LayoutRole, property: LayoutProperty): boolean {
  return !(role === "container" && property === "container-max-width");
}

export function isInheritedLayoutRef(ref: LayoutValueRef): ref is { inherit: true } {
  return "inherit" in ref && ref.inherit === true;
}

export function previousBreakpointOf(breakpoint: BreakpointName): BreakpointName | null {
  const index = BREAKPOINTS.indexOf(breakpoint);
  if (index <= 0) {
    return null;
  }
  return BREAKPOINTS[index - 1];
}

export function resolveLayoutValue(
  config: StyleflowConfig,
  role: LayoutRole,
  density: LayoutDensity,
  breakpoint: BreakpointName,
  property: LayoutProperty
): LayoutValueRef {
  return resolveLayoutValueInternal(config, role, density, breakpoint, property, 0);
}

function resolveLayoutValueInternal(
  config: StyleflowConfig,
  role: LayoutRole,
  density: LayoutDensity,
  breakpoint: BreakpointName,
  property: LayoutProperty,
  depth: number
): LayoutValueRef {
  const ref = config.dimensions.layout[role][density][breakpoint][property];
  if (!isInheritedLayoutRef(ref)) {
    return ref;
  }
  const previous = previousBreakpointOf(breakpoint);
  if (!previous || depth > BREAKPOINTS.length) {
    return ref;
  }
  return resolveLayoutValueInternal(config, role, density, previous, property, depth + 1);
}

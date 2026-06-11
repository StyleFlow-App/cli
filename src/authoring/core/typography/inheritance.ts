import type { BreakpointName, LayoutValueRef, StyleflowConfig } from "../../shared/types.js";
import { BREAKPOINTS } from "../../shared/constants.js";
import { isInheritedLayoutRef, previousBreakpointOf } from "../layout/inheritance.js";

export type TypographyBreakpointField = "size" | "lineHeight";

export function resolveTypographyValue(
  config: StyleflowConfig,
  roleName: string,
  field: TypographyBreakpointField,
  breakpoint: BreakpointName
): LayoutValueRef {
  return resolveTypographyValueInternal(config, roleName, field, breakpoint, 0);
}

function resolveTypographyValueInternal(
  config: StyleflowConfig,
  roleName: string,
  field: TypographyBreakpointField,
  breakpoint: BreakpointName,
  depth: number
): LayoutValueRef {
  const ref = config.typography.roles[roleName]?.[field]?.[breakpoint];
  if (!ref || !isInheritedLayoutRef(ref)) {
    return ref ?? { inherit: true };
  }
  const previous = previousBreakpointOf(breakpoint);
  if (!previous || depth > BREAKPOINTS.length) {
    return ref;
  }
  return resolveTypographyValueInternal(config, roleName, field, previous, depth + 1);
}

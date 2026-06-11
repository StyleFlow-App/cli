import { BREAKPOINTS, COLLECTION_NAMES } from "../../shared/constants.js";
import type { CollectionSpec, StyleflowConfig } from "../../shared/types.js";
import { addVariable, alias, createCollection } from "../tokens/model.js";
import { layoutValueToToken } from "../tokens/references.js";
import { resolveTypographyValue } from "./inheritance.js";
import { generateTypographyTextStyles, typographyVariablePrefix } from "./textStyles.js";

export function appendTypographyToBreakpoints(breakpoints: CollectionSpec, config: StyleflowConfig): void {
  for (const spec of generateTypographyTextStyles(config)) {
    const prefix = typographyVariablePrefix(spec);
    addVariable(
      breakpoints,
      `typography/${prefix}/size`,
      "FLOAT",
      Object.fromEntries(BREAKPOINTS.map((breakpoint) => [breakpoint, layoutValueToToken(resolveTypographyValue(config, spec.sourceRole, "size", breakpoint))]))
    );
    addVariable(
      breakpoints,
      `typography/${prefix}/line-height`,
      "FLOAT",
      Object.fromEntries(BREAKPOINTS.map((breakpoint) => [breakpoint, layoutValueToToken(resolveTypographyValue(config, spec.sourceRole, "lineHeight", breakpoint))]))
    );
  }
}

export function generateTypographyCollection(config: StyleflowConfig): CollectionSpec {
  const collection = createCollection(COLLECTION_NAMES.typography, ["Base"]);
  for (const spec of generateTypographyTextStyles(config)) {
    const prefix = typographyVariablePrefix(spec);
    addVariable(collection, `${prefix}/family`, "STRING", { Base: spec.family });
    addVariable(collection, `${prefix}/style`, "STRING", { Base: spec.weight });
    addVariable(collection, `${prefix}/weight`, "FLOAT", { Base: spec.fontWeight });
    addVariable(collection, `${prefix}/size`, "FLOAT", { Base: alias(COLLECTION_NAMES.breakpoints, `typography/${prefix}/size`) });
    addVariable(collection, `${prefix}/line-height`, "FLOAT", { Base: alias(COLLECTION_NAMES.breakpoints, `typography/${prefix}/line-height`) });
  }
  return collection;
}

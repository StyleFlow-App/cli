import { COLLECTION_NAMES } from "../../shared/constants.js";
import type { LayoutValueRef } from "../../shared/types.js";
import { alias } from "./model.js";

export function primitiveScaleAlias(name: string) {
  return alias(COLLECTION_NAMES.primitives, `dimension/primitive/scale/${name}`);
}

export function primitiveStrokeAlias(name: string) {
  return alias(COLLECTION_NAMES.primitives, `dimension/primitive/stroke/${name}`);
}

export function layoutValueToToken(ref: LayoutValueRef) {
  if ("scale" in ref) {
    return primitiveScaleAlias(ref.scale);
  }
  if ("stroke" in ref) {
    return primitiveStrokeAlias(ref.stroke);
  }
  if ("container" in ref) {
    return alias(COLLECTION_NAMES.primitives, `dimension/primitive/container/${ref.container}`);
  }
  if ("breakpoint" in ref) {
    return alias(COLLECTION_NAMES.primitives, `dimension/primitive/breakpoint/${ref.breakpoint}`);
  }
  if ("inherit" in ref) {
    throw new Error("Inherited layout values must be resolved before token generation.");
  }
  return ref.value;
}

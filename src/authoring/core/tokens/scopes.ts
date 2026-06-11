import { COLLECTION_NAMES } from "../../shared/constants.js";
import type { CollectionSpec, VariableToken } from "../../shared/types.js";

type VariableScopeName =
  | "FRAME_FILL"
  | "SHAPE_FILL"
  | "TEXT_FILL"
  | "STROKE_COLOR"
  | "GAP"
  | "CORNER_RADIUS"
  | "STROKE_FLOAT"
  | "FONT_FAMILY"
  | "FONT_STYLE"
  | "FONT_WEIGHT"
  | "FONT_SIZE"
  | "LINE_HEIGHT";

const surfaceScopes: VariableScopeName[] = ["FRAME_FILL", "SHAPE_FILL"];
const foregroundScopes: VariableScopeName[] = ["TEXT_FILL", "SHAPE_FILL"];
const colorStrokeScopes: VariableScopeName[] = ["STROKE_COLOR"];

export function applyVariableScopes(collection: CollectionSpec): CollectionSpec {
  return Object.assign({}, collection, {
    variables: collection.variables.map((variable) => {
      const scopes = scopesForVariable(collection.name, variable.name, variable.type);
      if (scopes.length > 0) {
        return Object.assign({}, variable, { scopes });
      }
      return withoutScopes(variable);
    })
  });
}

export function scopesForVariable(collectionName: string, variableName: string, variableType?: string): VariableScopeName[] {
  if (collectionName === COLLECTION_NAMES.colorIntensity) {
    return variableType === undefined || variableType === "COLOR" ? colorIntensityScopes(variableName) : [];
  }
  if (collectionName === COLLECTION_NAMES.layoutRole) {
    return variableType === undefined || variableType === "FLOAT" ? layoutRoleScopes(variableName) : [];
  }
  if (collectionName === COLLECTION_NAMES.typography) {
    return typographyScopes(variableName, variableType);
  }
  return [];
}

function colorIntensityScopes(variableName: string): VariableScopeName[] {
  const leaf = leafName(variableName);
  if (leaf === "surface" || leaf === "surface-scrim" || leaf === "background") {
    return surfaceScopes;
  }
  if (leaf === "foreground" || leaf.startsWith("foreground-")) {
    return foregroundScopes;
  }
  if (leaf === "focus-ring" || leaf === "border" || leaf.startsWith("border-")) {
    return colorStrokeScopes;
  }
  return [];
}

function layoutRoleScopes(variableName: string): VariableScopeName[] {
  switch (variableName) {
    case "padding-x":
    case "padding-y":
    case "gap":
      return ["GAP"];
    case "radius":
      return ["CORNER_RADIUS"];
    case "border-width":
      return ["STROKE_FLOAT"];
    default:
      return [];
  }
}

function typographyScopes(variableName: string, variableType?: string): VariableScopeName[] {
  switch (leafName(variableName)) {
    case "family":
      return variableType === undefined || variableType === "STRING" ? ["FONT_FAMILY"] : [];
    case "style":
      return variableType === undefined || variableType === "STRING" ? ["FONT_STYLE"] : [];
    case "weight":
      return variableType === undefined || variableType === "FLOAT" ? ["FONT_WEIGHT"] : [];
    case "size":
      return variableType === undefined || variableType === "FLOAT" ? ["FONT_SIZE"] : [];
    case "line-height":
      return variableType === undefined || variableType === "FLOAT" ? ["LINE_HEIGHT"] : [];
    default:
      return [];
  }
}

function leafName(variableName: string): string {
  const parts = variableName.split("/");
  return parts[parts.length - 1] ?? variableName;
}

function withoutScopes(variable: VariableToken): VariableToken {
  const rest = Object.assign({}, variable);
  delete rest.scopes;
  return rest;
}

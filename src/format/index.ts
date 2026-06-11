export const STYLEFLOW_TOKENS_VERSION = "1.0.0";

export type VariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export interface RgbaValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AliasValue {
  alias: {
    collection: string;
    name: string;
  };
}

export type TokenPrimitiveValue = RgbaValue | number | string | boolean;
export type TokenModeValue = TokenPrimitiveValue | AliasValue;

export interface StyleflowTokenVariable {
  name: string;
  type: VariableType;
  valuesByMode: Record<string, TokenModeValue>;
  description?: string;
  scopes?: string[];
  codeSyntax?: Partial<Record<"WEB", string>>;
}

export interface StyleflowTokenCollection {
  name: string;
  modes: string[];
  variables: StyleflowTokenVariable[];
}

export interface StyleflowTokensFile {
  version: typeof STYLEFLOW_TOKENS_VERSION;
  source: {
    kind: "figma" | "cloud";
    pluginVersion: string;
    exportedAt: string;
  };
  collections: StyleflowTokenCollection[];
}

export function parseStyleflowTokens(input: unknown): StyleflowTokensFile {
  const errors: string[] = [];
  if (!isRecord(input)) {
    throw new Error("StyleFlow tokens file must be a JSON object.");
  }
  if (input.version !== STYLEFLOW_TOKENS_VERSION) {
    errors.push(`Unsupported token format version: ${String(input.version)}.`);
  }
  if (!isRecord(input.source) || (input.source.kind !== "figma" && input.source.kind !== "cloud") || typeof input.source.pluginVersion !== "string" || typeof input.source.exportedAt !== "string") {
    errors.push("Token source metadata is invalid.");
  }
  if (!Array.isArray(input.collections)) {
    errors.push("Token collections must be an array.");
  } else {
    for (const [index, collection] of input.collections.entries()) {
      validateCollection(collection, index, errors);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  return input as unknown as StyleflowTokensFile;
}

function validateCollection(input: unknown, index: number, errors: string[]): void {
  if (!isRecord(input) || typeof input.name !== "string" || !Array.isArray(input.modes) || !input.modes.every((mode) => typeof mode === "string")) {
    errors.push(`Collection at index ${index} is invalid.`);
    return;
  }
  if (!Array.isArray(input.variables)) {
    errors.push(`Collection ${input.name} has no variables array.`);
    return;
  }
  for (const variable of input.variables) {
    if (!isRecord(variable) || typeof variable.name !== "string" || !["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(String(variable.type)) || !isRecord(variable.valuesByMode)) {
      errors.push(`Collection ${input.name} contains an invalid variable.`);
      continue;
    }
    for (const mode of input.modes) {
      if (!(mode in variable.valuesByMode) || !isTokenValue(variable.valuesByMode[mode])) {
        errors.push(`Variable ${input.name}/${variable.name} has an invalid or missing ${mode} value.`);
      }
    }
  }
}

function isTokenValue(value: unknown): boolean {
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  if ("alias" in value) {
    return isRecord(value.alias) && typeof value.alias.collection === "string" && typeof value.alias.name === "string";
  }
  return ["r", "g", "b", "a"].every((channel) => typeof value[channel] === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { CollectionSpec, TokenModeValue, VariableToken, VariableType } from "../../shared/types.js";

export function createCollection(name: string, modes: string[]): CollectionSpec {
  return { name, modes, variables: [] };
}

export function addVariable(
  collection: CollectionSpec,
  name: string,
  type: VariableType,
  valuesByMode: Record<string, TokenModeValue>,
  options: Pick<VariableToken, "description" | "scopes" | "codeSyntax"> = {}
): void {
  collection.variables.push(Object.assign({
    collection: collection.name,
    name,
    type,
    valuesByMode,
  }, options));
}

export function alias(collection: string, name: string): TokenModeValue {
  return { alias: { collection, name } };
}

export function sameValueForModes(modes: string[], value: TokenModeValue): Record<string, TokenModeValue> {
  return Object.fromEntries(modes.map((mode) => [mode, value]));
}

export function variableMap(collections: CollectionSpec[]): Map<string, VariableToken> {
  const map = new Map<string, VariableToken>();
  for (const collection of collections) {
    for (const variable of collection.variables) {
      map.set(`${collection.name}/${variable.name}`, variable);
    }
  }
  return map;
}

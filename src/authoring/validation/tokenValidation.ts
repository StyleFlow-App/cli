import type { CollectionSpec, ValidationIssue } from "../shared/types.js";
import { enforceCollectionLimits } from "../core/tokens/plan.js";

export function validateCollections(collections: CollectionSpec[]): ValidationIssue[] {
  return enforceCollectionLimits(collections).concat(validateUniqueVariables(collections), validateAliases(collections));
}

function validateUniqueVariables(collections: CollectionSpec[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const collection of collections) {
    const seen = new Set<string>();
    for (const variable of collection.variables) {
      if (seen.has(variable.name)) {
        issues.push({
          level: "error",
          path: `collections.${collection.name}.${variable.name}`,
          message: `Duplicate variable name in ${collection.name}: ${variable.name}.`
        });
      }
      seen.add(variable.name);
    }
  }
  return issues;
}

function validateAliases(collections: CollectionSpec[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refs = new Set<string>();
  for (const collection of collections) {
    for (const variable of collection.variables) {
      refs.add(`${collection.name}/${variable.name}`);
    }
  }
  for (const collection of collections) {
    for (const variable of collection.variables) {
      for (const value of Object.values(variable.valuesByMode)) {
        if (typeof value === "object" && value !== null && "alias" in value) {
          const key = `${value.alias.collection}/${value.alias.name}`;
          if (!refs.has(key)) {
            issues.push({
              level: "error",
              path: `collections.${collection.name}.${variable.name}`,
              message: `Unresolved alias: ${key}.`
            });
          }
        }
      }
    }
  }
  return issues;
}

import { FIGMA_LIMITS } from "../../shared/constants.js";
import type { CollectionSpec, SyncPlan, ValidationIssue } from "../../shared/types.js";

export function createSyncPlan(collections: CollectionSpec[], issues: ValidationIssue[] = []): SyncPlan {
  const limitIssues = enforceCollectionLimits(collections);
  return {
    collections: collections.map((collection) => ({
      name: collection.name,
      modes: collection.modes,
      variableCount: collection.variables.length
    })),
    variablesTotal: collections.reduce((total, collection) => total + collection.variables.length, 0),
    removals: [],
    issues: issues.concat(limitIssues)
  };
}

export function enforceCollectionLimits(collections: CollectionSpec[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const collection of collections) {
    if (collection.modes.length > FIGMA_LIMITS.maxModesPerCollection) {
      issues.push({
        level: "error",
        path: `collections.${collection.name}.modes`,
        message: `${collection.name} has ${collection.modes.length} modes. Figma Professional supports ${FIGMA_LIMITS.maxModesPerCollection}.`
      });
    }
    if (collection.variables.length > FIGMA_LIMITS.maxVariablesPerCollection) {
      issues.push({
        level: "error",
        path: `collections.${collection.name}.variables`,
        message: `${collection.name} has ${collection.variables.length} variables. Figma supports ${FIGMA_LIMITS.maxVariablesPerCollection} variables per collection.`
      });
    }
  }
  return issues;
}

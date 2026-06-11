import type { DimensionScaleEntry, StyleflowConfig } from "../../shared/types.js";

const MAX_STANDARD_SCALE = 120;
const FULL_SCALE: DimensionScaleEntry = { name: "full", value: 999999 };

export function dimensionScaleOptions(config: StyleflowConfig): DimensionScaleEntry[] {
  return mergeDimensionScaleEntries(config.dimensions.scale, standardDimensionScaleEntries());
}

export function dimensionScaleEntryForName(config: StyleflowConfig, name: string): DimensionScaleEntry | undefined {
  return config.dimensions.scale.find((entry) => entry.name === name)
    ?? standardDimensionScaleEntries().find((entry) => entry.name === name);
}

export function ensureDimensionScaleEntry(config: StyleflowConfig, name: string): StyleflowConfig {
  if (config.dimensions.scale.some((entry) => entry.name === name)) {
    return config;
  }
  const entry = dimensionScaleEntryForName(config, name);
  if (!entry) {
    return config;
  }
  return {
    ...config,
    dimensions: {
      ...config.dimensions,
      scale: sortDimensionScaleEntries(config.dimensions.scale.concat(entry))
    }
  };
}

export function sortDimensionScaleEntries(entries: DimensionScaleEntry[]): DimensionScaleEntry[] {
  const standardIndex = standardIndexByName();
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => scaleSortKey(left.entry, left.index, standardIndex) - scaleSortKey(right.entry, right.index, standardIndex))
    .map(({ entry }) => entry);
}

export function referencedDimensionScaleEntries(config: StyleflowConfig, scaleNames: Iterable<string>): DimensionScaleEntry[] {
  const byName = new Map(config.dimensions.scale.map((entry) => [entry.name, entry]));
  for (const name of scaleNames) {
    const entry = dimensionScaleEntryForName(config, name);
    if (entry) {
      byName.set(name, entry);
    }
  }
  return sortDimensionScaleEntries(Array.from(byName.values()));
}

function standardDimensionScaleEntries(): DimensionScaleEntry[] {
  const entries: DimensionScaleEntry[] = [
    { name: "0", value: 0 },
    { name: "px", value: 1 },
    { name: "2px", value: 2 },
    { name: "1", value: 4 },
    { name: "2", value: 8 },
    { name: "3", value: 12 },
    { name: "3-5", value: 14 },
    { name: "3-75", value: 15 },
    { name: "4", value: 16 },
    { name: "4-5", value: 18 }
  ];
  for (let value = 5; value <= MAX_STANDARD_SCALE; value += 1) {
    entries.push({ name: String(value), value: value * 4 });
  }
  entries.push(FULL_SCALE);
  return entries;
}

function mergeDimensionScaleEntries(current: DimensionScaleEntry[], standard: DimensionScaleEntry[]): DimensionScaleEntry[] {
  const currentByName = new Map(current.map((entry) => [entry.name, entry]));
  const merged = standard.map((entry) => currentByName.get(entry.name) ?? entry);
  for (const entry of current) {
    if (!standard.some((candidate) => candidate.name === entry.name)) {
      merged.splice(merged.length - 1, 0, entry);
    }
  }
  return merged;
}

function standardIndexByName(): Map<string, number> {
  return new Map(standardDimensionScaleEntries().map((entry, index) => [entry.name, index]));
}

function scaleSortKey(entry: DimensionScaleEntry, originalIndex: number, standardIndex: Map<string, number>): number {
  if (entry.name === FULL_SCALE.name) {
    return Number.MAX_SAFE_INTEGER;
  }
  const index = standardIndex.get(entry.name);
  return index ?? (standardIndex.get(FULL_SCALE.name) ?? MAX_STANDARD_SCALE) - 0.5 + originalIndex / 1000;
}

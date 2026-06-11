import { BREAKPOINTS, COLLECTION_NAMES, LAYOUT_DENSITIES, LAYOUT_PROPERTIES } from "../../shared/constants.js";
import { enabledLayoutRoles } from "../../config/selectors.js";
import type { CollectionSpec, StyleflowConfig } from "../../shared/types.js";
import { addVariable, alias, createCollection } from "../tokens/model.js";
import { layoutValueToToken } from "../tokens/references.js";
import { resolveLayoutValue } from "./inheritance.js";
import { referencedDimensionScaleEntries } from "./scaleCatalog.js";
import { resolveTypographyValue } from "../typography/inheritance.js";

export function generateDimensionCollections(config: StyleflowConfig): CollectionSpec[] {
  const roles = enabledLayoutRoles(config);
  const primitives = createCollection(COLLECTION_NAMES.primitives, ["Base"]);
  for (const entry of dimensionScalePrimitives(config, roles)) {
    addVariable(primitives, `dimension/primitive/scale/${entry.name}`, "FLOAT", { Base: entry.value });
  }
  for (const entry of config.dimensions.containerScale) {
    addVariable(primitives, `dimension/primitive/container/${entry.name}`, "FLOAT", { Base: entry.value });
  }
  for (const entry of config.dimensions.strokes) {
    addVariable(primitives, `dimension/primitive/stroke/${entry.name}`, "FLOAT", { Base: entry.value });
  }
  for (const breakpoint of BREAKPOINTS) {
    addVariable(primitives, `dimension/primitive/breakpoint/${breakpoint}`, "FLOAT", { Base: config.dimensions.breakpoints[breakpoint] });
  }

  const breakpoints = createCollection(COLLECTION_NAMES.breakpoints, BREAKPOINTS.slice());
  for (const role of roles) {
    for (const density of LAYOUT_DENSITIES) {
      for (const property of LAYOUT_PROPERTIES) {
        addVariable(
          breakpoints,
          `layout-role/${role}/${density}/${property}`,
          "FLOAT",
          Object.fromEntries(BREAKPOINTS.map((breakpoint) => [breakpoint, layoutValueToToken(resolveLayoutValue(config, role, density, breakpoint, property))]))
        );
      }
    }
  }

  const densityCollection = createCollection(COLLECTION_NAMES.layoutRoleDensity, LAYOUT_DENSITIES.slice());
  for (const role of roles) {
    for (const property of LAYOUT_PROPERTIES) {
      addVariable(
        densityCollection,
        `${role}/${property}`,
        "FLOAT",
        Object.fromEntries(
          LAYOUT_DENSITIES.map((density) => [
            density,
            alias(COLLECTION_NAMES.breakpoints, `layout-role/${role}/${density}/${property}`)
          ])
        )
      );
    }
  }

  const roleCollection = createCollection(COLLECTION_NAMES.layoutRole, roles);
  for (const property of LAYOUT_PROPERTIES) {
    addVariable(
      roleCollection,
      property,
      "FLOAT",
      Object.fromEntries(roles.map((role) => [role, alias(COLLECTION_NAMES.layoutRoleDensity, `${role}/${property}`)]))
    );
  }

  return [primitives, breakpoints, densityCollection, roleCollection];
}

function dimensionScalePrimitives(config: StyleflowConfig, roles: ReturnType<typeof enabledLayoutRoles>) {
  const names = new Set<string>();
  for (const role of roles) {
    for (const density of LAYOUT_DENSITIES) {
      for (const breakpoint of BREAKPOINTS) {
        for (const property of LAYOUT_PROPERTIES) {
          const ref = resolveLayoutValue(config, role, density, breakpoint, property);
          if ("scale" in ref) {
            names.add(ref.scale);
          }
        }
      }
    }
  }
  for (const roleName of Object.keys(config.typography.roles)) {
    for (const breakpoint of BREAKPOINTS) {
      for (const field of ["size", "lineHeight"] as const) {
        const ref = resolveTypographyValue(config, roleName, field, breakpoint);
        if ("scale" in ref) {
          names.add(ref.scale);
        }
      }
    }
  }
  return referencedDimensionScaleEntries(config, names);
}

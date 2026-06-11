import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type {
  ColorIntensity,
  ColorTone,
  InteractionState,
  LayoutDensity,
  LayoutRole,
  SurfaceType,
  ThemeMode
} from "../contracts.js";

interface UiOwnProps {
  tone?: ColorTone;
  intensity?: ColorIntensity;
  layoutRole?: LayoutRole;
  density?: LayoutDensity;
  theme?: ThemeMode;
  surfaceType?: SurfaceType;
  interactionState?: InteractionState;
  children?: ReactNode;
}

export type UiProps<T extends ElementType = "div"> = UiOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof UiOwnProps | "as">;

export function Ui<T extends ElementType = "div">({
  as,
  tone = "neutral",
  intensity = "1",
  layoutRole = "none",
  density = "md",
  theme,
  surfaceType,
  interactionState,
  children,
  ...rest
}: UiProps<T>) {
  const Element = as ?? "div";
  return (
    <Element
      data-color-tone={tone}
      data-color-intensity={String(intensity)}
      data-layout-role={layoutRole}
      data-layout-density={density}
      data-theme={theme}
      data-surface-type={surfaceType}
      data-interaction-state={interactionState}
      {...rest}
    >
      {children}
    </Element>
  );
}

export type {
  ColorIntensity,
  ColorTone,
  InteractionState,
  LayoutDensity,
  LayoutRole,
  SurfaceType,
  ThemeMode
} from "../contracts.js";

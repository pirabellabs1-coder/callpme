import React from "react";
import { cn } from "@/lib/utils";

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  iconSize?: number;
  speed?: number;
}

/**
 * Cercles en orbite (Magic UI). Place chaque enfant à une position régulière
 * sur un cercle, le tout animé par CSS (var(--angle), var(--radius)).
 */
export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 32,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calc = duration / speed;
  const count = React.Children.count(children);
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          <circle
            className="stroke-foreground/10"
            strokeWidth={1}
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}
      {React.Children.map(children, (child, index) => {
        const angle = (360 / count) * index;
        const half = iconSize / 2;
        return (
          <div
            style={
              {
                "--duration": `${calc}s`,
                "--radius": `${radius}px`,
                "--angle": `${angle}deg`,
                "--icon-size": `${iconSize}px`,
                position: "absolute",
                left: `calc(50% - ${half}px)`,
                top: `calc(50% - ${half}px)`,
                width: `${iconSize}px`,
                height: `${iconSize}px`,
              } as React.CSSProperties
            }
            className={cn(
              "animate-orbit flex transform-gpu items-center justify-center rounded-full",
              { "[animation-direction:reverse]": reverse },
              className,
            )}
            {...props}
          >
            {child}
          </div>
        );
      })}
    </>
  );
}

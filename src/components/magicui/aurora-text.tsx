"use client";

import React, { memo } from "react";

interface AuroraTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}

/**
 * Texte avec un dégradé « aurore » qui se déplace lentement (Magic UI).
 * Les couleurs par défaut sont alignées sur la marque Callpme — orange ardent,
 * brique et ocre — pour éviter le rendu « SaaS générique violet/bleu ».
 */
export const AuroraText = memo(
  ({
    children,
    className = "",
    colors = ["#E8572A", "#F7944C", "#C73E1D", "#FFB370", "#E8572A"],
    speed = 1,
  }: AuroraTextProps) => {
    const gradientStyle: React.CSSProperties = {
      backgroundImage: `linear-gradient(135deg, ${colors.join(", ")}, ${colors[0]})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      animationDuration: `${10 / speed}s`,
    };

    return (
      <span className={`relative inline-block ${className}`}>
        <span className="sr-only">{children}</span>
        <span
          className="animate-aurora relative bg-[length:200%_auto] bg-clip-text text-transparent"
          style={gradientStyle}
          aria-hidden="true"
        >
          {children}
        </span>
      </span>
    );
  },
);

AuroraText.displayName = "AuroraText";

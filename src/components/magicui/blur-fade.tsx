"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Révélation douce au défilement (flou + translation + opacité), façon Magic UI,
 * sans dépendance : IntersectionObserver + transition CSS. Respecte
 * prefers-reduced-motion.
 */
export function BlurFade({
  children,
  className,
  delay = 0,
  yOffset = 14,
  duration = 0.6,
  once = true,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  duration?: number;
  once?: boolean;
  as?: "div" | "span" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            if (once) io.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn("will-change-[opacity,transform,filter]", className)}
      style={{
        opacity: shown ? 1 : 0,
        filter: shown ? "blur(0px)" : "blur(8px)",
        transform: shown ? "translateY(0)" : `translateY(${yOffset}px)`,
        transition: `opacity ${duration}s ease-out, transform ${duration}s cubic-bezier(0.16,1,0.3,1), filter ${duration}s ease-out`,
        transitionDelay: `${delay}s`,
      }}
    >
      {children}
    </Comp>
  );
}

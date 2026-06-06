"use client";

import React, { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface MousePos {
  x: number;
  y: number;
}

function useMousePosition(): MousePos {
  const [m, setM] = useState<MousePos>({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => setM({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return m;
}

interface ParticlesProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

function hexToRgb(hex: string): number[] {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

type Circle = {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
};

/**
 * Particules de fond animées (Magic UI). Réactives à la souris, recyclées
 * en bord de canvas. Couleur configurable — pour Callpme on passe l'orange
 * de marque (#E8572A) afin de coller à l'identité visuelle.
 */
export const Particles: React.FC<ParticlesProps> = ({
  className = "",
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  refresh = false,
  color = "#E8572A",
  vx = 0,
  vy = 0,
  ...props
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const circles = useRef<Circle[]>([]);
  const mousePos = useMousePosition();
  const mouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const rafID = useRef<number | null>(null);
  const resizeTO = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef<() => void>(() => {});
  const mouseMoveRef = useRef<() => void>(() => {});
  const animateRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (canvasRef.current) ctxRef.current = canvasRef.current.getContext("2d");
    initRef.current();
    animateRef.current();
    const onResize = () => {
      if (resizeTO.current) clearTimeout(resizeTO.current);
      resizeTO.current = setTimeout(() => initRef.current(), 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (rafID.current != null) window.cancelAnimationFrame(rafID.current);
      if (resizeTO.current) clearTimeout(resizeTO.current);
      window.removeEventListener("resize", onResize);
    };
  }, [color]);

  useEffect(() => {
    mouseMoveRef.current();
  }, [mousePos.x, mousePos.y]);

  useEffect(() => {
    initRef.current();
  }, [refresh]);

  const rgb = hexToRgb(color);

  const drawCircle = (c: Circle, update = false) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y, translateX, translateY, size: s, alpha } = c;
    ctx.translate(translateX, translateY);
    ctx.beginPath();
    ctx.arc(x, y, s, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(${rgb.join(", ")}, ${alpha})`;
    ctx.fill();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!update) circles.current.push(c);
  };

  const circleParams = (): Circle => ({
    x: Math.floor(Math.random() * canvasSize.current.w),
    y: Math.floor(Math.random() * canvasSize.current.h),
    translateX: 0,
    translateY: 0,
    size: Math.floor(Math.random() * 2) + size,
    alpha: 0,
    targetAlpha: parseFloat((Math.random() * 0.6 + 0.1).toFixed(1)),
    dx: (Math.random() - 0.5) * 0.1,
    dy: (Math.random() - 0.5) * 0.1,
    magnetism: 0.1 + Math.random() * 4,
  });

  const resizeCanvas = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!container || !canvas || !ctx) return;
    canvasSize.current.w = container.offsetWidth;
    canvasSize.current.h = container.offsetHeight;
    canvas.width = canvasSize.current.w * dpr;
    canvas.height = canvasSize.current.h * dpr;
    canvas.style.width = `${canvasSize.current.w}px`;
    canvas.style.height = `${canvasSize.current.h}px`;
    ctx.scale(dpr, dpr);
    circles.current = [];
    for (let i = 0; i < quantity; i++) drawCircle(circleParams());
  };

  const initCanvas = () => {
    resizeCanvas();
  };

  const onMouseMove = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = canvasSize.current;
    const x = mousePos.x - rect.left - w / 2;
    const y = mousePos.y - rect.top - h / 2;
    const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
    if (inside) {
      mouse.current.x = x;
      mouse.current.y = y;
    }
  };

  const clearContext = () => {
    const ctx = ctxRef.current;
    if (ctx) ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);
  };

  const remap = (v: number, s1: number, e1: number, s2: number, e2: number) => {
    const r = ((v - s1) * (e2 - s2)) / (e1 - s1) + s2;
    return r > 0 ? r : 0;
  };

  const animate = () => {
    clearContext();
    circles.current.forEach((c, i) => {
      const edges = [
        c.x + c.translateX - c.size,
        canvasSize.current.w - c.x - c.translateX - c.size,
        c.y + c.translateY - c.size,
        canvasSize.current.h - c.y - c.translateY - c.size,
      ];
      const closest = edges.reduce((a, b) => Math.min(a, b));
      const remapped = parseFloat(remap(closest, 0, 20, 0, 1).toFixed(2));
      if (remapped > 1) {
        c.alpha += 0.02;
        if (c.alpha > c.targetAlpha) c.alpha = c.targetAlpha;
      } else c.alpha = c.targetAlpha * remapped;
      c.x += c.dx + vx;
      c.y += c.dy + vy;
      c.translateX += (mouse.current.x / (staticity / c.magnetism) - c.translateX) / ease;
      c.translateY += (mouse.current.y / (staticity / c.magnetism) - c.translateY) / ease;
      drawCircle(c, true);
      if (
        c.x < -c.size ||
        c.x > canvasSize.current.w + c.size ||
        c.y < -c.size ||
        c.y > canvasSize.current.h + c.size
      ) {
        circles.current.splice(i, 1);
        drawCircle(circleParams());
      }
    });
    rafID.current = window.requestAnimationFrame(animateRef.current);
  };

  initRef.current = initCanvas;
  mouseMoveRef.current = onMouseMove;
  animateRef.current = animate;

  return (
    <div
      className={cn("pointer-events-none", className)}
      ref={containerRef}
      aria-hidden="true"
      {...props}
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
};

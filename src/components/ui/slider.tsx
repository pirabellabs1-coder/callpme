"use client";

import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/** Curseur basé sur un input range natif, teinté à la marque (accessible). */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  id,
  className,
  disabled,
}: SliderProps) {
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-brand outline-none",
        "focus-visible:ring-2 focus-visible:ring-brand/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}

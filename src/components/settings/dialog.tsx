"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal dialog (local to the settings/account area, since the shared
 * UI kit has none). Handles:
 * - role="dialog" + aria-modal, labelled by its title (and described by `description`)
 * - focus moved inside on open (first `[data-autofocus]`, else first field, else panel)
 * - Tab / Shift+Tab trapped inside the panel
 * - Escape and backdrop click close (unless `dismissible` is false, e.g. while saving)
 * - focus returned to the previously focused element on close
 * - body scroll locked while open
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = {
  md: "max-w-md",
  lg: "max-w-lg",
  "2xl": "max-w-2xl",
} as const;

export function Dialog({
  title,
  description,
  icon,
  onClose,
  dismissible = true,
  size = "md",
  footer,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  /** When false, Escape / backdrop / close button are ignored (e.g. pending request). */
  dismissible?: boolean;
  size?: keyof typeof SIZES;
  /** Sticky footer (actions), rendered below the scrollable body. */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Keep latest callbacks without re-running the focus effect on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>(
          "[data-dialog-body] input:not([disabled]), [data-dialog-body] select, [data-dialog-body] textarea",
        ) ??
        panel;
      target.focus();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [mounted]);

  function requestClose() {
    if (dismissRef.current) closeRef.current();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) {
      e.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "relative my-auto flex max-h-[calc(100dvh-2rem)] w-full animate-scale-in flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl outline-none",
          SIZES[size],
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          {icon && (
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/75 ring-1 ring-inset ring-border [&_svg]:size-4"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[0.95rem] font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-xs text-muted-foreground text-pretty">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            // aria-disabled (et non disabled) : le bouton garde le focus pendant
            // un envoi, sinon le focus tombe sur <body> et sort de la modale.
            aria-disabled={!dismissible || undefined}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div data-dialog-body className="min-h-0 flex-1 overflow-y-auto p-5">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

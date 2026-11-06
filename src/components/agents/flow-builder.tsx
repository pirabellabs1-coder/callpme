"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  Flag,
  GitBranch,
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
  MessageSquare,
  PhoneForwarded,
  PhoneOff,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AgentRole, ConversationFlow, FlowNode, FlowNodeType } from "@/lib/shared/types";
import {
  autoLayout,
  checkFlow,
  compileFlow,
  FLOW_LIMITS,
  newNodeId,
  newNodeTitle,
  NODE_TYPES,
  templateFlow,
} from "@/lib/flow/flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NODE_W = 228;
const NODE_H = 104;
const GRID = 10;
const PAD = 120;

const ICONS: Record<FlowNodeType, typeof MessageSquare> = {
  message: MessageSquare,
  question: CircleHelp,
  decision: GitBranch,
  action: Zap,
  transfer: PhoneForwarded,
  end: PhoneOff,
};

const TYPE_ORDER: FlowNodeType[] = ["message", "question", "decision", "action", "transfer", "end"];

export interface FlowToolOption {
  name: string;
  label: string;
}

const snap = (v: number) => Math.round(v / GRID) * GRID;

export function FlowBuilder({
  agentId,
  role,
  initialFlow,
  tools,
  hasTransferNumber,
}: {
  agentId: string;
  role: AgentRole;
  initialFlow: ConversationFlow | null;
  tools: FlowToolOption[];
  hasTransferNumber: boolean;
}) {
  const [flow, setFlow] = useState<ConversationFlow | null>(initialFlow);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const drag = useRef<{ id: string; dx: number; dy: number; pointerId: number } | null>(null);
  /** Révision du parcours : une modification pendant l'enregistrement reste « non enregistrée ». */
  const revision = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const toolNames = useMemo(() => tools.map((t) => t.name), [tools]);
  const toolLabel = useCallback((n: string) => tools.find((t) => t.name === n)?.label ?? n, [tools]);
  const issues = useMemo(
    () => (flow ? checkFlow(flow, toolNames, { hasTransferNumber }) : { errors: [], warnings: [] }),
    [flow, toolNames, hasTransferNumber],
  );
  const issueIds = useMemo(() => new Set([...issues.errors, ...issues.warnings].map((i) => i.nodeId).filter(Boolean)), [issues]);
  const selected = flow?.nodes.find((n) => n.id === selectedId) ?? null;

  // Échap : ferme le volet d'édition, puis quitte le plein écran.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectedId) setSelectedId(null);
      else if (fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, fullscreen]);

  // Plein écran : la page derrière ne défile plus.
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Changements non enregistrés : prévenir avant de quitter la page.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((fn: (f: ConversationFlow) => ConversationFlow) => {
    revision.current++;
    setFlow((f) => (f ? fn(f) : f));
    setDirty(true);
    setStatus(null);
  }, []);

  const updateNode = (nodeId: string, patch: Partial<FlowNode>) =>
    update((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }));

  function addNode(type: FlowNodeType) {
    if (!flow || flow.nodes.length >= FLOW_LIMITS.nodes) return;
    const nodeId = newNodeId(flow, type);
    const from = selected;
    const position = from
      ? { x: snap(from.position.x + NODE_W + 80), y: snap(from.position.y + from.next.length * (NODE_H + 30)) }
      : { x: 40, y: 40 + flow.nodes.length * 30 };
    const node: FlowNode = {
      id: nodeId,
      type,
      title: newNodeTitle(flow, type),
      instruction: "",
      next: [],
      position,
      ...(type === "action" && toolNames[0] ? { tool: toolNames[0] } : {}),
    };
    update((f) => ({
      ...f,
      start: f.nodes.some((n) => n.id === f.start) ? f.start : nodeId,
      nodes: [
        // Le nouveau bloc suit automatiquement le bloc sélectionné (sauf fin d'appel).
        ...f.nodes.map((n) =>
          from && n.id === from.id && n.type !== "end" && n.type !== "transfer" && n.next.length < FLOW_LIMITS.edgesPerNode
            ? { ...n, next: [...n.next, { to: nodeId }] }
            : n,
        ),
        node,
      ],
    }));
    setSelectedId(nodeId);
  }

  function removeNode(nodeId: string) {
    if (!flow) return;
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const isStart = flow.start === nodeId;
    const ask = isStart
      ? `Supprimer « ${node.title} », le départ de l'appel ? Le bloc qui le suit deviendra le départ.`
      : `Supprimer le bloc « ${node.title} » ?`;
    if (!window.confirm(ask)) return;
    if (flow.nodes.length === 1) {
      // Plus aucun bloc : on revient au choix d'un modèle.
      revision.current++;
      setFlow(null);
      setSelectedId(null);
      // Rien à enregistrer : le parcours déjà enregistré reste en place (désactivable).
      setDirty(false);
      return;
    }
    const nodes = flow.nodes.filter((n) => n.id !== nodeId).map((n) => ({ ...n, next: n.next.filter((e) => e.to !== nodeId) }));
    const nextStart = isStart ? (node.next.find((e) => e.to !== nodeId)?.to ?? nodes[0].id) : flow.start;
    update((f) => ({ ...f, nodes, start: nextStart }));
    const neighbour = node.next[0]?.to ?? nodes[0].id;
    setSelectedId(neighbour);
    // Le bloc supprimé avait le focus : on le rend à un bloc voisin.
    requestAnimationFrame(() => document.getElementById(`flow-node-${neighbour}`)?.focus());
  }

  /* ----------------------------- Déplacement ----------------------------- */

  function onPointerDown(e: React.PointerEvent, node: FlowNode) {
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !canvasRef.current) return;
    const x = e.clientX - rect.left + canvasRef.current.scrollLeft;
    const y = e.clientY - rect.top + canvasRef.current.scrollTop;
    drag.current = { id: node.id, dx: x - node.position.x, dy: y - node.position.y, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedId(node.id);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = canvasRef.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, snap(e.clientX - rect.left + el.scrollLeft - d.dx));
    const y = Math.max(0, snap(e.clientY - rect.top + el.scrollTop - d.dy));
    const cur = flow?.nodes.find((n) => n.id === d.id);
    if (cur && cur.position.x === x && cur.position.y === y) return;
    update((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === d.id ? { ...n, position: { x, y } } : n)) }));
  }

  function onPointerUp() {
    drag.current = null;
  }

  /** Clavier : les flèches déplacent le bloc sélectionné, Suppr le retire. */
  function onNodeKey(e: React.KeyboardEvent, node: FlowNode) {
    const step = e.shiftKey ? GRID * 5 : GRID * 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      updateNode(node.id, { position: { x: Math.max(0, node.position.x + m[0]), y: Math.max(0, node.position.y + m[1]) } });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeNode(node.id);
    }
  }

  /* ------------------------------ Enregistrer ------------------------------ */

  async function save() {
    if (!flow) return;
    const sentRevision = revision.current;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/flow`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ tone: "error", text: data.error ?? "Enregistrement impossible. Réessayez." });
        return;
      }
      if (revision.current === sentRevision) setDirty(false);
      const w = (data.warnings ?? []).length;
      setStatus({
        tone: "ok",
        text: w ? `Parcours enregistré, avec ${w} point${w > 1 ? "s" : ""} à vérifier.` : "Parcours enregistré.",
      });
    } catch {
      setStatus({ tone: "error", text: "Connexion impossible. Vérifiez votre réseau et réessayez." });
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------ État vide ------------------------------ */

  if (!flow) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand">
          <Workflow className="size-6" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-semibold">Dessinez le déroulé de vos appels</h2>
          <p className="text-sm text-muted-foreground">
            Enchaînez des étapes (questions, choix, actions, transfert) : l&apos;agent les suit pendant l&apos;appel, tout en
            restant naturel. Sans parcours, il suit seulement son prompt.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="brand"
            onClick={() => {
              const f = templateFlow(role);
              setFlow(f);
              setSelectedId(f.start);
              setDirty(true);
            }}
          >
            <Workflow aria-hidden /> Partir du modèle de ce rôle
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFlow({
                enabled: true,
                start: "accueil",
                nodes: [{ id: "accueil", type: "message", title: "Accueil", instruction: "", next: [], position: { x: 40, y: 40 } }],
              });
              setSelectedId("accueil");
              setDirty(true);
            }}
          >
            Commencer vide
          </Button>
        </div>
      </div>
    );
  }

  const width = Math.max(...flow.nodes.map((n) => n.position.x + NODE_W), 600) + PAD;
  const height = Math.max(...flow.nodes.map((n) => n.position.y + NODE_H), 400) + PAD;
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));

  const issueCount = issues.errors.length + issues.warnings.length;

  return (
    <div
      className={cn(
        fullscreen ? "fixed inset-0 z-[55] flex flex-col gap-3 bg-background p-3 sm:p-4" : "space-y-4",
      )}
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen ? true : undefined}
      aria-label={fullscreen ? "Éditeur de parcours en plein écran" : undefined}
    >
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={flow.enabled}
            onCheckedChange={(v) => update((f) => ({ ...f, enabled: v }))}
            aria-label="Utiliser ce parcours pendant les appels"
          />
          <span>
            <span className="font-medium">{flow.enabled ? "Parcours actif" : "Parcours désactivé"}</span>
            <span className="block text-xs text-muted-foreground">
              {flow.enabled ? "L'agent suit ces étapes pendant ses appels." : "L'agent suit seulement son prompt."}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFullscreen((v) => !v)}
            aria-pressed={fullscreen}
            title={fullscreen ? "Revenir à la page (Échap)" : "Agrandir l'éditeur à tout l'écran"}
          >
            {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            {fullscreen ? "Réduire" : "Plein écran"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => update((f) => autoLayout(f))}
            title="Ranger les blocs en colonnes depuis le départ"
          >
            <LayoutGrid aria-hidden /> Organiser
          </Button>
          <Button variant="brand" size="sm" onClick={save} disabled={saving || !dirty || issues.errors.length > 0}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </div>

      <div role="group" aria-label="Ajouter un bloc" className="flex flex-wrap gap-1.5">
        {TYPE_ORDER.map((t) => {
          const Icon = ICONS[t];
          return (
            <Button
              key={t}
              variant="secondary"
              size="sm"
              onClick={() => addNode(t)}
              disabled={flow.nodes.length >= FLOW_LIMITS.nodes}
              title={NODE_TYPES[t].hint}
            >
              <Plus aria-hidden />
              <Icon aria-hidden /> {NODE_TYPES[t].label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p aria-live="polite" className={cn("min-h-5 text-sm", status?.tone === "error" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
          {status?.text ?? (dirty ? <span className="text-muted-foreground">Modifications non enregistrées.</span> : null)}
        </p>
        {issueCount > 0 && (
          <details className="group relative text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 font-medium text-amber-700 hover:bg-accent dark:text-amber-400 [&::-webkit-details-marker]:hidden">
              <TriangleAlert className="size-4" aria-hidden />
              {issueCount} point{issueCount > 1 ? "s" : ""} à vérifier
            </summary>
            <ul className="absolute right-0 z-20 mt-1 w-[min(420px,85vw)] space-y-1.5 rounded-xl border border-border bg-card p-3 text-xs shadow-xl">
              {issues.errors.map((i, k) => (
                <li key={`e${k}`}>
                  <IssueLink issue={i} tone="error" onSelect={setSelectedId} />
                </li>
              ))}
              {issues.warnings.map((i, k) => (
                <li key={`w${k}`}>
                  <IssueLink issue={i} tone="warning" onSelect={setSelectedId} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <p id="flow-keyboard-help" className="sr-only">
        Flèches : déplacer le bloc (Maj pour aller plus vite). Suppr : supprimer le bloc. Échap : fermer le volet.
      </p>

      <div className={cn("relative", fullscreen && "min-h-0 flex-1")}>
        {/* Canevas : toute la largeur disponible */}
        <div
          ref={canvasRef}
          className={cn(
            "relative overflow-auto rounded-2xl border border-border bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px]",
            fullscreen ? "h-full" : "h-[max(560px,calc(100dvh-17rem))]",
          )}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => {
            // Clic dans le vide (pas sur un bloc) : ferme le volet.
            if (!(e.target as HTMLElement).closest("button")) setSelectedId(null);
          }}
        >
          <div className="relative" style={{ width, height }}>
            <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
              <defs>
                <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" className="fill-muted-foreground/70" />
                </marker>
              </defs>
              {flow.nodes.flatMap((n) =>
                n.next.map((e, i) => {
                  const t = byId.get(e.to);
                  if (!t) return null;
                  const x1 = n.position.x + NODE_W;
                  const y1 = n.position.y + NODE_H / 2;
                  const x2 = t.position.x;
                  const y2 = t.position.y + NODE_H / 2;
                  const c = Math.max(40, Math.abs(x2 - x1) / 2);
                  const active = selectedId === n.id || selectedId === t.id;
                  return (
                    <path
                      key={`${n.id}-${e.to}-${i}`}
                      d={`M${x1} ${y1} C${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`}
                      className={cn("fill-none transition-colors", active ? "stroke-brand" : "stroke-muted-foreground/45")}
                      strokeWidth={active ? 2 : 1.5}
                      markerEnd="url(#flow-arrow)"
                    />
                  );
                }),
              )}
            </svg>

            {/* Conditions sur les liens */}
            {flow.nodes.flatMap((n) =>
              n.next.map((e, i) => {
                const t = byId.get(e.to);
                if (!t || !e.when?.trim()) return null;
                const x = (n.position.x + NODE_W + t.position.x) / 2;
                const y = (n.position.y + t.position.y) / 2 + NODE_H / 2;
                return (
                  <span
                    key={`l-${n.id}-${e.to}-${i}`}
                    className="pointer-events-none absolute max-w-[160px] -translate-x-1/2 -translate-y-1/2 truncate rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground shadow-xs"
                    style={{ left: x, top: y }}
                    title={e.when}
                  >
                    {e.when}
                  </span>
                );
              }),
            )}

            {flow.nodes.map((n) => {
              const Icon = ICONS[n.type];
              const isStart = n.id === flow.start;
              const isSel = n.id === selectedId;
              return (
                <button
                  key={n.id}
                  id={`flow-node-${n.id}`}
                  type="button"
                  aria-current={isSel ? "true" : undefined}
                  aria-describedby="flow-keyboard-help"
                  aria-label={`${NODE_TYPES[n.type].label} : ${n.title}${isStart ? " (départ)" : ""}${issueIds.has(n.id) ? ", à vérifier" : ""}`}
                  onPointerDown={(e) => onPointerDown(e, n)}
                  onFocus={() => setSelectedId(n.id)}
                  onKeyDown={(e) => onNodeKey(e, n)}
                  className={cn(
                    "absolute flex cursor-grab touch-none select-none flex-col gap-1.5 rounded-xl border bg-card p-3 text-left shadow-sm transition-[box-shadow,border-color] active:cursor-grabbing",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
                    isSel ? "border-brand shadow-md" : "border-border hover:border-foreground/25",
                  )}
                  style={{ left: n.position.x, top: n.position.y, width: NODE_W, height: NODE_H }}
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className={cn("size-3.5", isStart ? "text-brand" : "")} strokeWidth={1.75} aria-hidden />
                    {NODE_TYPES[n.type].label}
                    <span className="ml-auto inline-flex items-center gap-1.5">
                      {issueIds.has(n.id) && <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />}
                      {isStart && (
                        <span className="inline-flex items-center gap-1 text-brand">
                          <Flag className="size-3" aria-hidden /> Départ
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">{n.title}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {n.type === "action" && n.tool ? `${toolLabel(n.tool)} · ` : ""}
                    {n.instruction || "Sans consigne"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Volet d'édition : s'ouvre au clic sur un bloc, se ferme (croix, Échap, clic dans le vide). */}
        {selected && (
          <aside
            className="absolute bottom-3 right-3 top-3 z-10 w-[min(360px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl"
            aria-label={`Modifier le bloc « ${selected.title} »`}
          >
            <NodeEditor
              key={selected.id}
              node={selected}
              nodes={flow.nodes}
              isStart={selected.id === flow.start}
              tools={tools}
              onChange={(patch) => updateNode(selected.id, patch)}
              onSetStart={() => update((f) => ({ ...f, start: selected.id }))}
              onRemove={() => removeNode(selected.id)}
              onClose={() => {
                const id = selected.id;
                setSelectedId(null);
                requestAnimationFrame(() => document.getElementById(`flow-node-${id}`)?.blur());
              }}
            />
          </aside>
        )}
        {!selected && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
            Cliquez sur un bloc pour le modifier
          </p>
        )}
      </div>

      <div className={cn("rounded-2xl border border-border", fullscreen && "hidden")}>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
          aria-expanded={showPrompt}
          onClick={() => setShowPrompt((v) => !v)}
        >
          Consignes transmises à l&apos;agent
          <span className="text-xs text-muted-foreground">{showPrompt ? "Masquer" : "Afficher"}</span>
        </button>
        {showPrompt && (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {compileFlow(flow, toolLabel)}
          </pre>
        )}
      </div>
    </div>
  );
}

function IssueLink({
  issue,
  tone,
  onSelect,
}: {
  issue: { nodeId?: string; message: string };
  tone: "error" | "warning";
  onSelect: (id: string) => void;
}) {
  const cls = tone === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400";
  if (!issue.nodeId) return <span className={cls}>{issue.message}</span>;
  return (
    <button type="button" className={cn("text-left underline-offset-2 hover:underline", cls)} onClick={() => onSelect(issue.nodeId!)}>
      {issue.message}
    </button>
  );
}

function NodeEditor({
  node,
  nodes,
  isStart,
  tools,
  onChange,
  onSetStart,
  onRemove,
  onClose,
}: {
  node: FlowNode;
  nodes: FlowNode[];
  isStart: boolean;
  tools: FlowToolOption[];
  onChange: (patch: Partial<FlowNode>) => void;
  onSetStart: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const others = nodes.filter((n) => n.id !== node.id);
  /** Blocs pas encore reliés à celui-ci. */
  const free = others.filter((o) => !node.next.some((e) => e.to === o.id));
  const terminal = node.type === "end" || node.type === "transfer";
  const fid = (k: string) => `flow-${node.id}-${k}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Modifier le bloc</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer le volet (Échap)" title="Fermer (Échap)">
          <X aria-hidden />
        </Button>
      </div>
      {isStart ? (
        <p className="inline-flex items-center gap-1 text-xs font-medium text-brand">
          <Flag className="size-3" aria-hidden /> Départ de l&apos;appel
        </p>
      ) : (
        <Button variant="outline" size="sm" onClick={onSetStart}>
          <Flag aria-hidden /> Définir comme départ
        </Button>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={fid("type")}>Type</Label>
        <Select
          id={fid("type")}
          value={node.type}
          onChange={(e) => {
            const type = e.target.value as FlowNodeType;
            const terminalType = type === "end" || type === "transfer";
            if (terminalType && node.next.length && !window.confirm("Ce type termine l'appel : les suites de ce bloc seront retirées. Continuer ?")) {
              e.target.value = node.type;
              return;
            }
            onChange({
              type,
              tool: type === "action" ? (node.tool ?? tools[0]?.name) : undefined,
              variable: type === "question" ? node.variable : undefined,
              ...(terminalType ? { next: [] } : {}),
            });
          }}
        >
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {NODE_TYPES[t].label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">{NODE_TYPES[node.type].hint}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={fid("title")}>Nom de l&apos;étape</Label>
        <Input
          id={fid("title")}
          value={node.title}
          maxLength={FLOW_LIMITS.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>

      {node.type === "action" && (
        <div className="space-y-1.5">
          <Label htmlFor={fid("tool")}>Outil</Label>
          <Select id={fid("tool")} value={tools.some((t) => t.name === node.tool) ? node.tool : ""} onChange={(e) => onChange({ tool: e.target.value })}>
            <option value="" disabled>
              Choisir un outil…
            </option>
            {tools.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={fid("instruction")}>
          {node.type === "question" ? "Question à poser" : node.type === "end" ? "Conclusion" : "Consigne"}
        </Label>
        <Textarea
          id={fid("instruction")}
          rows={4}
          value={node.instruction}
          maxLength={FLOW_LIMITS.instruction}
          placeholder={
            node.type === "question"
              ? "Ex. Demandez le motif du rendez-vous."
              : node.type === "decision"
                ? "Ex. Orientez selon l'urgence de la demande."
                : "Ex. Proposez deux créneaux proches de sa préférence."
          }
          onChange={(e) => onChange({ instruction: e.target.value })}
        />
      </div>

      {node.type === "question" && (
        <div className="space-y-1.5">
          <Label htmlFor={fid("variable")}>Information à relever</Label>
          <Input
            id={fid("variable")}
            value={node.variable ?? ""}
            placeholder="ex. motif"
            maxLength={40}
            onChange={(e) => {
              const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
              onChange({ variable: v || undefined });
            }}
          />
        </div>
      )}

      {!terminal && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Suites</legend>
          {node.next.length === 0 && <p className="text-xs text-muted-foreground">Aucune suite : ajoutez l&apos;étape suivante.</p>}
          {node.next.map((edge, i) => (
            <div key={`${edge.to}-${i}`} className="space-y-1.5 rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Étape suivante ${i + 1}`}
                  value={edge.to}
                  onChange={(e) => onChange({ next: node.next.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)) })}
                >
                  {others.map((o) => (
                    <option key={o.id} value={o.id} disabled={o.id !== edge.to && node.next.some((x) => x.to === o.id)}>
                      {o.title}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Retirer la suite ${i + 1}`}
                  onClick={() => onChange({ next: node.next.filter((_, k) => k !== i) })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <Input
                aria-label={`Condition de la suite ${i + 1}`}
                value={edge.when ?? ""}
                maxLength={FLOW_LIMITS.condition}
                placeholder={node.next.length > 1 ? "Si… (ex. l'appelant parle d'une urgence)" : "Condition (facultatif)"}
                onChange={(e) =>
                  onChange({ next: node.next.map((x, k) => (k === i ? { ...x, when: e.target.value || undefined } : x)) })
                }
              />
            </div>
          ))}
          {free.length > 0 && node.next.length < FLOW_LIMITS.edgesPerNode && (
            <Button variant="outline" size="sm" onClick={() => onChange({ next: [...node.next, { to: free[0].id }] })}>
              <Plus aria-hidden /> Ajouter une suite
            </Button>
          )}
        </fieldset>
      )}

      <div className="border-t border-border pt-3">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 aria-hidden /> Supprimer le bloc
        </Button>
      </div>
    </div>
  );
}

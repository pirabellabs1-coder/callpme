"use client";

import { AudioLines } from "lucide-react";
import {
  PRESET_VOICES,
  presetsByCategory,
  GENDER_LABELS,
} from "@/lib/voices/catalog";
import { VoicePreview } from "@/components/agents/wizard/voice-preview";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Catalogue intégré des 17 voix, écoutable une par une. */
export function AdminVoiceCatalog() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-5 py-3">
        <AudioLines className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Catalogue intégré · {PRESET_VOICES.length} voix
        </h2>
        <Badge variant="muted" className="ml-auto">
          Écoutables
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {presetsByCategory().map((group) => (
          <div key={group.category} className="px-5 py-3">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.category}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.voices.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {v.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {GENDER_LABELS[v.gender]} · {v.description}
                    </p>
                  </div>
                  <VoicePreview
                    text={`Bonjour, je suis ${v.label}. Ravi de vous accompagner aujourd'hui.`}
                    language={v.language}
                    speed={v.rate}
                    pitch={v.pitch}
                    gender={v.gender}
                    label="Écouter"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

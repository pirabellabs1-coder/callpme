"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteStudioVoice } from "@/app/actions/studio-voices";
import { Button } from "@/components/ui/button";

export function DeleteStudioVoice({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Supprimer ${name}`}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Supprimer la voix « ${name} » ?`)) return;
          setError(null);
          start(async () => {
            const r = await deleteStudioVoice(id);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
      </Button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

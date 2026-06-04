"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteCallButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!window.confirm("Supprimer cet appel ? Cette action est définitive.")) return;
    setDeleting(true);
    const res = await fetch(`/api/calls/${callId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/calls");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={remove} disabled={deleting}>
      {deleting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      Supprimer
    </Button>
  );
}

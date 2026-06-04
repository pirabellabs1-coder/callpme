"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldMinus, Trash2 } from "lucide-react";
import { setUserAdmin, deleteUser } from "@/app/actions/admin";

export function UserActions({
  userId,
  isAdmin,
  isSelf,
}: {
  userId: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggleAdmin() {
    start(async () => {
      await setUserAdmin(userId, !isAdmin);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Supprimer définitivement ce compte utilisateur ?")) return;
    start(async () => {
      await deleteUser(userId);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggleAdmin}
        disabled={pending || isSelf}
        title={isAdmin ? "Retirer les droits admin" : "Promouvoir administrateur"}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isAdmin ? (
          <ShieldMinus className="size-4" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending || isSelf}
        title="Supprimer le compte"
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

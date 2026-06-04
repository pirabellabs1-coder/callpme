"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CLIENT_COOKIE } from "@/lib/db/active-client";

/** Définit le client actif (ou « tous » si null) et rafraîchit l'UI. */
export async function setActiveClient(clientId: string | null) {
  if (clientId) {
    cookies().set(CLIENT_COOKIE, clientId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    cookies().delete(CLIENT_COOKIE);
  }
  revalidatePath("/", "layout");
}

/**
 * Contexte de tenant courant — désormais résolu depuis la session
 * authentifiée. Le modèle reste multi-tenant : chaque utilisateur appartient
 * à une organisation, et toutes les requêtes sont cloisonnées par `org.id`.
 */
import { getSession } from "../auth/session";

export async function getCurrentOrg() {
  const session = await getSession();
  return session?.org ?? null;
}

export async function requireOrgId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error("Non authentifié");
  }
  return session.org.id;
}

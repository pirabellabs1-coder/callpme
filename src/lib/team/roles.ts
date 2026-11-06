/** Règles de gestion de l'équipe (module pur, utilisable côté client). */

/**
 * Qui peut agir sur qui. Le propriétaire gère tout le monde ; un
 * administrateur gère les membres seulement ; personne ne se retire ni ne
 * change son propre rôle, et le propriétaire ne peut pas être retiré.
 */
export function canManage(actor: { id: string; role: string }, target: { id: string; role: string }): boolean {
  if (actor.id === target.id || target.role === "owner") return false;
  if (actor.role === "owner") return true;
  return actor.role === "admin" && target.role === "member";
}

/** Rôle qu'un utilisateur peut attribuer (inviter ou modifier). */
export function canGrant(actorRole: string, role: string): boolean {
  if (role === "admin") return actorRole === "owner";
  if (role === "member") return actorRole === "owner" || actorRole === "admin";
  return false;
}

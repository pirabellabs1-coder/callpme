/** Helpers de réponse JSON cohérents pour les route handlers. */
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "Authentification requise") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Action non autorisée") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Ressource introuvable") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Erreur interne du serveur") {
  return NextResponse.json({ error: message }, { status: 500 });
}

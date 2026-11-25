"use client";
// Persistencia mock del usuario en localStorage, con la misma clave que el prototipo.
// Las puntuaciones ya no se guardan aquí (antes `av_scores`): van a Supabase vía submitScore (SPEC 06).
import { useSyncExternalStore } from "react";
export type User = { name: string };
const USER_KEY = "av_user";
const USER_EVENT = "av:user-change";
// Cache del snapshot: useSyncExternalStore exige devolver la misma referencia si no cambió.
let cachedRaw: string | null = null;
let cachedUser: User | null = null;
function readRaw(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
export function getUser(): User | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cachedUser =
      parsed && typeof parsed === "object" && typeof (parsed as User).name === "string"
        ? { name: (parsed as User).name }
        : null;
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}
/** Guarda el usuario; `null` borra la clave. Notifica a los suscriptores. */
export function setUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // localStorage no disponible: la app sigue sin persistir.
  }
  window.dispatchEvent(new Event(USER_EVENT));
}
function subscribe(onChange: () => void): () => void {
  window.addEventListener(USER_EVENT, onChange);
  // Cambios desde otra pestaña.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(USER_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
/** Usuario actual; `null` en servidor y en la hidratación inicial. */
export function useUser(): User | null {
  return useSyncExternalStore(subscribe, getUser, () => null);
}

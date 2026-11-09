"use client";

// Persistencia mock en localStorage, con las mismas claves que el prototipo.
import { useSyncExternalStore } from "react";

export type User = { name: string };
export type SavedScore = { game: string; score: number; name: string; at: number };

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";
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

export function saveScore(entry: Omit<SavedScore, "at">): void {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
    const all: SavedScore[] = Array.isArray(parsed) ? parsed : [];
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // localStorage no disponible o JSON corrupto: se ignora.
  }
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

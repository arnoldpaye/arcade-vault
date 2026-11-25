"use server";
// Guardado de puntuaciones (SPEC 06). Escritura anónima solo desde el servidor:
// el navegador no puede insertar en `scores` (sin policy de insert para anon).
import { updateTag } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";
export type SubmitScoreResult = { ok: true } | { ok: false; error: string };
// Mismas reglas que los CHECK de public.scores.
const NAME_RE = /^[A-Z0-9_ ]{1,10}$/;
const SCORE_MAX = 9_999_999;
export async function submitScore(input: {
  gameId: string;
  playerName: string;
  score: number;
}): Promise<SubmitScoreResult> {
  // Los argumentos de una Server Action llegan del cliente: se validan como datos no confiables.
  const gameId = typeof input?.gameId === "string" ? input.gameId : "";
  const playerName = typeof input?.playerName === "string" ? input.playerName.trim() : "";
  const score = input?.score;
  if (!NAME_RE.test(playerName)) return { ok: false, error: "NOMBRE INVÁLIDO" };
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > SCORE_MAX) {
    return { ok: false, error: "PUNTUACIÓN INVÁLIDA" };
  }
  try {
    const supabase = getAdminClient();
    const game = await supabase.from("games").select("id").eq("id", gameId).maybeSingle();
    if (game.error) throw game.error;
    if (!game.data) return { ok: false, error: "JUEGO DESCONOCIDO" };
    const { error } = await supabase
      .from("scores")
      .insert({ game_id: gameId, player_name: playerName, score });
    if (error) throw error;
  } catch (err) {
    console.error("submitScore:", err);
    return { ok: false, error: "NO SE PUDO GUARDAR" };
  }
  // Read-your-own-writes: biblioteca y detalle muestran la nueva partida al instante.
  updateTag("scores");
  return { ok: true };
}

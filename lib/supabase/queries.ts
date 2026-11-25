// Lecturas cacheadas del catálogo y del leaderboard (SPEC 06).
// Tags: "games" (catálogo) y "scores" (puntuaciones; submitScore lo invalida con updateTag).
import { cacheTag } from "next/cache";
import { formatPlays, type Category, type Game, type GameColor, type ScoreRow } from "@/lib/data";
import type { Database } from "@/lib/supabase/database.types";
import { getPublicClient } from "@/lib/supabase/public";
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type StatsRow = Database["public"]["Views"]["game_stats"]["Row"];
function toGame(row: GameRow, stats: StatsRow | undefined): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    // Los CHECK de la tabla garantizan estos valores.
    cat: row.cat as Category,
    cover: row.cover,
    color: row.color as GameColor,
    best: stats?.best ?? 0,
    plays: formatPlays(stats?.plays ?? 0),
  };
}
/** "DD/MM/AAAA" en UTC, igual en servidor y cliente. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
/** Catálogo completo ordenado por sort_order, con best/plays de game_stats. */
export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheTag("games", "scores");
  const supabase = getPublicClient();
  const [games, stats] = await Promise.all([
    supabase.from("games").select("*").order("sort_order"),
    supabase.from("game_stats").select("*"),
  ]);
  if (games.error) throw new Error(`No se pudo leer games: ${games.error.message}`);
  if (stats.error) throw new Error(`No se pudo leer game_stats: ${stats.error.message}`);
  const byId = new Map(stats.data.map((s) => [s.game_id, s]));
  return games.data.map((g) => toGame(g, byId.get(g.id)));
}
/** Un juego con sus estadísticas; null si no existe. */
export async function getGameById(id: string): Promise<Game | null> {
  "use cache";
  cacheTag("games", "scores");
  const supabase = getPublicClient();
  const [game, stats] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_stats").select("*").eq("game_id", id).maybeSingle(),
  ]);
  if (game.error) throw new Error(`No se pudo leer games: ${game.error.message}`);
  if (stats.error) throw new Error(`No se pudo leer game_stats: ${stats.error.message}`);
  return game.data ? toGame(game.data, stats.data ?? undefined) : null;
}
/** Top del juego desde la vista leaderboard (mejor marca por jugador). */
export async function getLeaderboard(gameId: string, limit = 10): Promise<ScoreRow[]> {
  "use cache";
  cacheTag("scores");
  const { data, error } = await getPublicClient()
    .from("leaderboard")
    .select("player_name, score, created_at, rank")
    .eq("game_id", gameId)
    .lte("rank", limit)
    .order("rank");
  if (error) throw new Error(`No se pudo leer leaderboard: ${error.message}`);
  return data.map((r) => ({
    rank: r.rank ?? 0,
    name: r.player_name ?? "",
    score: r.score ?? 0,
    date: r.created_at ? formatDate(r.created_at) : "",
  }));
}

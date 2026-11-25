import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { GAMES, getGame } from "@/lib/data";
// Fuera de la validación de navegación instantánea (Partial Prefetching): la página lee
// `params` sin <Suspense>. Las 9 rutas se pre-renderizan igualmente con generateStaticParams.
export const instant = false;
export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}
export default async function GamePlayerPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}

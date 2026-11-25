import { Library } from "@/components/library";
import { getGames } from "@/lib/supabase/queries";
// Biblioteca: listado de juegos del vault, leído de Supabase.
export default async function JuegosPage() {
  const games = await getGames();
  return <Library games={games} />;
}

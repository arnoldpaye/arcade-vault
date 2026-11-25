// Cliente admin de Supabase con la secret key: salta RLS.
// Solo servidor: `server-only` hace fallar el build si se importa desde un Client Component.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
let client: ReturnType<typeof createClient<Database>> | null = null;
/** Se crea en la primera llamada, no al importar: el build no necesita la secret key. */
export function getAdminClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY");
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

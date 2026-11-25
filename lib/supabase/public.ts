// Cliente público de Supabase (publishable key, sin cookies ni sesión).
// Apto para funciones con "use cache": no lee cookies ni headers y los datos que lee son públicos (RLS).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
let client: ReturnType<typeof createClient<Database>> | null = null;
export function getPublicClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

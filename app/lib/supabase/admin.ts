import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv, supabaseSecretKey } from "./env";
// Cliente con la clave secreta (spec 22): salta la RLS y es el único que
// escribe en `partidas` y `scores`. No lee cookies ni guarda sesión, para que
// la sesión del usuario nunca sustituya sus permisos; la sesión se sigue
// leyendo con el cliente de server.ts.
export function createAdminClient() {
  const { url } = supabaseEnv();
  return createClient<Database>(url, supabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Consultas de solo lectura. Solo servidor: se llaman desde Server Components
// y Server Actions. Van en funciones `'use cache'` con etiqueta, y la acción
// `guardarPuntuacion` las invalida. Una función cacheada no puede leer
// `cookies()`, así que las de `scores` y `leaderboard` usan un cliente público
// sin sesión (clave publishable). `obtenerPartidasJugadas` (spec 27) es la
// excepción: `partidas` no tiene permisos para `anon` ni `authenticated`, así
// que cuenta con la clave secreta (`createAdminClient`, `server-only`) y solo
// devuelve un número, nunca filas.
//
// Contrato de fallo (spec 28): ninguna consulta lanza. Next 16 da por fallido
// el prerender si una función `'use cache'` lanza, aunque quien la llama capture
// el error, así que un fallo de Supabase (o la falta de `SUPABASE_SECRET_KEY`)
// tumbaría `next build`. En su lugar, todo el cuerpo va en un `try/catch`: en
// el éxito se usa la vida de siempre; en el fallo se registra el error (nombre
// de la función y mensaje, sin claves ni datos de cuentas), se guarda con
// `cacheLife("seconds")`, que lo deja fuera del prerender y se reintenta en la
// siguiente petición, y se devuelve `null`. `null` significa «no se pudo leer»;
// `[]` y `0` siguen significando «no hay datos». Cada invocación llama a
// `cacheLife` una sola vez.
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { GAMES } from "@/app/data/games";
import type { ActividadReciente, TopJugadorHoy } from "@/app/data/home";
import { createAdminClient } from "@/app/lib/supabase/admin";
import type { Database } from "@/app/lib/supabase/database.types";
import { supabaseEnv } from "@/app/lib/supabase/env";
export interface FilaRanking {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa, el mismo formato que PuntuacionRanking
}
export const etiquetaRanking = (game: string) => `ranking-${game}`;
export const ETIQUETA_ACTIVIDAD = "actividad-reciente";
export const ETIQUETA_TOP_DIA = "top-del-dia";
const VENTANA_HOY_MS = 24 * 60 * 60 * 1000;
// Margen de filas para deduplicar por jugador en el top del día.
const MARGEN_TOP_DIA = 100;
function clientePublico() {
  const { url, publishableKey } = supabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
// Rama de fallo común: registra, acorta la vida de la caché y devuelve `null`.
// Solo se llama desde dentro de una función `'use cache'`, y nunca después de
// otro `cacheLife` en la misma invocación.
function fallo(consulta: string, causa: unknown): null {
  const mensaje =
    causa instanceof Error
      ? causa.message
      : typeof causa === "object" && causa !== null && "message" in causa
        ? String(causa.message)
        : String(causa);
  console.error(`[queries] ${consulta} falló: ${mensaje}`);
  cacheLife("seconds");
  return null;
}
// dd/mm/aaaa en UTC, para que el servidor y el cliente muestren lo mismo.
export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}
function haceCuanto(iso: string, ahora: number): string {
  const minutos = Math.max(0, Math.floor((ahora - Date.parse(iso)) / 60_000));
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}
export async function obtenerRanking(
  game: string,
  limit: number,
): Promise<FilaRanking[] | null> {
  "use cache";
  cacheTag(etiquetaRanking(game));
  try {
    const { data, error } = await clientePublico()
      .from("leaderboard")
      .select("player_name, score, created_at")
      .eq("game_id", game)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) return fallo("obtenerRanking", error);
    const filas: FilaRanking[] = [];
    for (const fila of data) {
      if (fila.player_name === null || fila.score === null) continue;
      if (fila.created_at === null) continue;
      filas.push({
        rank: filas.length + 1,
        name: fila.player_name,
        score: fila.score,
        date: formatearFecha(fila.created_at),
      });
    }
    cacheLife("minutes");
    return filas;
  } catch (e) {
    return fallo("obtenerRanking", e);
  }
}
// Total de partidas iniciadas de un juego («Partidas» en la ficha, spec 27).
// Sin etiqueta ni `updateTag`: unos minutos de retraso no importan en un
// contador.
export async function obtenerPartidasJugadas(
  game: string,
): Promise<number | null> {
  "use cache";
  try {
    const { count, error } = await createAdminClient()
      .from("partidas")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game);
    if (error) return fallo("obtenerPartidasJugadas", error);
    cacheLife("minutes");
    return count ?? 0;
  } catch (e) {
    return fallo("obtenerPartidasJugadas", e);
  }
}
export async function obtenerActividadReciente(
  limit: number,
): Promise<ActividadReciente[] | null> {
  "use cache";
  cacheTag(ETIQUETA_ACTIVIDAD);
  try {
    const { data, error } = await clientePublico()
      .from("scores")
      .select("game_id, player_name, score, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fallo("obtenerActividadReciente", error);
    const ahora = Date.now();
    const actividad: ActividadReciente[] = data.map((fila) => {
      const juego = GAMES.find((g) => g.id === fila.game_id);
      return {
        p: fila.player_name,
        g: juego?.title ?? fila.game_id,
        s: fila.score,
        t: haceCuanto(fila.created_at, ahora),
        c: juego?.color ?? "cyan",
      };
    });
    cacheLife("seconds");
    return actividad;
  } catch (e) {
    return fallo("obtenerActividadReciente", e);
  }
}
export async function obtenerTopDelDia(
  limit: number,
): Promise<TopJugadorHoy[] | null> {
  "use cache";
  cacheTag(ETIQUETA_TOP_DIA);
  try {
    const desde = new Date(Date.now() - VENTANA_HOY_MS).toISOString();
    const { data, error } = await clientePublico()
      .from("scores")
      .select("player_name, score")
      .gte("created_at", desde)
      .order("score", { ascending: false })
      .limit(MARGEN_TOP_DIA);
    if (error) return fallo("obtenerTopDelDia", error);
    // Una fila por jugador: su mejor marca de las últimas 24 horas.
    const vistos = new Set<string>();
    const top: TopJugadorHoy[] = [];
    for (const fila of data) {
      const nombre = fila.player_name.toUpperCase();
      if (vistos.has(nombre)) continue;
      vistos.add(nombre);
      top.push({ r: top.length + 1, p: nombre, s: fila.score });
      if (top.length === limit) break;
    }
    cacheLife("seconds");
    return top;
  } catch (e) {
    return fallo("obtenerTopDelDia", e);
  }
}

// Consultas de solo lectura. Solo servidor: se llaman desde Server Components
// y Server Actions. Van en funciones `'use cache'` con etiqueta, y la acción
// `guardarPuntuacion` las invalida. Una función cacheada no puede leer
// `cookies()`, así que usan un cliente público sin sesión (clave publishable).
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { GAMES } from "@/app/data/games";
import type { ActividadReciente, TopJugadorHoy } from "@/app/data/home";
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
): Promise<FilaRanking[]> {
  "use cache";
  cacheTag(etiquetaRanking(game));
  cacheLife("minutes");
  const { data, error } = await clientePublico()
    .from("leaderboard")
    .select("player_name, score, created_at")
    .eq("game_id", game)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`No se pudo leer el ranking: ${error.message}`);
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
  return filas;
}
export async function obtenerActividadReciente(
  limit: number,
): Promise<ActividadReciente[]> {
  "use cache";
  cacheTag(ETIQUETA_ACTIVIDAD);
  cacheLife("seconds");
  const { data, error } = await clientePublico()
    .from("scores")
    .select("game_id, player_name, score, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`No se pudo leer la actividad: ${error.message}`);
  const ahora = Date.now();
  return data.map((fila) => {
    const juego = GAMES.find((g) => g.id === fila.game_id);
    return {
      p: fila.player_name,
      g: juego?.title ?? fila.game_id,
      s: fila.score,
      t: haceCuanto(fila.created_at, ahora),
      c: juego?.color ?? "cyan",
    };
  });
}
export async function obtenerTopDelDia(
  limit: number,
): Promise<TopJugadorHoy[]> {
  "use cache";
  cacheTag(ETIQUETA_TOP_DIA);
  cacheLife("seconds");
  const desde = new Date(Date.now() - VENTANA_HOY_MS).toISOString();
  const { data, error } = await clientePublico()
    .from("scores")
    .select("player_name, score")
    .gte("created_at", desde)
    .order("score", { ascending: false })
    .limit(MARGEN_TOP_DIA);
  if (error)
    throw new Error(`No se pudo leer el top del día: ${error.message}`);
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
  return top;
}

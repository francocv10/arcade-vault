"use server";
import { updateTag } from "next/cache";
import { tieneUsuario } from "@/app/acceso/auth-schema";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import {
  ETIQUETA_ACTIVIDAD,
  ETIQUETA_TOP_DIA,
  etiquetaRanking,
  formatearFecha,
} from "./queries";
import {
  JUEGOS_CON_RANKING,
  normalizarNombre,
  PARTIDA_MAX_SEGUNDOS,
  validarEnvio,
  type EnvioPuntuacion,
} from "./schema";
const ERROR_GUARDADO =
  "[ERR] No se pudo guardar la puntuación. Inténtalo de nuevo.";
const ERROR_SIN_NOMBRE =
  "[ERR] Elige tu nombre de jugador antes de guardar la puntuación.";
// Abre una partida de una cuenta (spec 22). Es un endpoint público: la sesión
// sale de las cookies, nunca de un parámetro, y el juego se valida aquí. Solo
// devuelve el id; `guardarPuntuacion` lo exige para publicar.
export async function iniciarPartida(
  game: string,
): Promise<{ ok: boolean; partidaId?: string }> {
  if (typeof game !== "string" || !JUEGOS_CON_RANKING.includes(game)) {
    return { ok: false };
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return { ok: false };
    const admin = createAdminClient();
    // Partidas de esta cuenta que ya no podrían publicar. Las abiertas en otras
    // pestañas siguen vivas: no se invalida la partida anterior.
    const caducidad = new Date(
      Date.now() - PARTIDA_MAX_SEGUNDOS * 1000,
    ).toISOString();
    const { error: errorLimpieza } = await admin
      .from("partidas")
      .delete()
      .eq("user_id", userId)
      .lt("iniciada_en", caducidad);
    if (errorLimpieza) {
      console.warn(
        "iniciarPartida: no se limpiaron las caducadas",
        errorLimpieza.message,
      );
    }
    const { data: partida, error } = await admin
      .from("partidas")
      .insert({ game_id: game, user_id: userId })
      .select("id")
      .single();
    if (error || !partida) {
      console.error("iniciarPartida: error de Supabase", error?.message);
      return { ok: false };
    }
    return { ok: true, partidaId: partida.id };
  } catch (error) {
    console.error("iniciarPartida: fallo inesperado", error);
    return { ok: false };
  }
}
export async function guardarPuntuacion(
  envio: EnvioPuntuacion,
): Promise<{ ok: boolean; error?: string }> {
  let game: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    let entrada = envio;
    if (claims) {
      // Con sesión decide el servidor: se ignora el nombre que envíe el cliente.
      // getUser y no los claims: updateUser no renueva el JWT, así que el
      // nombre recién elegido no estaría en el token hasta el siguiente refresco.
      const { data: cuenta } = await supabase.auth.getUser();
      if (!cuenta.user) return { ok: false, error: ERROR_GUARDADO };
      const { username } = cuenta.user.user_metadata;
      if (!tieneUsuario(username)) {
        return { ok: false, error: ERROR_SIN_NOMBRE };
      }
      entrada = { ...envio, name: username };
    }
    const resultado = validarEnvio(entrada);
    if (!resultado.ok) return { ok: false, error: resultado.error };
    game = resultado.envio.game;
    const { error } = await supabase.from("scores").insert({
      game_id: game,
      player_name: resultado.envio.name,
      score: resultado.envio.score,
      user_id: claims?.sub ?? null,
    });
    if (error) {
      console.error("guardarPuntuacion: error de Supabase", error.message);
      return { ok: false, error: ERROR_GUARDADO };
    }
  } catch (error) {
    console.error("guardarPuntuacion: fallo inesperado", error);
    return { ok: false, error: ERROR_GUARDADO };
  }
  updateTag(etiquetaRanking(game));
  updateTag(ETIQUETA_ACTIVIDAD);
  updateTag(ETIQUETA_TOP_DIA);
  return { ok: true };
}
// «TU MEJOR MARCA»: la mejor puntuación guardada con ese nombre y su puesto.
// Sin caché: depende del nombre de la sesión local de cada visitante.
export async function obtenerMejorMarca(
  game: string,
  name: string,
): Promise<{ rank: number; score: number; date: string } | null> {
  if (!JUEGOS_CON_RANKING.includes(game) || typeof name !== "string") {
    return null;
  }
  const nombre = normalizarNombre(name);
  if (!nombre) return null;
  try {
    const supabase = await createClient();
    const { data: propia, error } = await supabase
      .from("leaderboard")
      .select("score, created_at")
      .eq("game_id", game)
      .eq("player_name", nombre)
      .maybeSingle();
    if (error) throw error;
    if (!propia || propia.score === null || propia.created_at === null) {
      return null;
    }
    // Mismo criterio de desempate que `obtenerRanking`: más puntos, luego antes.
    const { count, error: errorPuesto } = await supabase
      .from("leaderboard")
      .select("*", { count: "exact", head: true })
      .eq("game_id", game)
      .or(
        `score.gt.${propia.score},and(score.eq.${propia.score},created_at.lt.${propia.created_at})`,
      );
    if (errorPuesto) throw errorPuesto;
    return {
      rank: (count ?? 0) + 1,
      score: propia.score,
      date: formatearFecha(propia.created_at),
    };
  } catch (error) {
    console.error("obtenerMejorMarca: fallo", error);
    return null;
  }
}

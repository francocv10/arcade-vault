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
  PARTIDAS_POR_HORA,
  puntuacionPosible,
} from "./schema";
const ERROR_TOPE_PARTIDAS =
  "[ERR] Has jugado demasiadas partidas seguidas. Espera un rato para volver al ranking.";
const ERROR_GUARDADO =
  "[ERR] No se pudo guardar la puntuación. Inténtalo de nuevo.";
const ERROR_SIN_NOMBRE =
  "[ERR] Elige tu nombre de jugador antes de guardar la puntuación.";
const ERROR_SIN_SESION = "[ERR] Inicia sesión para entrar en el ranking.";
const ERROR_VALIDACION = "[ERR] No se pudo validar esta puntuación.";
const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Rechazo por validación: el motivo va al log, sin datos de la cuenta, y el
// cliente recibe siempre el mismo mensaje para no ayudar a afinar una cifra.
function rechazar(motivo: string): { ok: false; error: string } {
  console.warn(`guardarPuntuacion: rechazada, ${motivo}`);
  return { ok: false, error: ERROR_VALIDACION };
}
// Abre una partida de una cuenta (spec 22). Es un endpoint público: la sesión
// sale de las cookies, nunca de un parámetro, y el juego se valida aquí. Solo
// devuelve el id; `guardarPuntuacion` lo exige para publicar. Solo el tope de
// PARTIDAS_POR_HORA (spec 23) devuelve `error`: los demás fallos van sin texto.
export async function iniciarPartida(
  game: string,
): Promise<{ ok: boolean; partidaId?: string; error?: string }> {
  if (typeof game !== "string" || !JUEGOS_CON_RANKING.includes(game)) {
    return { ok: false };
  }
  try {
    const supabase = await createClient();
    // getUser y no getClaims (spec 23): getClaims acepta una sesión ya cerrada
    // hasta que caduca el JWT; getUser pregunta a Supabase.
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
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
    // Tope por hora (spec 23): cuentan todas las filas de esa hora. Si el
    // recuento falla se inserta igual, para no dejar sin ranking a nadie.
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: errorRecuento } = await admin
      .from("partidas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("iniciada_en", haceUnaHora);
    if (errorRecuento) {
      console.warn(
        "iniciarPartida: no se contaron las partidas recientes",
        errorRecuento.message,
      );
    } else if ((count ?? 0) >= PARTIDAS_POR_HORA) {
      console.warn("iniciarPartida: rechazada, tope de partidas por hora");
      return { ok: false, error: ERROR_TOPE_PARTIDAS };
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
// Publica la puntuación de una partida abierta con `iniciarPartida` (spec 22).
// El juego sale de la partida y el nombre de la cuenta: el cliente solo envía
// el id y la cifra. Los rechazos por validación dan siempre el mismo mensaje
// genérico, y el motivo solo queda en el log del servidor.
export async function guardarPuntuacion(envio: {
  partidaId: string;
  score: number;
}): Promise<{ ok: boolean; error?: string }> {
  let game: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return { ok: false, error: ERROR_SIN_SESION };
    // getUser y no los claims: updateUser no renueva el JWT, así que el
    // nombre recién elegido no estaría en el token hasta el siguiente refresco.
    const { data: cuenta } = await supabase.auth.getUser();
    if (!cuenta.user) return { ok: false, error: ERROR_GUARDADO };
    const { username } = cuenta.user.user_metadata;
    if (!tieneUsuario(username)) {
      return { ok: false, error: ERROR_SIN_NOMBRE };
    }
    const { partidaId, score } = (envio ?? {}) as Record<string, unknown>;
    if (
      typeof partidaId !== "string" ||
      !FORMATO_UUID.test(partidaId) ||
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < 0
    ) {
      return rechazar("envío mal formado");
    }
    const admin = createAdminClient();
    const { data: partida, error: errorPartida } = await admin
      .from("partidas")
      .select("game_id, iniciada_en")
      .eq("id", partidaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (errorPartida) {
      console.error(
        "guardarPuntuacion: error de Supabase al leer la partida",
        errorPartida.message,
      );
      return { ok: false, error: ERROR_GUARDADO };
    }
    if (!partida) return rechazar("partida inexistente o de otra cuenta");
    game = partida.game_id;
    // Tiempo total desde que se abrió la partida, pausas incluidas.
    const segundos = Math.max(
      0,
      (Date.now() - new Date(partida.iniciada_en).getTime()) / 1000,
    );
    if (!puntuacionPosible(game, score, segundos)) {
      return rechazar(
        `puntuación imposible (${game}: ${score} en ${Math.round(segundos)} s)`,
      );
    }
    const { error } = await admin.from("scores").insert({
      game_id: game,
      player_name: normalizarNombre(username),
      score,
      user_id: userId,
      partida_id: partidaId,
    });
    if (error?.code === "23505") return rechazar("partida ya publicada");
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

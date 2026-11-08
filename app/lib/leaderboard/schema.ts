// Validación del envío de una puntuación. Los límites replican los CHECK de
// `public.scores`: la base de datos es la última barrera.
export interface EnvioPuntuacion {
  game: string; // debe existir en `games`; hoy "asteroides" y "tetris"
  name: string; // 1..10 caracteres tras trim, en mayúsculas
  score: number; // entero 0..1_000_000
}
export const LIMITES_PUNTUACION = {
  nombreMax: 10,
  puntosMax: 1_000_000,
} as const;
// Juegos que ya existen en la tabla `games`.
export const JUEGOS_CON_RANKING: readonly string[] = [
  "asteroides",
  "tetris",
  "arkanoid",
  "snake",
  "frogger",
];
export type ResultadoEnvio =
  { ok: true; envio: EnvioPuntuacion } | { ok: false; error: string };
// Mismo recuento que `char_length` de Postgres: caracteres, no unidades UTF-16.
function longitud(texto: string): number {
  return Array.from(texto).length;
}
export function normalizarNombre(nombre: string): string {
  return nombre
    .replace(/[\r\n]+/g, " ")
    .trim()
    .toUpperCase();
}
// Nombre que se muestra de una cuenta: "" o sin definir mientras no lo elija.
export function nombreDeCuenta(username: unknown): string {
  return typeof username === "string" && username ? username : "JUGADOR";
}
export function validarEnvio(entrada: unknown): ResultadoEnvio {
  if (typeof entrada !== "object" || entrada === null) {
    return { ok: false, error: "Envío no válido." };
  }
  const { game, name, score } = entrada as Record<string, unknown>;
  if (typeof game !== "string" || !JUEGOS_CON_RANKING.includes(game)) {
    return { ok: false, error: "Juego no válido." };
  }
  if (typeof name !== "string") {
    return { ok: false, error: "Nombre no válido." };
  }
  const nombre = normalizarNombre(name);
  if (longitud(nombre) < 1 || longitud(nombre) > LIMITES_PUNTUACION.nombreMax) {
    return {
      ok: false,
      error: `El nombre debe tener entre 1 y ${LIMITES_PUNTUACION.nombreMax} caracteres.`,
    };
  }
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > LIMITES_PUNTUACION.puntosMax
  ) {
    return { ok: false, error: "Puntuación no válida." };
  }
  return { ok: true, envio: { game, name: nombre, score } };
}
// Límites por juego (spec 22). Son techos sobre las constantes de cada motor,
// no estimaciones: un límite ajustado rechazaría a jugadores reales. Un juego
// nuevo con ranking necesita su entrada aquí o no podrá publicar.
export const LIMITES_POR_JUEGO: Record<
  string,
  { puntosMax: number; puntosPorSegundo: number }
> = {
  asteroides: { puntosMax: 1_000_000, puntosPorSegundo: 500 },
  tetris: { puntosMax: 1_000_000, puntosPorSegundo: 2_000 },
  arkanoid: { puntosMax: 2_080, puntosPorSegundo: 200 },
  snake: { puntosMax: 1_000_000, puntosPorSegundo: 160 },
  frogger: { puntosMax: 1_000_000, puntosPorSegundo: 300 },
};
// El motor arranca antes de que llegue la respuesta de `iniciarPartida`.
export const GRACIA_SEGUNDOS = 5;
export const PARTIDA_MAX_SEGUNDOS = 6 * 60 * 60;
// Tope de partidas abiertas por cuenta en la última hora, publicadas o no
// (spec 23). Una partida real dura más de un minuto.
export const PARTIDAS_POR_HORA = 60;
// `segundos` es el tiempo total desde `partidas.iniciada_en`, pausas incluidas.
export function puntuacionPosible(
  game: string,
  score: number,
  segundos: number,
): boolean {
  if (!Object.hasOwn(LIMITES_POR_JUEGO, game)) return false;
  if (!Number.isFinite(score) || !Number.isFinite(segundos)) return false;
  const { puntosMax, puntosPorSegundo } = LIMITES_POR_JUEGO[game];
  return (
    score <= puntosMax &&
    segundos <= PARTIDA_MAX_SEGUNDOS &&
    score <= (segundos + GRACIA_SEGUNDOS) * puntosPorSegundo
  );
}

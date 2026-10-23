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
export const JUEGOS_CON_RANKING: readonly string[] = ["asteroides", "tetris"];
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

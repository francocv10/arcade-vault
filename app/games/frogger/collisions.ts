// Colisiones, soporte en el río y metas de Frogger: lógica pura que recibe el
// estado por parámetro y no accede a `document` ni a `window`.
import { GOAL_COLS, GOAL_WIDTH, ROW_GOALS } from "./board";
import type { Entity, Frog, Lane } from "./board";
import { esCarrilCarretera, esCarrilRio } from "./lanes";
// La rana ocupa el centro de su casilla: deja 0,15 a cada lado, así un coche
// que solo roza el borde de la casilla no la atropella.
const MARGEN_RANA = 0.15;
export type ResultadoMeta =
  { tipo: "boca"; indice: number } | { tipo: "ocupada" } | { tipo: "muro" };
// Carril de la rana: la casilla que ocupa (el origen mientras salta).
export function carrilDeLaRana(
  frog: Frog,
  lanes: readonly Lane[],
): Lane | null {
  return lanes.find((lane) => lane.row === frog.row) ?? null;
}
export function checkRoadCollision(
  frog: Frog,
  lanes: readonly Lane[],
): boolean {
  const lane = carrilDeLaRana(frog, lanes);
  if (!lane || !esCarrilCarretera(lane)) return false;
  const desde = frog.col + MARGEN_RANA;
  const hasta = frog.col + 1 - MARGEN_RANA;
  return lane.entities.some((e) => desde < e.col + e.width && hasta > e.col);
}
// Entidad del río sobre la que descansa la rana; `null` si cae al agua. Una
// tortuga sumergida no sirve de apoyo.
export function getSupport(frog: Frog, lanes: readonly Lane[]): Entity | null {
  const lane = carrilDeLaRana(frog, lanes);
  if (!lane || !esCarrilRio(lane)) return null;
  const centro = frog.col + 0.5;
  const soporte = lane.entities.find(
    (e) => centro >= e.col && centro < e.col + e.width,
  );
  if (!soporte || soporte.submerged === true) return null;
  return soporte;
}
export function checkGoal(
  frog: Frog,
  ocupadas: readonly boolean[],
): ResultadoMeta | null {
  if (frog.row !== ROW_GOALS) return null;
  const col = Math.round(frog.col);
  const indice = GOAL_COLS.findIndex(
    (desde) => col >= desde && col < desde + GOAL_WIDTH,
  );
  if (indice === -1) return { tipo: "muro" };
  if (ocupadas[indice]) return { tipo: "ocupada" };
  return { tipo: "boca", indice };
}

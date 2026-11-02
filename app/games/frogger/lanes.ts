// Mapa de carriles de Frogger: lógica pura que no accede a `document` ni a `window`.
import {
  Lane,
  Entity,
  EntityType,
  ROW_RIVER_TOP,
  ROW_RIVER_BOT,
  ROW_ROAD_TOP,
  ROW_ROAD_BOT,
  TURTLE_VISIBLE_MS,
  TURTLE_SUBMERGED_MS,
} from "./board";
// Las entidades de un carril dan la vuelta en un circuito de PERIODO casillas
// (la rejilla más 4 de margen, la longitud máxima de un tronco), así los huecos
// entre ellas se conservan al reintroducirse por el lado opuesto.
export const PERIODO = 20;
export const AUMENTO_VELOCIDAD_POR_NIVEL = 1.15;
type Pieza = readonly [EntityType, number];
interface DefCarril {
  row: number;
  dir: 1 | -1;
  speed: number; // casillas por segundo en el nivel 1
  piezas: readonly Pieza[];
}
const CAR1: Pieza = ["car", 1];
const CAR2: Pieza = ["car", 2];
const TRUCK: Pieza = ["truck", 3];
const log = (w: number): Pieza => ["log", w];
const turtle = (w: number): Pieza => ["turtle", w];
// Carretera (filas 8 a 12): de 2,3 a 5 casillas/s, sentidos alternos.
const CARRETERA: readonly DefCarril[] = [
  { row: 12, dir: -1, speed: 2.3, piezas: [CAR1, CAR1, CAR1] },
  { row: 11, dir: 1, speed: 3.2, piezas: [CAR2, CAR2] },
  { row: 10, dir: -1, speed: 2.8, piezas: [TRUCK, TRUCK] },
  { row: 9, dir: 1, speed: 4.2, piezas: [CAR1, CAR1, CAR1, CAR1] },
  { row: 8, dir: -1, speed: 5, piezas: [CAR2, TRUCK] },
];
// Río (filas 1 a 6): de 1,5 a 3,5 casillas/s; troncos de 2 a 4 y tortugas de 2 a 3.
const RIO: readonly DefCarril[] = [
  {
    row: 6,
    dir: 1,
    speed: 1.8,
    piezas: [turtle(2), turtle(2), turtle(2), turtle(2)],
  },
  { row: 5, dir: -1, speed: 2.5, piezas: [log(3), log(3), log(3)] },
  { row: 4, dir: 1, speed: 1.5, piezas: [log(4), log(4), log(3)] },
  { row: 3, dir: -1, speed: 2, piezas: [turtle(3), turtle(3), turtle(3)] },
  { row: 2, dir: 1, speed: 3.5, piezas: [log(2), log(3), log(2), log(3)] },
  { row: 1, dir: -1, speed: 2.2, piezas: [log(3), log(4), log(3)] },
];
const CICLO_TORTUGA_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
export function velocidadPorNivel(
  velocidadBase: number,
  nivel: number,
): number {
  return velocidadBase * AUMENTO_VELOCIDAD_POR_NIVEL ** (nivel - 1);
}
function construirCarril(def: DefCarril, nivel: number): Lane {
  const ocupado = def.piezas.reduce((suma, [, ancho]) => suma + ancho, 0);
  // Huecos iguales entre piezas a lo largo de todo el circuito.
  const hueco = (PERIODO - ocupado) / def.piezas.length;
  let cursor = 0;
  const entities: Entity[] = def.piezas.map(([type, width], i) => {
    const entity: Entity = { col: cursor - 4, width, type };
    if (type === "turtle") {
      entity.fase = (i * 1000) % CICLO_TORTUGA_MS;
      entity.submerged = entity.fase >= TURTLE_VISIBLE_MS;
    }
    cursor += width + hueco;
    return entity;
  });
  return {
    row: def.row,
    dir: def.dir,
    speed: velocidadPorNivel(def.speed, nivel),
    entities,
  };
}
// Devuelve los 11 carriles (5 de carretera y 6 de río) ordenados por fila.
export function buildLanes(level: number): Lane[] {
  return [...RIO, ...CARRETERA]
    .map((def) => construirCarril(def, level))
    .sort((a, b) => a.row - b.row);
}
export const esCarrilCarretera = (lane: Lane): boolean =>
  lane.row >= ROW_ROAD_TOP && lane.row <= ROW_ROAD_BOT;
export const esCarrilRio = (lane: Lane): boolean =>
  lane.row >= ROW_RIVER_TOP && lane.row <= ROW_RIVER_BOT;

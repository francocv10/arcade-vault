import type { ColorBoton } from "./games";
export interface EstadisticaHome {
  n: string; // "5", "MILES", "GLOBAL"
  u: string; // "JUEGOS", "DE PARTIDAS", "RANKING"
  s: string; // "Y CONTANDO", ...
}
export interface ActividadReciente {
  p: string; // jugador, p. ej. "NEONFOX"
  g: string; // nombre del juego, p. ej. "Tetris"
  s: number; // puntos
  t: string; // "hace 2 min"
  c: ColorBoton; // color neón del jugador
}
export interface TopJugadorHoy {
  r: number; // posición 1..5
  p: string;
  s: number;
}
export const HOME_STATS: EstadisticaHome[] = [
  { n: "5", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

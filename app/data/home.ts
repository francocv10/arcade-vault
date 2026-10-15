import type { ColorBoton } from "./games";

export interface EstadisticaHome {
  n: string;   // "12+", "MILES", "GLOBAL"
  u: string;   // "JUEGOS", "DE PARTIDAS", "RANKING"
  s: string;   // "Y CONTANDO", ...
}

export interface ActividadReciente {
  p: string;           // jugador, p. ej. "NEONFOX"
  g: string;           // nombre del juego, p. ej. "Caída"
  s: number;           // puntos
  t: string;           // "hace 2 min"
  c: ColorBoton;       // color neón del jugador
}

export interface TopJugadorHoy {
  r: number;           // posición 1..5
  p: string;
  s: number;
}

export const HOME_STATS: EstadisticaHome[] = [
  { n: "12+", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

export const RECENT_ACTIVITY: ActividadReciente[] = [
  { p: "NEONFOX", g: "Caída", s: 184220, t: "hace 2 min", c: "magenta" },
  { p: "PX_KAI", g: "Glotón", s: 96400, t: "hace 5 min", c: "yellow" },
  { p: "Z3R0COOL", g: "Invasores", s: 54190, t: "hace 8 min", c: "green" },
  { p: "VAULT_07", g: "Rocas", s: 41200, t: "hace 12 min", c: "cyan" },
  { p: "GLITCHA", g: "Bloque Buster", s: 28450, t: "hace 18 min", c: "cyan" },
  { p: "ARKADYA", g: "Serpentina", s: 7820, t: "hace 24 min", c: "green" },
  { p: "CYBER_LU", g: "Ranaria", s: 18900, t: "hace 31 min", c: "yellow" },
];

export const TOP_TODAY: TopJugadorHoy[] = [
  { r: 1, p: "NEONFOX", s: 312840 },
  { r: 2, p: "PX_KAI", s: 248110 },
  { r: 3, p: "M00NRYU", s: 196720 },
  { r: 4, p: "VAULT_07", s: 154300 },
  { r: 5, p: "GLITCHA", s: 138900 },
];

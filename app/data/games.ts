// Juegos ficticios de Arcade Vault. Esta capa se sustituirá por una base de datos.
export type Categoria = "ARCADE" | "PUZZLE" | "SHOOTER";
export type ColorBoton = "cyan" | "magenta" | "yellow" | "green";
export interface Juego {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Categoria;
  cover: string;
  color: ColorBoton;
}
export const GAMES: Juego[] = [
  {
    id: "asteroides",
    title: "ASTEROIDES",
    short: "Parte rocas en un espacio sin bordes.",
    long: "Tu nave triangular flota en un campo de asteroides sin límites. Rota, propulsa y dispara para partir las rocas grandes en medianas y las medianas en pequeñas. Recoge el power-up 3x para disparar en abanico.",
    cat: "SHOOTER",
    cover: "cover-asteroides",
    color: "cyan",
  },
  {
    id: "tetris",
    title: "TETRIS",
    short: "Encaja siete piezas sin tocar el techo.",
    long: "Siete piezas caen sobre un tablero de 10×20. Muévelas, rótalas y déjalas caer para completar líneas; cada 10 líneas sube el nivel y la caída se acelera. Solo tienes una vida: si una pieza nueva no cabe al aparecer, la partida termina.",
    cat: "PUZZLE",
    cover: "cover-tetris",
    color: "magenta",
  },
  {
    id: "arkanoid",
    title: "ARKANOID",
    short: "Rompe los 5 muros sin que caiga la pelota.",
    long: "Mueve la paleta con el ratón o las flechas y rebota la pelota para destruir muros de bloques de colores. Cada nivel cambia el patrón y acelera la pelota. Tienes 3 vidas: si la pelota cae por debajo de la paleta, pierdes una. Limpia los 5 niveles para ganar.",
    cat: "ARCADE",
    cover: "cover-arkanoid",
    color: "yellow",
  },
  {
    id: "snake",
    title: "SNAKE",
    short: "Come frutas, crece y no te muerdas la cola.",
    long: "Guía a la serpiente por el tablero con las flechas o WASD y come las frutas que aparecen. Cada fruta suma 10 puntos y alarga a la serpiente; cada 5 frutas subes de nivel y ella se acelera. Un choque con la pared o con tu propio cuerpo termina la partida.",
    cat: "ARCADE",
    cover: "cover-snake-real",
    color: "cyan",
  },
  {
    id: "frogger",
    title: "FROGGER",
    short: "Cruza la carretera y el río sin convertirte en papilla.",
    long: "Guía a tu rana con las flechas o WASD a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tienes 3 vidas y mucho asfalto por delante.",
    cat: "ARCADE",
    cover: "cover-frogger",
    color: "green",
  },
];
export const CATS: ["TODOS", ...Categoria[]] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
];
export function getGame(id: string): Juego | undefined {
  return GAMES.find((g) => g.id === id);
}

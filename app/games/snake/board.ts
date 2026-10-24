// Lógica pura del tablero de Snake: recibe el estado por parámetro y no accede
// a `document` ni a `window`. Coordenadas de casilla, origen arriba a la izquierda.
export const COLS = 20;
export const ROWS = 15;
export const CELL = 40;
export const FRUTAS_POR_NIVEL = 5;
export const NIVEL_MAX = 60;
export interface Celda {
  x: number;
  y: number;
}
export function nextHead(head: Celda, dir: Celda): Celda {
  return { x: head.x + dir.x, y: head.y + dir.y };
}
export function chocaConPared(celda: Celda): boolean {
  return celda.x < 0 || celda.x >= COLS || celda.y < 0 || celda.y >= ROWS;
}
// `snake[0]` es la cabeza. Si la serpiente no crece en este paso, la cola se
// desplaza y libera su casilla, así que la cabeza puede entrar en ella.
export function chocaConCuerpo(
  snake: readonly Celda[],
  celda: Celda,
  crece: boolean,
): boolean {
  const limite = crece ? snake.length : snake.length - 1;
  for (let i = 0; i < limite; i++) {
    if (snake[i].x === celda.x && snake[i].y === celda.y) return true;
  }
  return false;
}
// Elige una casilla no ocupada por la serpiente; `null` si el tablero está lleno.
export function celdaLibre(
  snake: readonly Celda[],
  rnd: () => number = Math.random,
): Celda | null {
  const ocupadas = new Set(snake.map((c) => c.y * COLS + c.x));
  const libres: Celda[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!ocupadas.has(y * COLS + x)) libres.push({ x, y });
    }
  }
  if (libres.length === 0) return null;
  return libres[Math.floor(rnd() * libres.length)];
}
export function nivelPorFrutas(frutas: number): number {
  return Math.min(NIVEL_MAX, 1 + Math.floor(frutas / FRUTAS_POR_NIVEL));
}

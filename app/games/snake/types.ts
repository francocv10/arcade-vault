export type EstadoSnake = "playing" | "gameover";
export interface SnapshotSnake {
  score: number; // entero 0..2970
  lives: number; // 1 mientras se juega, 0 en gameover
  level: number; // 1..60
  status: EstadoSnake;
}
export interface JuegoSnake {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

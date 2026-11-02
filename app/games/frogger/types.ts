export type EstadoFrogger = "playing" | "gameover";
export interface SnapshotFrogger {
  score: number; // entero >= 0
  lives: number; // 3 a 0
  level: number; // >= 1
  status: EstadoFrogger;
}
export interface JuegoFrogger {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

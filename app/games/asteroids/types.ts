export type EstadoAsteroides = "playing" | "dead" | "gameover";
export interface SnapshotAsteroides {
  score: number;
  lives: number;
  level: number;
  status: EstadoAsteroides;
}
export interface JuegoAsteroides {
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}

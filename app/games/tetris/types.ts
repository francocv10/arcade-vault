export type EstadoTetris = "playing" | "gameover";
export type TemaTetris = "dark" | "light";
export interface SnapshotTetris {
  score: number; // entero 0..1_000_000
  lives: number; // 1 mientras se juega, 0 en gameover
  level: number; // floor(lines / 10) + 1
  status: EstadoTetris;
}
export interface JuegoTetris {
  pause(): void;
  resume(): void;
  restart(): void;
  setTheme(tema: TemaTetris): void;
  destroy(): void;
}

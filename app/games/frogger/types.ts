export type EstadoFrogger = "playing" | "gameover";
export interface SnapshotFrogger {
  score: number; // entero >= 0
  lives: number; // 3 a 0
  level: number; // >= 1
  status: EstadoFrogger;
}
export type SkinFrogger = "clasico" | "neon" | "retro";
export interface JuegoFrogger {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinFrogger): void; // no-op si es la misma o tras destroy(); redibuja si el bucle está parado
  destroy(): void;
}

export type EstadoSnake = "playing" | "gameover";
export type SkinSnake = "clasico" | "neon" | "retro";
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
  setSkin(skin: SkinSnake): void; // no-op si es la misma o tras destroy(); redibuja
  destroy(): void;
}

export type EstadoArkanoid = "playing" | "gameover" | "win";
export type SkinArkanoid = "clasico" | "neon" | "retro";
export interface SnapshotArkanoid {
  score: number; // entero 0..2080
  lives: number; // 3, 2, 1; 0 en gameover; se conservan al ganar
  level: number; // 1..5
  status: EstadoArkanoid;
}
export interface JuegoArkanoid {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinArkanoid): void; // no-op si es la misma o tras destroy(); redibuja
  destroy(): void;
}

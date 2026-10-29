export type EstadoAsteroides = "playing" | "dead" | "gameover";
export interface SnapshotAsteroides {
  score: number;
  lives: number;
  level: number;
  status: EstadoAsteroides;
}
export type SkinAsteroides = "clasico" | "neon" | "retro";
export interface JuegoAsteroides {
  pause(): void;
  resume(): void;
  restart(): void;
  setSkin(skin: SkinAsteroides): void; // no-op si es la misma o tras destroy(); redibuja
  destroy(): void;
}

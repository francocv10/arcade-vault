export type DireccionTactil = "up" | "down" | "left" | "right";
export interface TeclaEmulada {
  code: string; // KeyboardEvent.code que lee el motor
  key: string; // KeyboardEvent.key (Snake lee `key`)
}
export interface BotonAccion {
  etiqueta: string; // texto bajo el botón, p. ej. "DISPARO"
  tecla: TeclaEmulada;
}
export interface ControlesTactiles {
  direcciones: DireccionTactil[]; // activas; las demás se muestran deshabilitadas
  a: BotonAccion | null; // null = deshabilitado
  b: BotonAccion | null;
  repetir: boolean; // auto-repetición de las direcciones mantenidas
}
export const TECLAS_DIRECCION: Record<DireccionTactil, TeclaEmulada> = {
  up: { code: "ArrowUp", key: "ArrowUp" },
  down: { code: "ArrowDown", key: "ArrowDown" },
  left: { code: "ArrowLeft", key: "ArrowLeft" },
  right: { code: "ArrowRight", key: "ArrowRight" },
};
const ESPACIO: TeclaEmulada = { code: "Space", key: " " };
const TECLA_X: TeclaEmulada = { code: "KeyX", key: "x" };
// Un juego real nuevo añade aquí su entrada (ver puntos-de-integracion.md).
export const CONTROLES_TACTILES: Record<string, ControlesTactiles> = {
  asteroides: {
    direcciones: ["left", "right", "up"],
    a: { etiqueta: "DISPARO", tecla: ESPACIO },
    b: null,
    repetir: false,
  },
  tetris: {
    direcciones: ["left", "right", "down", "up"],
    a: { etiqueta: "CAÍDA", tecla: ESPACIO },
    b: { etiqueta: "GIRAR", tecla: TECLA_X },
    repetir: true,
  },
  arkanoid: {
    direcciones: ["left", "right"],
    a: null,
    b: null,
    repetir: false,
  },
  snake: {
    direcciones: ["up", "down", "left", "right"],
    a: null,
    b: null,
    repetir: false,
  },
};

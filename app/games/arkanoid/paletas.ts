import type { ColorBloque } from "./levels";
import type { SkinArkanoid } from "./types";
interface PaletaBase {
  fondo: string; // relleno del lienzo
  hud: string; // Score, Nivel
  overlayFondo: string; // velo de GAME OVER y victoria
  overlayTexto: string; // texto central del velo
  brillo: number; // shadowBlur de las formas y del texto (0 = no se toca)
  fuenteHud: string;
  fuenteOverlay: string;
}
// "sprites": se dibuja el spritesheet original, sin más campos.
export interface PaletaSprites extends PaletaBase {
  modo: "sprites";
}
// "formas": figuras vectoriales que ocupan el mismo rectángulo que cada sprite.
export interface PaletaFormas extends PaletaBase {
  modo: "formas";
  bloques: Record<ColorBloque, string>; // color de cada bloque
  bloqueBorde: string; // trazo interior de los bloques
  paleta: string; // relleno de la paleta
  paletaBorde: string; // trazo y tapas de la paleta
  pelota: string; // relleno de la pelota y de las bolas de vidas
  grosor: number; // lineWidth de los bordes
}
export type PaletaArkanoid = PaletaSprites | PaletaFormas;
const RESPALDO_PIXEL = '"Courier New", monospace';
let familiaPixel = "";
// Familia de Press Start 2P que next/font expone en --font-press-start. Solo en el navegador.
export function resolverFuentePixel(): string {
  if (familiaPixel) return familiaPixel;
  if (typeof document === "undefined") return RESPALDO_PIXEL;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-press-start")
    .trim();
  if (!valor) return RESPALDO_PIXEL;
  familiaPixel = `${valor}, ${RESPALDO_PIXEL}`;
  return familiaPixel;
}
export const PALETAS: Record<SkinArkanoid, PaletaArkanoid> = {
  clasico: {
    modo: "sprites",
    fondo: "#000000",
    hud: "#ffffff",
    overlayFondo: "rgba(0, 0, 0, 0.6)",
    overlayTexto: "#ffffff",
    brillo: 0,
    fuenteHud: "bold 18px monospace",
    fuenteOverlay: "bold 64px monospace",
  },
  neon: {
    modo: "formas",
    fondo: "#05010f",
    bloques: {
      red: "#ff006e",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#d100ff",
      hotpink: "#ff5fa2",
      green: "#00ff88",
      gray: "#8a8fb5",
    },
    bloqueBorde: "#05010f",
    paleta: "#00f5ff",
    paletaBorde: "#ffffff",
    pelota: "#f5ff00",
    hud: "#00f5ff",
    overlayFondo: "rgba(5, 1, 15, 0.7)",
    overlayTexto: "#ff006e",
    grosor: 2,
    brillo: 12,
    fuenteHud: "bold 18px monospace",
    fuenteOverlay: "bold 64px monospace",
  },
  retro: {
    modo: "formas",
    fondo: "#0a140a",
    bloques: {
      red: "#33ff33",
      yellow: "#20b020",
      cyan: "#33ff33",
      magenta: "#20b020",
      hotpink: "#33ff33",
      green: "#20b020",
      gray: "#106010",
    },
    bloqueBorde: "#0a140a",
    paleta: "#33ff33",
    paletaBorde: "#0a140a",
    pelota: "#33ff33",
    hud: "#33ff33",
    overlayFondo: "rgba(10, 20, 10, 0.8)",
    overlayTexto: "#33ff33",
    grosor: 2,
    brillo: 0,
    // Getters: la familia pixel solo se conoce en el navegador, al leer la fuente.
    get fuenteHud() {
      return `12px ${resolverFuentePixel()}`;
    },
    get fuenteOverlay() {
      return `34px ${resolverFuentePixel()}`;
    },
  },
};

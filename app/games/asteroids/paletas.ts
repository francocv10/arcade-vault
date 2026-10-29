import type { SkinAsteroides } from "./types";
export interface PaletaAsteroides {
  fondo: string; // relleno del lienzo
  nave: string; // trazo de la nave
  asteroide: string; // trazo de los asteroides
  bala: string; // relleno de las balas
  particulaRgb: string; // "r,g,b" de las chispas; el alfa lo pone la vida restante
  powerUp: string; // marco y texto "3x"
  llamaRgb: string; // "r,g,b" de la llama del propulsor
  llamaAlfa: number;
  hud: string; // SCORE y NIVEL
  hudExtra: string; // contador "3x  N.Ns"
  iconoVida: string; // trazo del icono de vidas
  overlayTitulo: string; // "GAME OVER"
  overlaySub: string; // subtítulo del GAME OVER
  grosor: number; // lineWidth de nave y asteroides
  grosorVida: number; // lineWidth del icono de vidas
  union: CanvasLineJoin; // lineJoin de nave, asteroides e icono
  brillo: number; // shadowBlur de nave, asteroides, balas, power-up y texto (0 = sin brillo)
  fuenteHud: string;
  fuenteTitulo: string;
  fuenteSub: string;
  fuentePowerUp: string;
}
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
export const PALETAS: Record<SkinAsteroides, PaletaAsteroides> = {
  clasico: {
    fondo: "#000000",
    nave: "#ffffff",
    asteroide: "#ffffff",
    bala: "#ffffff",
    particulaRgb: "255,255,255",
    powerUp: "#00ffff",
    llamaRgb: "255,130,0",
    llamaAlfa: 0.85,
    hud: "#ffffff",
    hudExtra: "#00ffff",
    iconoVida: "#ffffff",
    overlayTitulo: "#ffffff",
    overlaySub: "rgba(255,255,255,0.65)",
    grosor: 1.5,
    grosorVida: 1.2,
    union: "round",
    brillo: 0,
    fuenteHud: "15px monospace",
    fuenteTitulo: "bold 46px monospace",
    fuenteSub: "18px monospace",
    fuentePowerUp: "bold 12px monospace",
  },
  neon: {
    fondo: "#05010f",
    nave: "#00f5ff",
    asteroide: "#ff006e",
    bala: "#f5ff00",
    particulaRgb: "255,0,110",
    powerUp: "#00ff88",
    llamaRgb: "245,255,0",
    llamaAlfa: 0.85,
    hud: "#00f5ff",
    hudExtra: "#00ff88",
    iconoVida: "#00f5ff",
    overlayTitulo: "#ff006e",
    overlaySub: "#00f5ff",
    grosor: 2,
    grosorVida: 1.6,
    union: "round",
    brillo: 12,
    fuenteHud: "15px monospace",
    fuenteTitulo: "bold 46px monospace",
    fuenteSub: "18px monospace",
    fuentePowerUp: "bold 12px monospace",
  },
  retro: {
    fondo: "#0a140a",
    nave: "#33ff33",
    asteroide: "#20b020",
    bala: "#33ff33",
    particulaRgb: "51,255,51",
    powerUp: "#33ff33",
    llamaRgb: "32,176,32",
    llamaAlfa: 1,
    hud: "#33ff33",
    hudExtra: "#33ff33",
    iconoVida: "#33ff33",
    overlayTitulo: "#33ff33",
    overlaySub: "#20b020",
    grosor: 2,
    grosorVida: 2,
    union: "miter",
    brillo: 0,
    // Getters: la familia pixel solo se conoce en el navegador, al leer la fuente.
    get fuenteHud() {
      return `10px ${resolverFuentePixel()}`;
    },
    get fuenteTitulo() {
      return `28px ${resolverFuentePixel()}`;
    },
    get fuenteSub() {
      return `11px ${resolverFuentePixel()}`;
    },
    get fuentePowerUp() {
      return `9px ${resolverFuentePixel()}`;
    },
  },
};

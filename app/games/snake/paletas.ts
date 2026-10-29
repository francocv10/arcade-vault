import { resolverFuentePixel } from "@/app/games/asteroids/paletas";
import type { SkinSnake } from "./types";
export interface PaletaSnake {
  casillaClara: string; // casilla (x + y) par
  casillaOscura: string; // casilla (x + y) impar
  serpiente: string; // cuerpo y cabeza
  ojoBlanco: string;
  ojoPupila: string;
  frutaModo: "sprite" | "forma"; // sprite = atlas fruits.png; forma = cuadrado pixel-art
  frutaBrillo: number; // shadowBlur del sprite (0 = sin brillo)
  frutaBrilloColor: string; // shadowColor del sprite
  frutaForma: string; // cuerpo de la forma (solo modo "forma")
  frutaTallo: string; // tallo de la forma (solo modo "forma")
  brilloSerpiente: number; // shadowBlur del cuerpo y la cabeza (0 = sin brillo)
  velo: string; // fondo de la leyenda inicial
  veloGameOver: string; // velo a pantalla completa del GAME OVER
  texto: string;
  fuenteLeyenda: string;
  fuenteTitulo: string;
  fuenteSub: string;
}
export const PALETAS: Record<SkinSnake, PaletaSnake> = {
  clasico: {
    casillaClara: "#aad751",
    casillaOscura: "#a2d149",
    serpiente: "#4e7cf6",
    ojoBlanco: "#ffffff",
    ojoPupila: "#000000",
    frutaModo: "sprite",
    frutaBrillo: 0,
    frutaBrilloColor: "#000000", // sin uso
    frutaForma: "#000000", // sin uso
    frutaTallo: "#000000", // sin uso
    brilloSerpiente: 0,
    velo: "rgba(0, 0, 0, 0.55)",
    veloGameOver: "rgba(0, 0, 0, 0.6)",
    texto: "#ffffff",
    fuenteLeyenda: "bold 28px monospace",
    fuenteTitulo: "bold 64px monospace",
    fuenteSub: "bold 32px monospace",
  },
  neon: {
    casillaClara: "#0b0620",
    casillaOscura: "#07031a",
    serpiente: "#00f5ff",
    ojoBlanco: "#ffffff",
    ojoPupila: "#ff006e",
    frutaModo: "sprite",
    frutaBrillo: 14,
    frutaBrilloColor: "#f5ff00",
    frutaForma: "#000000", // sin uso
    frutaTallo: "#000000", // sin uso
    brilloSerpiente: 12,
    velo: "rgba(5, 1, 15, 0.7)",
    veloGameOver: "rgba(5, 1, 15, 0.75)",
    texto: "#00ff88",
    fuenteLeyenda: "bold 28px monospace",
    fuenteTitulo: "bold 64px monospace",
    fuenteSub: "bold 32px monospace",
  },
  retro: {
    casillaClara: "#0a140a",
    casillaOscura: "#0d1a0d",
    serpiente: "#33ff33",
    ojoBlanco: "#0a140a",
    ojoPupila: "#33ff33",
    frutaModo: "forma",
    frutaBrillo: 0,
    frutaBrilloColor: "#000000", // sin uso
    frutaForma: "#20b020",
    frutaTallo: "#33ff33",
    brilloSerpiente: 0,
    velo: "rgba(10, 20, 10, 0.85)",
    veloGameOver: "rgba(10, 20, 10, 0.9)",
    texto: "#33ff33",
    // Getters: la familia pixel solo se conoce en el navegador, al leer la fuente.
    get fuenteLeyenda() {
      return `16px ${resolverFuentePixel()}`;
    },
    get fuenteTitulo() {
      return `36px ${resolverFuentePixel()}`;
    },
    get fuenteSub() {
      return `18px ${resolverFuentePixel()}`;
    },
  },
};

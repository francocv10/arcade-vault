import { resolverFuentePixel } from "@/app/games/asteroids/paletas";
import type { SkinFrogger } from "./types";
export interface PaletaFrogger {
  fondo: string; // fondo del canvas fuera de la rejilla
  meta: string; // fila de bocas
  boca: string;
  bocaBorde: string;
  rio: string;
  rioOla: string;
  segura: string; // franja central y casilla de inicio
  carretera: string;
  linea: string; // líneas discontinuas entre carriles
  tronco: string;
  troncoVeta: string;
  tortuga: string;
  tortugaOscura: string;
  rana: string;
  ranaOscura: string; // patas
  ojoBlanco: string;
  ojoPupila: string;
  coches: readonly [string, string, string, string]; // se reparten por (fila + índice) % 4
  camionCarga: string;
  camionCabina: string;
  cristal: string; // parabrisas
  rueda: string;
  barraFondo: string; // fondo de la barra de tiempo
  tiempoAlto: string; // ratio > 0,5
  tiempoMedio: string; // ratio > 0,25
  tiempoBajo: string; // ratio <= 0,25
  texto: string;
  veloGameOver: string;
  brillo: number; // shadowBlur de entidades, rana, bocas y textos (0 = sin brillo)
  fuenteHud: string;
  fuenteTitulo: string;
  fuenteSub: string;
}
export const PALETAS: Record<SkinFrogger, PaletaFrogger> = {
  clasico: {
    fondo: "#05060f",
    meta: "#14532d",
    boca: "#4ade80",
    bocaBorde: "#facc15",
    rio: "#0b2a63",
    rioOla: "#1d4ed8",
    segura: "#166534",
    carretera: "#0f0f14",
    linea: "rgba(255, 255, 255, 0.28)",
    tronco: "#7c4a21",
    troncoVeta: "#5a3416",
    tortuga: "#22c55e",
    tortugaOscura: "#15803d",
    rana: "#4ade80",
    ranaOscura: "#16a34a",
    ojoBlanco: "#ffffff",
    ojoPupila: "#000000",
    coches: ["#ef4444", "#facc15", "#3b82f6", "#f472b6"],
    camionCarga: "#9ca3af",
    camionCabina: "#4b5563",
    cristal: "rgba(255, 255, 255, 0.55)",
    rueda: "#111111",
    barraFondo: "rgba(255, 255, 255, 0.15)",
    tiempoAlto: "#4ade80",
    tiempoMedio: "#facc15",
    tiempoBajo: "#ef4444",
    texto: "#ffffff",
    veloGameOver: "rgba(0, 0, 0, 0.7)",
    brillo: 0,
    fuenteHud: "bold 16px monospace",
    fuenteTitulo: "bold 64px monospace",
    fuenteSub: "bold 32px monospace",
  },
  neon: {
    fondo: "#05030f",
    meta: "#0b0620",
    boca: "#00ff88",
    bocaBorde: "#f5ff00",
    rio: "#07052e",
    rioOla: "#00f5ff",
    segura: "#0f0a2e",
    carretera: "#05010f",
    linea: "rgba(255, 0, 110, 0.5)",
    tronco: "#ff006e",
    troncoVeta: "#5c0027",
    tortuga: "#00ff88",
    tortugaOscura: "#007a42",
    rana: "#f5ff00",
    ranaOscura: "#a8b000",
    ojoBlanco: "#ffffff",
    ojoPupila: "#ff006e",
    coches: ["#ff006e", "#f5ff00", "#00f5ff", "#b967ff"],
    camionCarga: "#6b5bff",
    camionCabina: "#00f5ff",
    cristal: "rgba(255, 255, 255, 0.7)",
    rueda: "#000000",
    barraFondo: "rgba(0, 245, 255, 0.15)",
    tiempoAlto: "#00ff88",
    tiempoMedio: "#f5ff00",
    tiempoBajo: "#ff006e",
    texto: "#00ff88",
    veloGameOver: "rgba(5, 1, 15, 0.78)",
    brillo: 10,
    fuenteHud: "bold 16px monospace",
    fuenteTitulo: "bold 64px monospace",
    fuenteSub: "bold 32px monospace",
  },
  retro: {
    fondo: "#0a140a",
    meta: "#143014",
    boca: "#20b020",
    bocaBorde: "#33ff33",
    rio: "#0d1a0d",
    rioOla: "#20b020",
    segura: "#143014",
    carretera: "#0a140a",
    linea: "#20b020",
    tronco: "#20b020",
    troncoVeta: "#0a140a",
    tortuga: "#33ff33",
    tortugaOscura: "#0a140a",
    rana: "#33ff33",
    ranaOscura: "#20b020",
    ojoBlanco: "#0a140a",
    ojoPupila: "#33ff33",
    coches: ["#33ff33", "#20b020", "#33ff33", "#20b020"],
    camionCarga: "#20b020",
    camionCabina: "#33ff33",
    cristal: "#0a140a",
    rueda: "#143014",
    barraFondo: "#143014",
    tiempoAlto: "#33ff33",
    tiempoMedio: "#20b020",
    tiempoBajo: "#ffb000",
    texto: "#33ff33",
    veloGameOver: "rgba(10, 20, 10, 0.9)",
    brillo: 0,
    // Getters: la familia pixel solo se conoce en el navegador, al leer la fuente.
    get fuenteHud() {
      return `12px ${resolverFuentePixel()}`;
    },
    get fuenteTitulo() {
      return `36px ${resolverFuentePixel()}`;
    },
    get fuenteSub() {
      return `18px ${resolverFuentePixel()}`;
    },
  },
};

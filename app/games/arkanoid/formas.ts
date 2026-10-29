// Formas vectoriales de las skins `neon` y `retro` de Arkanoid. Lógica pura: no accede a
// `document`. Cada figura ocupa el mismo rectángulo que el sprite al que sustituye, así
// que la skin no cambia colisiones ni jugabilidad. El contexto y la paleta llegan por parámetro.
import type { ColorBloque } from "./levels";
import type { PaletaFormas } from "./paletas";
const ALFA_RELLENO_NEON = 0.25;
const ALFA_EXPLOSION = [1, 0.66, 0.33, 0.1]; // por fotograma; el último (3) es el más tenue
const EXPANSION_EXPLOSION = 2; // px por lado y fotograma (neon)
const CUADRADO_EXPLOSION = 6; // px (retro)
const DESPLAZAMIENTO_EXPLOSION = 2; // px por fotograma (retro)
const TAPA_PALETA = 4; // px a cada extremo (retro)
const MARCO_BLOQUE = 2; // px (retro)
// Activa el brillo con el color de la forma; sin brillo no toca `shadowBlur`.
function conBrillo(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
): void {
  if (blur <= 0) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function esNeon(p: PaletaFormas): boolean {
  return p.brillo > 0;
}
export function dibujarBloque(
  ctx: CanvasRenderingContext2D,
  p: PaletaFormas,
  color: ColorBloque,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const c = p.bloques[color];
  ctx.save();
  if (esNeon(p)) {
    ctx.globalAlpha = ALFA_RELLENO_NEON;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    conBrillo(ctx, c, p.brillo);
    ctx.strokeStyle = c;
    ctx.lineWidth = p.grosor;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  } else {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = p.bloqueBorde;
    ctx.lineWidth = MARCO_BLOQUE;
    ctx.strokeRect(
      x + MARCO_BLOQUE / 2,
      y + MARCO_BLOQUE / 2,
      w - MARCO_BLOQUE,
      h - MARCO_BLOQUE,
    );
  }
  ctx.restore();
}
export function dibujarPaleta(
  ctx: CanvasRenderingContext2D,
  p: PaletaFormas,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  conBrillo(ctx, p.paleta, p.brillo);
  ctx.fillStyle = p.paleta;
  ctx.fillRect(x, y, w, h);
  if (esNeon(p)) {
    ctx.strokeStyle = p.paletaBorde;
    ctx.lineWidth = p.grosor;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  } else {
    ctx.fillStyle = p.paletaBorde;
    ctx.fillRect(x, y, TAPA_PALETA, h);
    ctx.fillRect(x + w - TAPA_PALETA, y, TAPA_PALETA, h);
  }
  ctx.restore();
}
export function dibujarPelota(
  ctx: CanvasRenderingContext2D,
  p: PaletaFormas,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  conBrillo(ctx, p.pelota, p.brillo);
  ctx.fillStyle = p.pelota;
  if (esNeon(p)) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const lado = Math.min(w, h) * 0.75;
    ctx.fillRect(x + (w - lado) / 2, y + (h - lado) / 2, lado, lado);
  }
  ctx.restore();
}
// `frame` va de 0 a 3, igual que el índice de EXPLOSION_FRAMES.
export function dibujarExplosion(
  ctx: CanvasRenderingContext2D,
  p: PaletaFormas,
  color: ColorBloque,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const c = p.bloques[color];
  ctx.save();
  if (esNeon(p)) {
    const e = frame * EXPANSION_EXPLOSION;
    ctx.globalAlpha = ALFA_EXPLOSION[frame];
    conBrillo(ctx, c, p.brillo / 2);
    ctx.strokeStyle = c;
    ctx.lineWidth = p.grosor;
    ctx.strokeRect(x - e, y - e, w + e * 2, h + e * 2);
  } else if (frame < 3) {
    const d = frame * DESPLAZAMIENTO_EXPLOSION;
    const s = CUADRADO_EXPLOSION;
    ctx.fillStyle = c;
    ctx.fillRect(x - d, y - d, s, s);
    ctx.fillRect(x + w - s + d, y - d, s, s);
    ctx.fillRect(x - d, y + h - s + d, s, s);
    ctx.fillRect(x + w - s + d, y + h - s + d, s, s);
  }
  ctx.restore();
}

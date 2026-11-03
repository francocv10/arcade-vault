# SPEC 03 (game-jam boxeo-pixel) — Extras de BOXEO PIXEL: sonido y efectos de impacto

> **Status:** Borrador
> **Depends on:** SPEC 01 de game-jam boxeo-pixel (motor), SPEC 02 de game-jam boxeo-pixel (ranking; no es imprescindible, pero conviene implementarlo antes)
> **Date:** 2026-11-03
> **Objective:** Dar a BOXEO PIXEL sonido sintetizado con WebAudio y efectos de impacto (parada de imagen, temblor, partículas y público animado) sin cambiar las reglas ni el contrato con React.

---

## Por qué existe este spec

La SPEC 01 deja el juego completo pero mudo y sin «jugo»: un golpe conectado apenas se nota. Los extras se separan para no engordar el spec del motor y porque dependen de decisiones de sensación de juego que conviene probar con el juego ya jugable. Este spec es un **borrador de alcance**: fija qué entra, las decisiones por defecto y los criterios mínimos; el detalle técnico (números exactos de partículas, forma de onda de cada sonido) se cierra al revisarlo.

---

## Alcance

**In (propuesto):**

- Sonido con WebAudio, sin ficheros de audio ni `public/` (como la preferencia de las specs sin assets): golpe de jab, golpe de gancho, golpe bloqueado, golpe al aire, campana de inicio y de final de ronda, derribo con cuenta (un tic por segundo), KO y fanfarria de victoria.
- Efectos de impacto en el canvas: parada de imagen (hit-stop) de 60 ms en jab y 100 ms en gancho, temblor de pantalla de 6 px que decae en 150 ms con el gancho, partículas de impacto (8 por golpe, 16 con contragolpe), texto flotante de puntos («+30») que sube y se desvanece en 600 ms y destello blanco de un fotograma.
- Público de fondo animado: siluetas que se balancean y saltan en el KO y en el derribo.
- Botón `SONIDO: SÍ/NO` en `GamePlayer` solo para `boxeo-pixel`, con la elección guardada en `localStorage` (clave `av-boxeo-pixel-sonido`, por defecto `SÍ`), que activa o silencia el motor mediante un método nuevo `setSonido(activo)`.
- El `AudioContext` se crea o se reanuda solo tras el primer gesto del usuario (JUGAR o la primera tecla) para cumplir la política de autoplay del navegador.

**Out of scope:**

- Música de fondo.
- Cambios de reglas, daño, tiempos o rivales.
- Skins `clasico`/`neon`/`retro` (las escribe `skin-designer`).
- Sprites o ficheros de audio externos.
- Cuenta de 10 y levantadas del rival, esquivas y uppercut.
- Cambios en el ranking o en la base de datos.

---

## Modelo de datos

Sin tablas ni migraciones. Cambios de contrato mínimos:

```ts
// app/games/boxeo-pixel/types.ts (añade un método; el snapshot no cambia)
export interface JuegoBoxeo {
  pause(): void;
  resume(): void;
  restart(): void;
  setSonido(activo: boolean): void; // no-op tras destroy()
  destroy(): void;
}
```

Módulos nuevos de `app/games/boxeo-pixel/` (el audio vive fuera de la lógica pura):

- `sonido.ts`: `crearSonido()` devuelve `{ reproducir(nombre), setActivo(activo), destruir() }`; crea el `AudioContext` de forma diferida y cierra el contexto en `destruir()`.
- `efectos.ts`: lógica pura de partículas, temblor, hit-stop y texto flotante (recibe el estado por parámetro).

---

## Plan de implementación (esbozo)

1. `sonido.ts` con los sonidos como osciladores y ruido filtrado; el motor llama a `reproducir` en los eventos de combate.
2. `efectos.ts` y su integración en `draw.ts` y en el bucle (el hit-stop congela la lógica durante 60 a 100 ms sin parar el dibujo).
3. Público animado en `draw.ts`.
4. `setSonido` en el motor y botón `SONIDO` en `GamePlayer` con `localStorage`.
5. Documentar en `CLAUDE.md`.

Cada paso se verifica con `npx tsc --noEmit`, `npm run lint` y Playwright; al terminar, `perf-auditor medir boxeo-pixel` confirma ≥ 55 fps en escritorio y ≥ 30 fps en móvil.

---

## Criterios de aceptación (mínimos)

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores y no se añade ningún archivo a `public/`.
- [ ] Cada golpe conectado, bloqueado o fallado, la campana de ronda, el derribo, el KO y la victoria producen un sonido distinto; ninguno suena con `SONIDO: NO`.
- [ ] El `AudioContext` no se crea antes del primer gesto del usuario ni quedan contextos abiertos tras salir de la partida.
- [ ] El hit-stop (60 ms jab, 100 ms gancho) no cambia el resultado de ninguna regla de la SPEC 01 ni el tiempo de reloj de ronda más de 100 ms por golpe.
- [ ] El texto flotante muestra los puntos reales sumados (`+10`, `+30`, o el doble en contragolpe) y desaparece en 600 ms.
- [ ] El botón `SONIDO: SÍ/NO` recuerda la elección tras recargar (`av-boxeo-pixel-sonido`) y no cambia el foco del juego.
- [ ] El motor no llama a `onChange` por fotograma y `GamePlayer` no se vuelve a renderizar por los efectos.
- [ ] Con pausa, el audio en curso se detiene y las partículas se congelan.
- [ ] En escritorio la partida se mantiene en ≥ 55 fps y en móvil con CPU 4× en ≥ 30 fps.

---

## Decisiones

**Definición rápida sin aclaraciones detalladas.** Decisiones por defecto del agente `game-jam`, sin posibilidad de preguntar al usuario.

- **Sí:** sonido sintetizado con WebAudio. **No:** ficheros `.mp3` ni `public/games/boxeo-pixel/`; evita assets y licencias.
- **Sí:** botón `SONIDO: SÍ/NO` con `localStorage`, por defecto activado. **No:** música de fondo.
- **Sí:** hit-stop y temblor limitados a 60/100 ms y 6 px para no estorbar a la lectura del combate.
- **Sí:** el público animado es de siluetas simples. **No:** sprites.
- **Sí:** las skins se piden aparte a `skin-designer` cuando el juego esté implementado.
- **Sí:** este spec queda en `Borrador` hasta que la SPEC 01 esté implementada y se pruebe la sensación de juego.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La política de autoplay bloquea el audio | `AudioContext` diferido y reanudado en el primer gesto |
| El sonido sigue tras salir de la partida | `destruir()` cierra el contexto y se llama desde `destroy()` |
| El hit-stop altera el balance del combate | No cambia la lógica de reglas, solo congela el tiempo unos milisegundos; criterio de aceptación |
| Más dibujo por fotograma baja los fps | Partículas con tope (máx. 64 vivas), sin `shadowBlur` ni `mix-blend-mode`; medición con `perf-auditor` |

---

## Qué **no** está en este spec

- Música, skins, cambios de reglas, sprites o audios externos.
- Cuenta de 10, esquivas, uppercut, dos jugadores y selección de rival.
- Cambios en el ranking y en la base de datos.
- Tests automatizados.

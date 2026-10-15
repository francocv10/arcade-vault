# SPEC 02 — Home page (landing) de Arcade Vault

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-10-14
> **Objective:** Implementar en `app/home` la landing del template `references/templates/home-about/` (sin la pantalla "Acerca de"), con sus animaciones, y mover la Biblioteca a `/biblioteca`.

---

## Por qué existe este spec

SPEC 01 dejó la Biblioteca en `/` y no tiene portada. El template `home-about` añade una landing (hero, beneficios, vista previa de juegos, estadísticas, actividad en vivo, precios y CTA final) que debe ser la puerta de entrada. Eso obliga a mover la Biblioteca de ruta y a actualizar los enlaces que apuntaban a `/`.

---

## Alcance

**In:**

- Página `/home` en `app/home/page.tsx`, con las siete secciones del template:
  1. **Hero:** eyebrow "▸ INSERTA UNA MONEDA_", título de tres líneas, subtítulo, CTA "▶ EXPLORAR JUEGOS" (→ `/biblioteca`) y "✦ CREAR CUENTA" (→ `/acceso`), indicador "DESLIZA ▼".
  2. **// 01 ¿POR QUÉ ARCADE VAULT?:** 4 tarjetas de beneficios con icono pixel (GAMEPAD, FREE, TROPHY, ROCKET).
  3. **// 02 JUEGOS DISPONIBLES AHORA:** 6 mini-tarjetas (los 6 primeros de `GAMES`) que enlazan a `/juegos/<id>`, y botón "VER TODOS LOS JUEGOS →" (→ `/biblioteca`).
  4. **Estadísticas:** 3 bloques (`12+ JUEGOS`, `MILES DE PARTIDAS`, `GLOBAL RANKING`).
  5. **// 03 ACTIVIDAD EN VIVO:** lista "ÚLTIMAS PUNTUACIONES" (7 filas) y "TOP JUGADORES · HOY" (5 filas con barra), con enlace "VER SALÓN →" (→ `/salon`).
  6. **// 04 PRECIOS:** tarjeta "JUGADOR VAULT $0 / SIEMPRE" con lista de 6 ventajas, botón "EMPEZAR GRATIS →" (→ `/acceso`), sello "FREE PLAY" y 3 preguntas frecuentes.
  7. **CTA final:** "¿LISTO PARA JUGAR?" con botón "INSERTAR MONEDA →" (→ `/biblioteca`).
- Animaciones del template:
  - **Siluetas flotantes** en el hero: 8 SVG pixel (`s1`–`s8`: invader, fantasma, nave, mira, UFO, moneda, corazón, D-pad) con la animación `float`.
  - **Reveal al hacer scroll:** las secciones con clase `reveal` entran con fade + translateY al cruzar el 12 % de visibilidad (`IntersectionObserver`), con `transition-delay` escalonado en tarjetas de beneficios (80 ms por tarjeta) y bloques de estadísticas (90 ms).
  - **Ticker:** las filas de "ÚLTIMAS PUNTUACIONES" entran con `tickin` escalonado (60 ms por fila).
  - **Hero:** `flicker` en el título, `blink` en el cursor `_`, `pulse` en los botones principales, `bounce` en la flecha "DESLIZA".
  - **Entrada de pantalla:** `fade-in` en el contenedor `.home`.
- Portar a `app/globals.css` los estilos del Home que faltan (`.home-*`, `.silo`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.tick-*`, `.top-*`, `.price-*`, `.faq-*`, `.home-final`, `.reveal`, keyframes `float`, `bounce`, `tickin`) copiados de `references/templates/home-about/styles.css`. Se excluye todo el CSS de "Acerca de" (`.highlight-row`, `.contact-grid` y similares).
- Mover la Biblioteca de `/` a `/biblioteca` (`app/biblioteca/page.tsx`). `app/page.tsx` pasa a redirigir a `/home`.
- Barra de navegación: nuevo enlace **Inicio** (→ `/home`) antes de Biblioteca, en la barra y en el panel móvil. El logo apunta a `/home`. "Acerca de" no se añade.
- Actualizar los enlaces de SPEC 01 que apuntaban a `/` como Biblioteca (ver plan, paso 5).
- Datos ficticios del Home en `app/data/home.ts`, re-exportados desde `app/data/index.ts`.
- Responsive: mismos breakpoints del template (980, 900, 720, 600, 520 px). A 390 px no hay scroll horizontal.
- `prefers-reduced-motion: reduce` desactiva `float`, `bounce`, `tickin`, `flicker`, `pulse`, `blink` y la transición de `reveal` (el contenido se muestra visible de inmediato).

**Out of scope (para futuros specs):**

- La pantalla "Acerca de" (`about.jsx`), su enlace en la navegación y cualquier ruta `/acerca`.
- Datos reales: las puntuaciones recientes, el top del día y las estadísticas son ficticios y estáticos; no se actualizan ni se conectan a `av_scores`.
- Sistema de créditos funcional (el contador `CRÉDITOS · 03` sigue decorativo).
- Cambios al diseño visual del template.
- Juegos reales, base de datos, autenticación real.
- Tests automatizados.
- Reescribir el `Arcade Vault.html` de SPEC 01 o sus pantallas, salvo los enlaces indicados en el plan.

---

## Modelo de datos

Nuevo archivo `app/data/home.ts`, re-exportado con `export * from "./home"` en `app/data/index.ts`. Los componentes importan desde `@/app/data`.

```ts
import type { ColorBoton } from "./games";

export interface EstadisticaHome {
  n: string;   // "12+", "MILES", "GLOBAL"
  u: string;   // "JUEGOS", "DE PARTIDAS", "RANKING"
  s: string;   // "Y CONTANDO", ...
}

export interface ActividadReciente {
  p: string;           // jugador, p. ej. "NEONFOX"
  g: string;           // nombre del juego, p. ej. "Caída"
  s: number;           // puntos
  t: string;           // "hace 2 min"
  c: ColorBoton;       // color neón del jugador
}

export interface TopJugadorHoy {
  r: number;           // posición 1..5
  p: string;
  s: number;
}
```

Exports:

- `HOME_STATS: EstadisticaHome[]` (3 elementos).
- `RECENT_ACTIVITY: ActividadReciente[]` (7 elementos, los del template).
- `TOP_TODAY: TopJugadorHoy[]` (5 elementos, los del template).

Reutiliza `GAMES` de SPEC 01 para la vista previa de juegos (`GAMES.slice(0, 6)`).

Los textos de marketing (títulos, beneficios, precios y FAQ) son contenido de la página y viven en `app/home/page.tsx`, no en `app/data/`.

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`.
- La barra de cada fila del top mide `100 - i * 16` %, como en el template.
- Los textos de la UI están en español.

---

## Plan de implementación

Antes de escribir código de Next.js hay que leer la guía relevante en `node_modules/next/dist/docs/` (exigido por `AGENTS.md`), en particular `redirect` y `Link`. Para el diseño visual se usa `/frontend-design`, respetando el template.

1. Crear `app/data/home.ts` con los tipos y los tres exports, y re-exportarlo en `app/data/index.ts`. Verificación: `npm run build` compila sin errores de tipos.
2. Portar a `app/globals.css` los estilos del Home y los keyframes `float`, `bounce` y `tickin` desde `references/templates/home-about/styles.css`, y añadir al bloque `@media (prefers-reduced-motion: reduce)` existente las animaciones nuevas y el estado visible de `.reveal`. Verificación: `npm run build` sigue pasando y las pantallas de SPEC 01 no cambian.
3. Crear los componentes del Home:
   - `app/components/home-silhouettes.tsx` (server): las 8 siluetas SVG con `aria-hidden="true"`.
   - `app/components/home-feature-icon.tsx` (server): los 4 iconos pixel.
   - `app/components/mini-card.tsx` (server): mini-tarjeta con `Link` a `/juegos/<id>`.
   - `app/components/reveal-observer.tsx` (client): `IntersectionObserver` que añade la clase `in` a los `.reveal` visibles y se desconecta al desmontar.
4. Crear `app/home/page.tsx` (server) con las siete secciones, los CTA como `Link` con clases `btn`, el `<RevealObserver />` y `metadata` estática (título y descripción propios). Verificación: abrir `/home` y ver la landing completa con animaciones.
5. Mover la Biblioteca: crear `app/biblioteca/page.tsx` (con `<Library />` y `metadata` propia) y reemplazar `app/page.tsx` por `redirect("/home")`. Actualizar los enlaces a la Biblioteca: `app/juegos/[id]/page.tsx:69`, `app/components/game-player.tsx:143` y `app/components/hall-of-fame.tsx:118` pasan de `/` a `/biblioteca`; las redirecciones de `app/components/auth-form.tsx:19` y `:24` pasan de `/` a `/home`. Verificación: `/` redirige a `/home` y los botones "VOLVER AL VAULT" llevan a `/biblioteca`.
6. Actualizar `app/components/nav.tsx`: enlace **Inicio** (→ `/home`) en barra y panel móvil, logo → `/home`, "Biblioteca" → `/biblioteca` y activo en `/biblioteca` y `/juegos/*`, "Inicio" activo en `/home`. Verificación: el estado activo cambia correctamente en cada ruta.
7. Revisión final: `npm run lint` y `npm run build`, y comprobación visual a 1440 px y 390 px comparando con el template.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/home` existe, se sirve desde `app/home/page.tsx` y muestra el hero con el título "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA".
- [ ] `/` redirige a `/home`.
- [ ] `/biblioteca` muestra la Biblioteca de SPEC 01 con sus 8 tarjetas, buscador y 5 chips.
- [ ] No existe la ruta `/acerca` ni ningún enlace o texto "Acerca de" en la barra o el panel móvil.
- [ ] La barra muestra, en orden, "Inicio", "Biblioteca" y "Salón de la Fama"; "Inicio" está activo en `/home` y "Biblioteca" en `/biblioteca`, `/juegos/*` y `/juegos/*/jugar`.
- [ ] El logo lleva a `/home`.
- [ ] "▶ EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" llevan a `/biblioteca`.
- [ ] "✦ CREAR CUENTA" y "EMPEZAR GRATIS →" llevan a `/acceso`.
- [ ] "VER SALÓN →" lleva a `/salon`.
- [ ] La sección 02 muestra exactamente 6 mini-tarjetas (BLOQUE BUSTER, CAÍDA, SERPENTINA, GLOTÓN, INVASORES, ROCAS) y cada una navega a `/juegos/<id>`.
- [ ] La sección 01 muestra 4 tarjetas de beneficios con icono; las estadísticas muestran "12+", "MILES" y "GLOBAL".
- [ ] "ÚLTIMAS PUNTUACIONES" muestra 7 filas y "TOP JUGADORES · HOY" muestra 5, con las 3 primeras destacadas y puntos formateados con separador de miles (`312.840`).
- [ ] La sección PRECIOS muestra "$0 / SIEMPRE", 6 ventajas y 3 preguntas frecuentes.
- [ ] El hero muestra 8 siluetas pixel flotando (animación `float` activa) y el título con `flicker`.
- [ ] Al hacer scroll, cada sección con `.reveal` pasa de invisible a visible (clase `in`) una sola vez, y las tarjetas de beneficios aparecen escalonadas.
- [ ] Las filas de "ÚLTIMAS PUNTUACIONES" entran escalonadas con `tickin`.
- [ ] Con `prefers-reduced-motion: reduce`, las siluetas, la flecha "DESLIZA", el ticker, el título y el cursor quedan estáticos y todas las secciones se ven sin esperar al scroll.
- [ ] En `/home` los botones y tarjetas son navegables con teclado y las siluetas decorativas tienen `aria-hidden="true"`.
- [ ] A 390 px de ancho `/home` no tiene scroll horizontal y las rejillas colapsan a una columna (beneficios, estadísticas, actividad y precios).
- [ ] Los botones "VOLVER AL VAULT" del detalle, del reproductor y del salón llevan a `/biblioteca`.
- [ ] Tras iniciar sesión o entrar como invitado en `/acceso`, la redirección termina en `/home`.
- [ ] Las pantallas de SPEC 01 (`/biblioteca`, `/juegos/*`, `/acceso`, `/salon`) conservan su aspecto y comportamiento.
- [ ] Los datos de actividad, top y estadísticas se importan solo desde `@/app/data`; ningún componente los define.

---

## Decisiones

- **Sí:** `/home` como ruta real en `app/home/page.tsx`, tal como se pidió.
- **Sí:** `/` redirige a `/home` y la Biblioteca pasa a `/biblioteca`. Replica el flujo del template (landing → biblioteca) y evita dos URLs para la misma pantalla.
- **No:** mantener la Biblioteca en `/` y añadir `/home` aparte. Dejaría la portada fuera del camino natural del usuario.
- **No:** mostrar el Home directamente en `/`. Duplicaría contenido y URLs.
- **Sí:** enlace "Inicio" en la navegación, como en el template. "Acerca de" queda fuera por petición expresa.
- **Sí:** datos de actividad, top y estadísticas en `app/data/home.ts`. Mantiene la regla de SPEC 01: una sola capa de datos ficticios, la que se sustituirá por base de datos.
- **Sí:** textos de marketing (beneficios, precios, FAQ) inline en la página. Son copy, no datos; no hay razón para sustituirlos por una capa de datos.
- **Sí:** copiar todas las secciones del template tal cual, incluida PRECIOS, con los textos en español sin cambios. El copy se considera provisional.
- **Sí:** el Home es un Server Component; solo `RevealObserver` es client. No hay estado ni `localStorage` en esta página.
- **Sí:** `reveal` con `IntersectionObserver` en un componente cliente mínimo, como en el template (`useReveal`), sin librerías de animación.
- **Sí:** siluetas SVG inline copiadas del template, sin assets externos ni canvas.
- **Sí:** respetar `prefers-reduced-motion` y mostrar el contenido `reveal` de inmediato en ese modo, igual que en SPEC 01.
- **Sí:** las redirecciones tras iniciar sesión van a `/home` (portada) y no a `/biblioteca`. Esto reemplaza el criterio de SPEC 01 que decía "redirige a `/`".
- **Sí:** SPEC 01 no se edita; las rutas que cambia este spec (`/` → `/home`, Biblioteca → `/biblioteca`) prevalecen sobre sus criterios.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cambiar la Biblioteca de `/` rompe enlaces internos | El plan lista cada enlace afectado (paso 5); se puede comprobar con una búsqueda de `href="/"` y `push("/")` en `app/`. |
| Con `cacheComponents: true`, `redirect()` en `app/page.tsx` puede comportarse distinto a versiones anteriores | Leer la guía de `redirect` en `node_modules/next/dist/docs/` y verificar con `curl -I /` o el navegador antes de seguir. |
| Contenido `reveal` queda invisible si el observer no corre (JS desactivado o error) | Aceptado: el sitio ya requiere JS. En `prefers-reduced-motion` se muestra siempre. |
| `.reveal` oculta secciones ya visibles al volver a la página | `RevealObserver` se monta con la página y observa de nuevo al montarse; se comprueba navegando `/home` → `/biblioteca` → atrás. |
| Estilos portados chocan con los de SPEC 01 (mismos nombres como `fadeIn`) | Solo se copian reglas y keyframes que no existan en `globals.css`; los duplicados se omiten. |
| Muchas animaciones continuas (8 siluetas con `float`) afectan el rendimiento móvil | Solo CSS (transform/opacity) y `will-change` ausente; se respeta `prefers-reduced-motion`. |
| Las siluetas desbordan el ancho en móvil y generan scroll horizontal | El contenedor `.home-hero` mantiene `overflow: hidden`, como en el template; se verifica a 390 px. |

---

## Qué **no** está en este spec

- La pantalla "Acerca de" ni su enlace.
- Datos reales o en vivo para actividad, top y estadísticas.
- Créditos funcionales.
- Backend, base de datos o autenticación real.
- Juegos reales.
- Rediseño del template.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.

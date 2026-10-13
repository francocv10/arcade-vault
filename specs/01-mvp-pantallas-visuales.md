# SPEC 01 — MVP visual: pantallas de Arcade Vault

> **Status:** Aprobado
> **Depends on:** Ninguna
> **Date:** 2026-10-13
> **Objective:** Implementar en Next.js las cinco pantallas del template (`references/templates/`) con datos ficticios locales y sin lógica de juegos reales.

---

## Por qué existe este spec

El template en `references/templates/` es un prototipo React 18 con Babel en el navegador, una sola página y navegación por estado y hash. Este spec lo traslada al proyecto real (Next.js 16, App Router, Tailwind v4) con rutas reales. El resultado es el cascarón visual sobre el que se conectarán después los juegos y la base de datos.

---

## Alcance

**In:**

- Cinco pantallas con rutas reales:
  - Biblioteca: `/`
  - Detalle de juego: `/juegos/[id]`
  - Reproductor (placeholder de juego): `/juegos/[id]/jugar`
  - Acceso (iniciar sesión / crear cuenta): `/acceso`
  - Salón de la Fama: `/salon`
- Componentes compartidos: barra de navegación (con panel móvil), footer y tarjeta de juego.
- Carpeta `app/data/` con los datos ficticios, separados por dominio: `games.ts` (juegos y categorías), `scores.ts` (jugadores, puntuaciones y generador con semilla) e `index.ts` que re-exporta todo. Es la capa que más adelante se reemplaza por una base de datos.
- Sesión simulada en cliente: iniciar sesión, cerrar sesión y jugar como invitado.
- Reproductor copiado del template como placeholder: HUD, marco CRT, puntaje simulado, pausa, FIN y modal de guardar puntuación.
- Diseño responsive (breakpoints del `globals.css`: 840px nav, 900px detalle).
- Efectos visuales del prototipo:
  - **Tilt 3D en las cards:** al mover el mouse sobre una `GameCard`, se aplica `translateY(-6px) rotateX(-py*6deg) rotateY(px*8deg)` según la posición del cursor, y se restablece al salir (`.card` ya tiene `transform-style: preserve-3d`).
  - **Animación de enemigos en la arena del reproductor:** `.enemy.e1/.e2/.e3` con `drift` y la nave `.player-ship` con `bob`, ambas ya definidas en `globals.css`.
  - **Scanlines y CRT:** scanlines de página en `.av-bg::after`, y en el reproductor el marco `.crt` con `.crt-screen::before/::after` y el LED "SEÑAL OK".
  - **Fondo animado:** `.av-bg` (rejilla en perspectiva con `gridscroll`, degradados y viñeta) y `.av-noise` (ruido SVG), ya montados en `app/layout.tsx`. El template no tiene un sistema de partículas discretas; este fondo es su equivalente.
  - Otros efectos de CSS del template: `flicker` en el título del hero, `blink` en el cursor, `pulse` en "JUGAR AHORA", `fade-in`/`slide-in` al entrar a pantallas y la animación escalonada (`rise`) de las filas del salón.
  - Con `prefers-reduced-motion: reduce` se desactivan tilt, `gridscroll`, `drift`, `bob`, `flicker`, `pulse` y `blink`.
- Eliminar el contenido scaffold de `app/page.tsx`.

**Out of scope (para futuros specs):**

- Cualquier juego real (lógica, canvas, controles).
- Base de datos, backend o API routes.
- Autenticación real (OAuth con Google/GitHub, hash de contraseñas, sesiones de servidor).
- Mostrar en los rankings las puntuaciones guardadas desde el reproductor.
- Sistema de créditos funcional (el contador `CRÉDITOS · 03` es decorativo).
- Tests automatizados (el proyecto no tiene test runner).
- Rediseño visual: se respeta el template tal cual.
- Sistema de partículas discretas (canvas o elementos flotantes): el template no lo tiene.

---

## Modelo de datos

Los tipos y los datos viven en `app/data/`:

- `app/data/games.ts`: `Categoria`, `ColorBoton`, `Juego`, `GAMES`, `CATS` y `getGame`.
- `app/data/scores.ts`: `PuntuacionRanking`, `PuntuacionGuardada`, `Usuario`, `PLAYERS` y `seededScores`.
- `app/data/index.ts`: re-exporta todo lo anterior (`export * from "./games"` y `export * from "./scores"`). Los componentes importan desde `@/app/data`.

```ts
export type Categoria = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type ColorBoton = "cyan" | "magenta" | "yellow" | "green";

export interface Juego {
  id: string;            // slug de la URL, p. ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: Categoria;
  cover: string;         // clase CSS de globals.css, p. ej. "cover-bricks"
  color: ColorBoton;
  best: number;          // mejor puntuación global
  plays: string;         // "12.4K"
}

export interface PuntuacionRanking {
  rank: number;
  name: string;
  score: number;
  date: string;          // "DD/MM/2026"
}

export interface Usuario {
  name: string;          // mayúsculas, máx. 10 caracteres
}

export interface PuntuacionGuardada {
  game: string;          // Juego.id
  score: number;
  name: string;
  at: number;            // Date.now()
}
```

Exports de `app/data/` (vía `index.ts`):

- `GAMES: Juego[]`: los 8 juegos del template (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`).
- `CATS: ["TODOS", ...Categoria[]]`
- `PLAYERS: string[]`
- `seededScores(seed: number, count?: number): PuntuacionRanking[]`: misma lógica determinista del template.
- `getGame(id: string): Juego | undefined`

Persistencia en `localStorage` (solo cliente, envuelta en `try/catch`):

| Clave | Contenido |
| --- | --- |
| `av_user` | `Usuario` serializado o ausente |
| `av_scores` | `PuntuacionGuardada[]` |

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`.
- La semilla del detalle es `id.length * 17 + 3` y la del salón `id.length * 23 + 7`, como en el template.
- Los textos de la UI están en español.

---

## Plan de implementación

Antes de escribir código de Next.js hay que leer la guía relevante en `node_modules/next/dist/docs/` (exigido por `AGENTS.md`).

1. Crear `app/data/games.ts` (tipos de juego, `GAMES`, `CATS`, `getGame`), `app/data/scores.ts` (tipos de puntuación y usuario, `PLAYERS`, `seededScores`) y `app/data/index.ts` que re-exporta ambos. Verificación: `npm run build` compila sin errores de tipos.
2. Crear `app/components/auth-provider.tsx` (client): contexto con `user`, `login`, `logout` y `saveScore`. Lee `av_user` en `useEffect` para evitar errores de hidratación. Se monta en `app/layout.tsx`.
3. Crear `app/components/nav.tsx` (client) y `app/components/footer.tsx`. Usan `next/link` y `usePathname` para el estado activo, y el panel móvil con hamburguesa. Se montan en `app/layout.tsx` dentro de `.av-root`, con `<main className="av-main">`. Verificación: se ven en `/` con enlaces a `/` y `/salon`.
4. Crear `app/components/game-card.tsx` (client, con tilt 3D vía `ref` y `onMouseMove`/`onMouseLeave`) y `app/components/library.tsx` (client: búsqueda y chips de categoría). Reemplazar `app/page.tsx` por la Biblioteca. Verificación: filtros por texto y categoría, estado "NO HAY RESULTADOS", y el tilt se ve al pasar el mouse sobre una tarjeta.
5. Crear `app/juegos/[id]/page.tsx` (server): detalle con portada, tags, estadísticas, botones y leaderboard top 10. Si el `id` no existe, `notFound()`. Parámetros según el helper `PageProps<"/juegos/[id]">`.
6. Crear `app/components/game-player.tsx` (client) y `app/juegos/[id]/jugar/page.tsx`. Se copia el comportamiento del template: marco CRT con arena animada (enemigos con `drift`, nave con `bob`, suelo en perspectiva), puntaje simulado cada 220 ms, nivel, vidas, pausa, FIN y modal con guardado en `av_scores`. Botones SALIR y VOLVER AL VAULT navegan con `Link` o `useRouter`.
7. Crear `app/acceso/page.tsx` y `app/components/auth-form.tsx` (client): pestañas entrar/crear cuenta, campo de correo solo en "crear cuenta", invitado, botones sociales decorativos. Al enviar llama a `login` y redirige a `/`.
8. Crear `app/salon/page.tsx` y `app/components/hall-of-fame.tsx` (client: pestañas por juego): podio, tabla y fila "TU MEJOR MARCA" solo con sesión. Botón de volver a la biblioteca.
9. Añadir en `app/globals.css` el bloque `@media (prefers-reduced-motion: reduce)` que desactiva las animaciones listadas en el alcance, y comprobar que `.av-bg` y `.av-noise` cubren todas las rutas.
10. Ajustar `metadata` por ruta cuando aplique (`generateMetadata` en el detalle) y limpiar assets del scaffold que ya no se usen. Pasar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/` muestra el hero "ARCADE VAULT", el buscador, los 5 chips (`TODOS`, `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`) y 8 tarjetas de juego.
- [ ] Escribir "glo" en el buscador deja solo la tarjeta GLOTÓN; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Elegir el chip `SHOOTER` muestra exactamente INVASORES y ROCAS.
- [ ] Hacer clic en una tarjeta o en su botón JUGAR navega a `/juegos/<id>`.
- [ ] `/juegos/bloque-buster` muestra título, descripción larga, 4 tags, 3 estadísticas y 10 filas de leaderboard con las 3 primeras destacadas.
- [ ] `/juegos/no-existe` devuelve la página 404.
- [ ] El botón "JUGAR AHORA" lleva a `/juegos/<id>/jugar` y "VOLVER AL VAULT" a `/`.
- [ ] En `/juegos/<id>/jugar` el puntaje sube solo, PAUSA lo detiene y muestra "EN PAUSA", y REANUDAR lo reanuda.
- [ ] El botón FIN abre el modal "FIN DEL JUEGO"; GUARDAR PUNTUACIÓN añade una entrada a `av_scores` en `localStorage` y muestra "PUNTUACIÓN GUARDADA".
- [ ] JUGAR DE NUEVO reinicia puntaje (0), vidas (3) y nivel (01) y cierra el modal.
- [ ] El campo de iniciales del modal convierte a mayúsculas y limita a 10 caracteres.
- [ ] En `/acceso` la pestaña "CREAR CUENTA" muestra el campo de correo y la de "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario de `/acceso` con usuario "kai" guarda `av_user = {"name":"KAI"}`, redirige a `/` y la barra muestra "KAI ▾".
- [ ] Con sesión iniciada, hacer clic en el botón de usuario de la barra cierra la sesión y vuelve a mostrarse "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin guardar `av_user`.
- [ ] Recargar la página con sesión iniciada conserva la sesión y no genera errores de hidratación en consola.
- [ ] `/salon` muestra podio (01, 02, 03), tabla de 12 filas y una pestaña por cada uno de los 8 juegos; cambiar de pestaña cambia los datos.
- [ ] En `/salon` la fila "▸ TU MEJOR MARCA EN <JUEGO>" aparece solo con sesión iniciada.
- [ ] La barra marca como activo "Biblioteca" en `/`, `/juegos/*` y `/juegos/*/jugar`, y "Salón de la Fama" en `/salon`.
- [ ] A 390px de ancho no hay scroll horizontal, la hamburguesa abre el panel lateral con los enlaces y el backdrop lo cierra.
- [ ] Al pasar el mouse sobre una tarjeta de la biblioteca, esta se eleva y se inclina en 3D según la posición del cursor, y vuelve a su posición al salir.
- [ ] Pulsar un botón dentro de una tarjeta no deja la tarjeta inclinada tras navegar de vuelta a `/`.
- [ ] En el reproductor, los 3 enemigos se mueven con `drift` y la nave oscila con `bob`; al pausar el juego el marco CRT sigue visible.
- [ ] El marco CRT del reproductor muestra scanlines, el LED "SEÑAL OK" y la barra inferior con el nombre del juego.
- [ ] En todas las rutas se ve el fondo con la rejilla en perspectiva animada, las scanlines y el ruido, sin bloquear clics (`pointer-events: none`).
- [ ] Con `prefers-reduced-motion: reduce` activado, el tilt, la rejilla, los enemigos, la nave y el parpadeo del hero quedan estáticos.
- [ ] Los datos ficticios solo se importan desde `app/data/` (`@/app/data`); ningún componente define juegos o puntuaciones propios.
- [ ] No queda contenido del scaffold de Create Next App en `app/page.tsx`.

---

## Decisiones

- **Sí:** rutas reales del App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/acceso`, `/salon`). Dan URLs compartibles y encajan con Server Components. Se descarta el patrón hash + estado del template.
- **Sí:** reutilizar los estilos que ya están migrados en `app/globals.css` (clases `av-*`, `btn`, `card`, `crt`, etc.). Se puede revisar o ajustar ese archivo si algo falta.
- **Sí:** Tailwind v4 para todo lo que no esté cubierto por `globals.css` (layout y espaciados nuevos). Mantiene el lenguaje visual del template sin reescribir 950 líneas de CSS.
- **No:** reescribir los estilos del template como utilidades Tailwind. Riesgo de divergir del diseño y mucho trabajo sin valor funcional.
- **Sí:** la carpeta `app/data/` (`games.ts`, `scores.ts` e `index.ts` de re-exportación) como única fuente de datos ficticios, separada por dominio. Es el punto exacto que se sustituirá por la base de datos.
- **Sí:** componentes de servidor por defecto; `"use client"` solo donde hay estado, efectos o `localStorage` (nav, auth, biblioteca, reproductor, salón).
- **Sí:** sesión simulada con `localStorage` (`av_user`) y puntuaciones en `av_scores`, igual que el template. No requiere backend y es descartable.
- **Sí:** el reproductor se copia del template como placeholder. Su zona de arena se sustituirá por cada juego real en specs futuros.
- **No:** mostrar en el Salón de la Fama las puntuaciones de `av_scores`. El template no lo hace y eso corresponde a la capa de persistencia real.
- **No:** backend real ahora. Es una decisión de otro dominio (datos, auth) y merece su propio spec.
- **Sí:** el tilt 3D se implementa con `ref` y estilos inline, como el template, sin librerías. Es un efecto de pocas líneas.
- **No:** añadir partículas discretas al fondo. El template solo trae rejilla, scanlines y ruido; si se quieren partículas, va en otro spec.
- **Sí:** respetar `prefers-reduced-motion`. No está en el template, pero evita malestar con tantas animaciones continuas.
- **Sí:** el nombre de usuario se normaliza a mayúsculas y 10 caracteres, como en el template; si queda vacío se usa `PLAYER1`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Next.js 16 difiere de lo conocido (`params` asíncrono, helpers de tipos globales) | Leer `node_modules/next/dist/docs/` antes de implementar y usar `PageProps<"/juegos/[id]">`. |
| Errores de hidratación al leer `localStorage` durante el render | Leer `av_user` solo en `useEffect` dentro de `AuthProvider`; la UI inicial renderiza el estado "sin sesión". |
| `localStorage` bloqueado (modo privado) | Todo acceso va en `try/catch`; sin persistencia la app sigue funcionando en memoria. |
| Estilos de `globals.css` incompletos respecto al template | Comparar visualmente con `references/templates/Arcade Vault.html` y completar `globals.css` si hace falta. |
| Tilt 3D deja la tarjeta inclinada si se navega con el mouse encima | Limpiar `style.transform` en `onMouseLeave` y al desmontar el componente. |
| Demasiadas animaciones continuas afectan rendimiento en móviles | Fondo y animaciones son solo CSS (transform/opacity); el tilt solo corre en dispositivos con hover. |
| Puntaje simulado con `Math.random()` en el render | Solo se usa dentro de `setInterval` en un efecto, nunca durante el render. |

---

## Qué **no** está en este spec

- Ningún juego real (ni siquiera uno).
- Base de datos, API o autenticación real.
- OAuth con Google o GitHub (los botones son decorativos).
- Puntuaciones guardadas visibles en los rankings.
- Créditos funcionales.
- Tests automatizados.
- Cambios al diseño visual del template.

Cada uno de ellos, si se aborda, va en su propio spec.

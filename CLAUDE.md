# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Proyecto

Arcade Vault: una plataforma para jugar online y competir por la mayor cantidad de puntos. El proyecto sigue Spec Driven Design (`/spec` y `/spec-impl`, usando skills de `Klerith/fernando-skills`); las specs viven en `specs/` y cada una se implementa en su propia rama (`spec-NN-...`).

Specs existentes:

- `01-mvp-pantallas-visuales.md`: pantallas base (biblioteca, salón de la fama, acceso, juegos).
- `02-home-page.md`: página de inicio.
- `03-about-page-contacto-resend.md`: `/about` con formulario de contacto que envía correo real vía Resend (estado: Implementado).
- `04-correcciones-graves-revision-playwright.md`: corrige los 4 errores graves de la revisión con Playwright (fallo de red al enviar el contacto, barra en ≤ 373 px, foco visible en `.btn`, accesibilidad del menú móvil y del modal de fin de juego) (estado: Implementado).
- `05-integracion-supabase.md`: integra Supabase (paquetes, variables de entorno y clientes de navegador y de servidor) sin cambiar la UI ni el comportamiento de sesión y puntuaciones, que siguen en `localStorage` (estado: Implementado).
- `06-juego-asteroides.md`: porta Asteroids a un motor de canvas en TypeScript, lo publica como el juego `asteroides` y lo conecta a `GamePlayer`, que recibe del canvas los puntos, las vidas y el nivel (estado: Implementado).

Las plantillas visuales de referencia están en `references/templates/`.

No hay un test runner configurado.

## Skills
Usa siempre /frontend-design para diseñar interfaces de usuarios.

## Stack y convenciones

- Next.js 16.4 (App Router, `app/` en la raíz del repo, sin `src/`), React 19.3, TypeScript, Tailwind CSS v4 (`@import "tailwindcss"` en `app/globals.css`, tokens de tema vía `@theme inline`; no hay archivo de configuración de Tailwind).
- **Next.js 16 es distinto de versiones anteriores.** `AGENTS.md` exige leer la guía relevante en `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) antes de escribir código de Next.js. Por ejemplo, el layout raíz se tipa con el helper global `LayoutProps<"/">` en lugar de props escritas a mano.
- Alias de rutas: `@/*` apunta a la raíz del repo (p. ej. `@/app/...`).
- Fuentes: Press Start 2P, JetBrains Mono y Courier Prime se cargan con `next/font/google` en `app/layout.tsx` y se exponen como `--font-press-start`, `--font-jetbrains` y `--font-courier-prime`.
- Estilos: casi todo el CSS de la UI (estética arcade/neón) vive en `app/globals.css` con clases propias (`.about-hero`, `.contact-form`, `.reveal`, etc.) y variables CSS (`--cyan`, `--magenta`, `--yellow`, `--green`, `--pixel`, `--mono`...). Los breakpoints de la navegación son: hamburguesa hasta 1199px, barra compacta de 1200 a 1439px y completa desde 1440px.
- Animaciones de entrada: la clase `.reveal` oculta el elemento hasta que `RevealObserver` (`app/components/reveal-observer.tsx`) le añade `.in` al entrar en el viewport. En capturas de página completa las secciones `.reveal` salen vacías si no se hace scroll.

## Estructura de `app/`

- Rutas: `/` (redirige a `/home`), `/home`, `/biblioteca`, `/salon`, `/acceso`, `/about`, `/juegos/[id]` y `/juegos/[id]/jugar`.
- `app/error.tsx`: pantalla "PARTIDA INTERRUMPIDA" para excepciones de render (usa `retry`, no `reset`; `global-error.tsx` no existe).
- `app/components/`: componentes de UI compartidos (nav, footer, formularios, tarjetas, iconos pixel). `use-dialog.ts` es el hook de diálogo modal (foco atrapado, scroll bloqueado, foco devuelto, Escape opcional) que usan el menú móvil y el modal de fin de juego.
- `app/data/`: datos estáticos (`games.ts`, `home.ts`, `scores.ts`, reexportados desde `index.ts`).
- `app/about/`: `page.tsx`, `contact-schema.ts` (validación) y `actions.ts` (Server Action `enviarContacto`).
- `app/games/asteroids/`: motor de Asteroids, el primer juego real. `entities.ts` (nave, balas, asteroides, power-up y partículas, sin acceder a `document`), `game.ts` (`createAsteroidsGame(canvas, onChange)`: teclado, bucle `requestAnimationFrame`, colisiones, HUD y GAME OVER dibujados en el canvas, y `pause`/`resume`/`restart`/`destroy`) y `types.ts` (contrato con React). `onChange` recibe un snapshot (`score`, `lives`, `level`, `status`) solo cuando cambia algún valor, nunca por fotograma. `app/components/asteroids-canvas.tsx` monta el canvas de 800×600 (escalado por CSS para llenar `.crt-screen`) y lo destruye al desmontar; `GamePlayer` lo usa solo cuando `gameId === "asteroides"` y los otros 7 juegos siguen con la maqueta del `setInterval`. El motor escucha el teclado en `window`, ignora `input`/`textarea`/`select` y la pausa, y hace `preventDefault` de flechas y Espacio solo mientras juega.
- `app/lib/supabase/`: fábricas de cliente de Supabase. `client.ts` (`createClient()`, cliente de navegador con `createBrowserClient`) y `server.ts` (`await createClient()`, cliente de servidor con `createServerClient` y las cookies de `next/headers`, para Server Components, Server Actions y Route Handlers). `env.ts` valida las variables y lanza un error que nombra la que falta.

## Supabase

- Proyecto `zlsnmrbgsdxzvpoxlghx`, con su MCP configurado en `.mcp.json`. Por ahora solo está integrada la conexión: no hay tablas, ni auth real, ni `proxy.ts`; `/acceso`, `AuthProvider` y las puntuaciones siguen usando `localStorage` y `app/data/`.
- Variables de entorno públicas (plantilla en `.env.example`, valores reales en `.env.local`): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave `sb_publishable_...`, no la `anon` legacy). `SUPABASE_DB_PASSWORD` es solo para la CLI y la app no la usa. La clave `service_role` y la contraseña de la base de datos nunca llevan prefijo `NEXT_PUBLIC_`.
- Cada `process.env.NEXT_PUBLIC_*` se lee por su nombre literal en `env.ts`: Next solo lo sustituye en el bundle del navegador así, no con `process.env[nombre]`.
- Con `cacheComponents: true`, el cliente de servidor lee `cookies()` y exige un límite `<Suspense>` si se usa en una página; en un Route Handler no hay problema.

## Formulario de contacto (Resend)

- `enviarContacto` en `app/about/actions.ts` valida con `validarContacto`, descarta bots con un campo honeypot (`website`) y envía el correo con Resend. `ContactForm` llama a la acción dentro de un `try/catch` (`enviar`): si la petición falla (red caída, 500) muestra el aviso `[ERR]` y conserva lo escrito en lugar de tumbar la página.
- Variables de entorno requeridas (plantilla en `.env.example`, valores reales en `.env.local`, que no se versiona): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`. Si falta alguna, la acción devuelve un error genérico y lo registra en consola.

## Desarrollo

- Si en `npm run dev` la UI aparece sin estilos (p. ej. SVG gigantes, texto sin centrar) pero `globals.css` está bien, el bundle de CSS de Turbopack quedó obsoleto: detén el servidor, borra `.next/dev` y vuelve a arrancarlo. Lo mismo si una regla recién añadida a `globals.css` no se aplica (comprueba que está en el chunk CSS servido).
- Los `.btn` usan `clip-path` (esquinas cortadas): el `outline` y el `box-shadow` exterior se recortan, por eso el foco visible se dibuja con `::after` en `.btn:focus-visible`.
- Los screenshots de Playwright se guardan en `.playwright-screenshots/`.

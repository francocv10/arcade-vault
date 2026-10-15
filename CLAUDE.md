# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Proyecto

Arcade Vault: una plataforma para jugar online y competir por la mayor cantidad de puntos. El proyecto sigue Spec Driven Design (`/spec` y `/spec-impl`, usando skills de `Klerith/fernando-skills`); las specs viven en `specs/` y cada una se implementa en su propia rama (`spec-NN-...`).

Specs existentes:

- `01-mvp-pantallas-visuales.md`: pantallas base (biblioteca, salón de la fama, acceso, juegos).
- `02-home-page.md`: página de inicio.
- `03-about-page-contacto-resend.md`: `/about` con formulario de contacto que envía correo real vía Resend (estado: Implementado).

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
- `app/components/`: componentes de UI compartidos (nav, footer, formularios, tarjetas, iconos pixel).
- `app/data/`: datos estáticos (`games.ts`, `home.ts`, `scores.ts`, reexportados desde `index.ts`).
- `app/about/`: `page.tsx`, `contact-schema.ts` (validación) y `actions.ts` (Server Action `enviarContacto`).

## Formulario de contacto (Resend)

- `enviarContacto` en `app/about/actions.ts` valida con `validarContacto`, descarta bots con un campo honeypot (`website`) y envía el correo con Resend.
- Variables de entorno requeridas (plantilla en `.env.example`, valores reales en `.env.local`, que no se versiona): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`. Si falta alguna, la acción devuelve un error genérico y lo registra en consola.

## Desarrollo

- Si en `npm run dev` la UI aparece sin estilos (p. ej. SVG gigantes, texto sin centrar) pero `globals.css` está bien, el bundle de CSS de Turbopack quedó obsoleto: detén el servidor, borra `.next/dev` y vuelve a arrancarlo.
- Los screenshots de Playwright se guardan en `.playwright-screenshots/`.

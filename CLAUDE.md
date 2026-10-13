# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Proyecto

Arcade Vault: una plataforma para jugar online y competir por la mayor cantidad de puntos. El README indica que el proyecto sigue Spec Driven Design (`/spec` y `/spec-impl`, usando skills de `Klerith/fernando-skills`). Todavía no existe un directorio `spec/`. El código sigue siendo el scaffold inicial de Create Next App (un solo `app/page.tsx`, metadata por defecto en `app/layout.tsx`).

## Comandos

```bash
npm run dev     # next dev
npm run build   # next build
npm start       # next start (después de compilar)
npm run lint    # eslint (flat config: eslint.config.mjs, eslint-config-next)
```

No hay un test runner configurado.

## Stack y convenciones

- Next.js 16.4 (App Router, `app/` en la raíz del repo, sin `src/`), React 19.3, TypeScript, Tailwind CSS v4 (`@import "tailwindcss"` en `app/globals.css`, tokens de tema vía `@theme inline`; no hay archivo de configuración de Tailwind).
- **Next.js 16 es distinto de versiones anteriores.** `AGENTS.md` exige leer la guía relevante en `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) antes de escribir código de Next.js. Por ejemplo, el layout raíz se tipa con el helper global `LayoutProps<"/">` en lugar de props escritas a mano.
- Alias de rutas: `@/*` apunta a la raíz del repo (p. ej. `@/app/...`).
- Fuentes: Geist y Geist Mono se cargan con `next/font/google` en `app/layout.tsx` y se exponen como `--font-geist-sans` y `--font-geist-mono`. El modo oscuro usa variables CSS con `prefers-color-scheme` en `globals.css`.

# SPEC 05 — Integración de Supabase en la aplicación

> **Status:** Aprobado
> **Depends on:** SPEC 03 (convención de variables de entorno y `.env.example`)
> **Date:** 2026-10-19
> **Objective:** Dejar Supabase integrado en la app Next.js (paquetes, variables de entorno y clientes de navegador y de servidor con la clave pública) sin cambiar ninguna pantalla ni el comportamiento actual de sesión y puntuaciones.

---

## Por qué existe este spec

La app guarda hoy sesión y puntuaciones en `localStorage` (`app/components/auth-provider.tsx`) y los datos salen de `app/data/` (`scores.ts` ya indica "esta capa se sustituirá por una base de datos"). El proyecto de Supabase (`zlsnmrbgsdxzvpoxlghx`) existe, está vacío (sin tablas en `public`) y su MCP ya está configurado en `.mcp.json`. Este spec solo prepara la conexión; el esquema, la autenticación real, las puntuaciones, Realtime y las Edge Functions se abordan en specs posteriores sobre esta base.

---

## Alcance

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno públicas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave `sb_publishable_...`), documentadas en `.env.example` y con sus valores reales en `.env.local` (no versionado).
- Dos fábricas de cliente en `app/lib/supabase/`:
  - `client.ts`: cliente de navegador (`createBrowserClient`).
  - `server.ts`: cliente de servidor (`createServerClient`) para Server Components, Server Actions y Route Handlers, con las cookies de `next/headers`.
- Fallo claro si falta alguna de las dos variables: el error nombra la variable ausente (no un `undefined` críptico dentro de la librería).
- Comprobación de conexión de punta a punta con una ruta temporal que se elimina al terminar (ver plan, paso 5).
- Documentar la integración en `CLAUDE.md` (spec, carpeta `app/lib/supabase/`, variables).

**Out of scope (para futuros specs):**

- Esquema de base de datos: tablas (`profiles`, `scores`, `games`...), RLS, migraciones y semillas. Tampoco se generan tipos TypeScript, porque no hay tablas que tipar.
- Autenticación real con Supabase Auth (correo y contraseña) y OAuth (Google, GitHub). `/acceso`, `AuthForm` y `AuthProvider` no se tocan; los botones GOOGLE y GITHUB siguen sin función.
- `proxy.ts` para refrescar la sesión por cookies: solo hace falta cuando haya auth real.
- Sustituir `localStorage` y `app/data/` por consultas a Supabase, incluida la ruta y las puntuaciones de invitados.
- Realtime y Edge Functions.
- Cualquier cambio visual, de textos o de rutas, y tests automatizados.

---

## Modelo de datos

No introduce estructuras de datos ni tablas. Añade dos variables de entorno públicas (el prefijo `NEXT_PUBLIC_` las incluye en el bundle del navegador; es lo esperado para la clave publishable, que está pensada para ser pública y se protege con RLS):

```
NEXT_PUBLIC_SUPABASE_URL=https://zlsnmrbgsdxzvpoxlghx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

Firma de las fábricas:

```ts
// app/lib/supabase/client.ts
export function createClient(): SupabaseClient;

// app/lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;
```

Convenciones:

- `.env.example` conserva `SUPABASE_DB_PASSWORD` (ya existente, sin uso en la app; es para la CLI) y añade las dos variables nuevas sin valores.
- La clave `service_role` y la contraseña de la base de datos nunca llevan prefijo `NEXT_PUBLIC_` y esta spec no las usa en código.
- El valor de la URL y de la clave se obtienen del proyecto (MCP `get_project_url` y `get_publishable_keys`); no se usa la clave `anon` legacy.

---

## Plan de implementación

Antes de escribir código de Next.js hay que leer en `node_modules/next/dist/docs/` la guía de `cookies` de `next/headers` y la de Cache Components (el proyecto tiene `cacheComponents: true`), según `AGENTS.md`. Para la API de Supabase se consulta su documentación vigente (MCP `search_docs`), en particular la guía de `@supabase/ssr` para Next.js.

1. **Dependencias y variables.** `npm install @supabase/supabase-js @supabase/ssr`; añadir las dos variables a `.env.example` y los valores reales a `.env.local`. Verificación: `npm run build` pasa y `git status` no muestra `.env.local`.
2. **Cliente de navegador.** Crear `app/lib/supabase/client.ts`. Verificación: `npx tsc --noEmit` sin errores.
3. **Cliente de servidor.** Crear `app/lib/supabase/server.ts` con la lectura de cookies de `next/headers` y el manejo de la escritura de cookies desde Server Components. Verificación: `npx tsc --noEmit` y `npm run lint` sin errores.
4. **Error por variables ausentes.** Ambas fábricas lanzan un error que nombra la variable que falta. Verificación: quitar temporalmente una variable y comprobar el mensaje.
5. **Comprobación de conexión.** Crear una ruta temporal (por ejemplo `app/api/supabase-check/route.ts`) que use el cliente de servidor y llame a `supabase.auth.getUser()` y a `supabase.from(...)` o una consulta equivalente contra una tabla inexistente para provocar una respuesta de la API; y una prueba equivalente en el navegador con el cliente de `client.ts`. Verificación: ambas llegan a `zlsnmrbgsdxzvpoxlghx.supabase.co` y la API responde (sin sesión y con error controlado de tabla inexistente, no un fallo de red ni de clave). La ruta temporal se elimina antes del siguiente paso y `git status` lo confirma.
6. **Documentación.** En `CLAUDE.md`: añadir SPEC 05 a la lista de specs, `app/lib/supabase/` a la estructura de `app/` y las dos variables a las de entorno. Verificación: `npm run lint` y `npm run build` sin errores.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] Existen `app/lib/supabase/client.ts` y `app/lib/supabase/server.ts`, cada uno exporta `createClient`.
- [ ] `.env.example` está versionado y lista `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores; `.env.local` no está versionado.
- [ ] El cliente de servidor, desde una ruta temporal, consigue respuesta de la API de Supabase del proyecto (no error de red ni de clave inválida).
- [ ] El cliente de navegador consigue respuesta de la misma API desde el navegador.
- [ ] Sin `NEXT_PUBLIC_SUPABASE_URL` o sin `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, el error indica cuál falta.
- [ ] En `.next/static` no aparece la clave `service_role`, la contraseña de la base de datos ni la clave `anon` legacy; sí puede aparecer la clave publishable.
- [ ] La ruta temporal de comprobación ya no existe en el repositorio.
- [ ] `/acceso`, el menú, el reproductor y el Salón de la Fama se comportan igual que antes: sesión y puntuaciones siguen en `localStorage`, y no hay diferencias en `AuthForm`, `AuthProvider`, `nav.tsx` ni en los estilos (`git diff` limitado a `package.json`, lockfile, `.env.example`, `CLAUDE.md`, `app/lib/supabase/` y el spec).
- [ ] No hay errores nuevos en la consola del navegador en `/home`, `/biblioteca`, `/salon`, `/acceso` y `/about`.

---

## Decisiones

- **Sí:** reducir el alcance a la integración. La idea inicial incluía base de datos, auth real con OAuth, Realtime y Edge Functions; el usuario acotó este spec a integrar Supabase, sin tablas, sin tocar la UI y sin OAuth. El resto va en specs propios.
- **Sí:** no tocar `/acceso`, `AuthForm`, `AuthProvider`, el modo invitado ni las puntuaciones locales. Decisión del usuario: se integrarán más adelante, junto con la ruta de invitados.
- **No:** auth real en este spec. Habría obligado a cambiar el formulario (hoy pide "Usuario", Supabase autentica por correo), lo que contradice "no tocar la UI".
- **No:** esquema, migraciones ni tipos generados. El usuario prefiere definir los esquemas de aplicación más adelante; sin tablas, los tipos quedarían vacíos.
- **Sí:** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como únicas variables públicas, tal como pidió el usuario. **No:** la clave `anon` legacy, que duplicaría configuración.
- **Sí:** dos clientes (navegador y servidor) con `@supabase/ssr`, el patrón oficial para Next.js con cookies. **No:** un único cliente de `supabase-js` global, que no comparte la sesión entre servidor y navegador cuando llegue la auth.
- **No:** `proxy.ts` ahora. Su función es refrescar tokens de sesión y no hay sesión de Supabase todavía; se añade en el spec de auth.
- **Sí:** fallo explícito si faltan las variables, en lugar de dejar que la librería falle con un error poco claro.
- **Sí:** ruta temporal de comprobación que se elimina, como en SPEC 04. **No:** dejar un endpoint de salud público sin que nada lo consuma.
- **Sí:** carpeta `app/lib/supabase/`, coherente con `app/components/` y `app/data/` (la raíz es `app/`, sin `src/`).

---

## Riesgos

| Riesgo                                                                                                                          | Mitigación                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Con `cacheComponents: true`, leer `cookies()` en el cliente de servidor exige un límite `<Suspense>` o falla el prerrenderizado | Leer la guía de Cache Components; el spec no usa el cliente en ninguna página, y la ruta de prueba es un Route Handler dinámico |
| Se confunde la clave publishable con una secreta, o se sube una secreta con `NEXT_PUBLIC_`                                      | Solo se usa la publishable; criterio de aceptación de búsqueda en `.next/static`                                                |
| `.env.local` no se versiona, así que otra persona clonando el repositorio no tiene las claves                                   | `.env.example` documenta las variables y el valor sale del dashboard o del MCP                                                  |
| La API de `@supabase/ssr` cambió respecto al conocimiento previo del modelo                                                     | Consultar la documentación vigente con `search_docs` antes del paso 2                                                           |
| Sin RLS ni tablas, una consulta de prueba mal hecha podría tocar datos                                                          | El proyecto está vacío y la prueba solo usa lecturas                                                                            |

---

## Qué **no** está en este spec

- Esquema de base de datos, RLS, migraciones y tipos generados.
- Autenticación real (correo y contraseña) y OAuth.
- `proxy.ts` y refresco de sesión.
- Migrar puntuaciones, ranking e invitados de `localStorage` y `app/data/` a Supabase.
- Realtime y Edge Functions.
- Cambios de UI y tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.

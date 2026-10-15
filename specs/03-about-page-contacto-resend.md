# SPEC 03 — Página "Sobre nosotros" con formulario de contacto (Resend)

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-14
> **Objective:** Implementar en `/about` la pantalla "Acerca de" + "Contacto" del template `references/templates/home-about/` con un formulario que envía un correo real mediante Resend.

---

## Por qué existe este spec

SPEC 02 dejó fuera la pantalla "Acerca de" (`about.jsx`) y su enlace de navegación. En el template el formulario de contacto solo simula el envío (`setSent(...)`). Aquí se completa la pantalla y se reemplaza la simulación por un envío real con Resend, el primer código de servidor del proyecto con un servicio externo y secretos.

---

## Alcance

**In:**

- Página `/about` en `app/about/page.tsx` con las dos secciones de `about.jsx`:
  1. **ACERCA DE ARCADE VAULT:** kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", párrafo de misión y 3 destacados con icono pixel (HEART magenta, BROWSER cyan, PLANT green), con los textos del template.
  2. **Divisor** animado de 24 píxeles (`aria-hidden="true"`).
  3. **CONTACTO:** kicker "▸ CONTACTO", título "CONTÁCTANOS", subtítulo, 3 tips con LED ("RESPUESTA EN 24-48H", "SUGERENCIAS BIENVENIDAS", "SIN SPAM, JAMÁS") y formulario con NOMBRE, CORREO ELECTRÓNICO, MENSAJE y botón "▶ ENVIAR MENSAJE".
- Enlace de navegación **Sobre nosotros** (→ `/about`) en la barra y en el panel móvil, después de "Salón de la Fama". Se muestra activo en `/about`. El texto es "Sobre nosotros", no "Acerca de" como en el template.
- Los títulos de la página siguen el template ("ACERCA DE ARCADE VAULT"); solo cambia la etiqueta de la navegación.
- Envío con **Server Action** (`app/about/actions.ts`, `"use server"`) y `useActionState` en un componente cliente `ContactForm`.
- Un único correo por envío, hacia el equipo, vía Resend (paquete `resend`): `to` = `CONTACT_TO_EMAIL`, `from` = `CONTACT_FROM_EMAIL`, `replyTo` = correo del visitante, asunto `[Arcade Vault] Mensaje de <nombre>`, cuerpo en texto plano con nombre, correo y mensaje.
- Validación **en el servidor** (la del cliente es solo ayuda) y **honeypot** anti-bots (campo oculto `website`).
- Estados del formulario:
  - **Reposo:** campos vacíos.
  - **Enviando:** botón deshabilitado con texto "ENVIANDO…".
  - **Éxito:** el terminal "VAULT-OS // TERMINAL" del template, con `MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, <NOMBRE>.` y botón "ENVIAR OTRO MENSAJE" que vuelve al formulario vacío. Solo aparece si Resend confirma el envío.
  - **Validación fallida:** el formulario hace `shake` (400 ms) y cada campo inválido muestra su mensaje; se conserva lo escrito.
  - **Error de envío (Resend falla):** aviso de error en estilo terminal ("[ERR] No se pudo enviar el mensaje. Inténtalo de nuevo.") sin perder lo escrito, con el botón de envío activo para reintentar.
- Variables de entorno: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`. Valores de prueba: `CONTACT_TO_EMAIL=f.m.covarrubias96@gmail.com` y `CONTACT_FROM_EMAIL=onboarding@resend.dev`. Se documentan en `.env.example`.
- Portar a `app/globals.css` los estilos de "Acerca de" que faltan (`.about*`, `.highlight*`, `.hl-*`, `.about-divider`, `.div-*`, `.about-contact`, `.contact-*`, `.tip*`, `.terminal-success`, `.term-*`, `textarea` de `.contact-form`, keyframes `shake` y `pxblink`) desde `references/templates/home-about/styles.css`. Se omiten reglas o keyframes que ya existan (`blink`, `.field`, `.kicker`).
- Animaciones del template: `reveal` al hacer scroll en el divisor y en la sección de contacto, `transition-delay` de 80 ms por destacado, parpadeo del divisor (`pxblink`), `caret` parpadeante en el terminal y `fade-in` del contenedor `.about`. Se reutiliza `RevealObserver` de SPEC 02.
- `prefers-reduced-motion: reduce` desactiva `shake`, `pxblink` y el parpadeo del `caret`; las secciones `reveal` se ven de inmediato.
- Responsive con los breakpoints del template; a 390 px no hay scroll horizontal y `highlight-row` y `contact-grid` colapsan a una columna.
- Metadata estática propia de la página.

**Out of scope (para futuros specs):**

- Correo de confirmación al visitante (requiere dominio verificado en Resend).
- Dominio verificado y remitente propio: por ahora se usa `onboarding@resend.dev`, que solo entrega al correo de la cuenta de Resend.
- Rate limiting, CAPTCHA o BotID.
- Guardar los mensajes en base de datos o mostrarlos en un panel.
- Plantillas HTML de correo (React Email); el cuerpo es texto plano.
- Cambiar los textos del template (misión, destacados, tips) o el diseño visual.
- Enlace a `/about` en el footer o en el Home.
- Internacionalización y tests automatizados.

---

## Modelo de datos

No introduce estructuras persistentes. Reutiliza `ColorBoton` de SPEC 01 solo si se necesita para los destacados; en caso contrario, usa `"cyan" | "magenta" | "green"` local.

Tipos nuevos en `app/about/actions.ts` (el archivo `"use server"` solo exporta la acción; el tipo y la validación viven en `app/about/contact-schema.ts`):

```ts
export interface EstadoContacto {
  estado: "inicial" | "exito" | "error";
  nombre?: string;                 // nombre enviado, para el mensaje de éxito
  errores?: Partial<Record<"nombre" | "correo" | "mensaje", string>>;
  valores?: { nombre: string; correo: string; mensaje: string }; // se conserva si falla
  mensajeError?: string;           // error de envío de Resend
}
```

Campos del `FormData`: `nombre`, `correo`, `mensaje`, `website` (honeypot).

Reglas de validación (servidor):

- `nombre`: obligatorio tras `trim()`, máximo 80 caracteres.
- `correo`: obligatorio, formato de correo válido, máximo 254 caracteres.
- `mensaje`: obligatorio tras `trim()`, entre 10 y 2000 caracteres.
- `website`: si viene con contenido, la acción devuelve `estado: "exito"` sin llamar a Resend (el bot no recibe señal de rechazo).
- Se eliminan saltos de línea del `nombre` antes de usarlo en el asunto (evita inyección de cabeceras).

Variables de entorno (solo servidor, sin prefijo `NEXT_PUBLIC_`):

```
RESEND_API_KEY=re_xxxxxxxx
CONTACT_TO_EMAIL=f.m.covarrubias96@gmail.com
CONTACT_FROM_EMAIL=onboarding@resend.dev
```

Convenciones:

- Los textos de la UI y los mensajes de error están en español.
- Si falta alguna variable de entorno, la acción devuelve `estado: "error"` y registra el motivo en el log del servidor; nunca lo expone al cliente.

---

## Plan de implementación

Antes de escribir código de Next.js hay que leer la guía relevante en `node_modules/next/dist/docs/` (exigido por `AGENTS.md`), en particular Server Actions/`"use server"` y formularios con `useActionState`. Para la interfaz se usa `/frontend-design`, respetando el template. Para la API de Resend se consulta su documentación vigente.

1. Instalar `resend` (`npm install resend`), crear `.env.example` con las tres variables y añadir `!.env.example` a `.gitignore` (hoy `.env*` lo ignora). Verificación: `npm run build` pasa.
2. Portar a `app/globals.css` los estilos de "Acerca de" y los keyframes `shake` y `pxblink`, y añadir las animaciones nuevas al bloque `@media (prefers-reduced-motion: reduce)`. Verificación: `npm run build` pasa y las pantallas de SPEC 01 y 02 no cambian.
3. Crear `app/about/contact-schema.ts` con `EstadoContacto` y la función de validación pura. Verificación: `npm run build` compila sin errores de tipos.
4. Crear `app/about/actions.ts` con la Server Action `enviarContacto(prev, formData)`: honeypot, validación, envío con `resend.emails.send` y mapeo de errores a `EstadoContacto`. Verificación: con `RESEND_API_KEY` válido en `.env.local`, un envío de prueba llega a `f.m.covarrubias96@gmail.com`.
5. Crear los componentes de la página:
   - `app/components/about-highlight-icon.tsx` (server): los 3 iconos pixel con `aria-hidden="true"`.
   - `app/components/contact-form.tsx` (client): formulario con `useActionState`, estados de envío, `shake`, mensajes por campo, honeypot oculto y terminal de éxito/error.
6. Crear `app/about/page.tsx` (server) con las secciones, el divisor, `<ContactForm />`, `<RevealObserver />` y `metadata`. Verificación: abrir `/about` y ver la pantalla completa; enviar un mensaje y recibirlo.
7. Actualizar `app/components/nav.tsx`: enlace **Sobre nosotros** (→ `/about`) en barra y panel móvil, con estado activo en `/about`. Verificación: el estado activo cambia correctamente en cada ruta y "Sobre nosotros" aparece tras "Salón de la Fama".

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/about` existe, se sirve desde `app/about/page.tsx` y muestra el título "ACERCA DE ARCADE VAULT", el párrafo de misión y 3 destacados con icono.
- [ ] La barra y el panel móvil muestran, en orden, "Inicio", "Biblioteca", "Salón de la Fama" y "Sobre nosotros"; este último lleva a `/about` y está activo en esa ruta.
- [ ] No aparece el texto "Acerca de" en la navegación (el título de la página sí lo conserva).
- [ ] La sección CONTACTO muestra "CONTÁCTANOS", los 3 tips con LED y los campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE.
- [ ] Enviar el formulario con datos válidos entrega un correo a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de <nombre>`, `Reply-To` igual al correo del visitante y nombre, correo y mensaje en el cuerpo.
- [ ] Tras un envío exitoso aparece el terminal "VAULT-OS // TERMINAL" con "GRACIAS, <NOMBRE EN MAYÚSCULAS>."; "ENVIAR OTRO MENSAJE" devuelve el formulario vacío.
- [ ] Con algún campo vacío, el formulario hace `shake`, muestra el error en cada campo inválido, conserva lo escrito y no se envía ningún correo.
- [ ] Un correo con formato inválido y un mensaje de menos de 10 o más de 2000 caracteres son rechazados por el servidor, aunque se salte la validación del navegador.
- [ ] Con el campo oculto `website` relleno, la acción responde éxito y no se llama a Resend.
- [ ] Con `RESEND_API_KEY` inválida o ausente, el formulario muestra el aviso de error en estilo terminal, conserva lo escrito y permite reintentar; el terminal de éxito no aparece.
- [ ] Mientras se envía, el botón está deshabilitado y dice "ENVIANDO…"; un doble clic no genera dos correos.
- [ ] `RESEND_API_KEY` no aparece en el código del cliente, en el HTML ni en las respuestas (búsqueda en `.next/static` sin coincidencias).
- [ ] `.env.example` existe, está versionado y lista las tres variables sin valores secretos; `.env.local` no está versionado.
- [ ] El divisor tiene `aria-hidden="true"` y los campos tienen `label` asociada (`htmlFor`/`id`) y son navegables con teclado.
- [ ] Al hacer scroll, el divisor y la sección de contacto pasan de invisibles a visibles (clase `in`) una sola vez.
- [ ] Con `prefers-reduced-motion: reduce`, `shake`, el divisor y el `caret` quedan estáticos y las secciones se ven sin esperar al scroll.
- [ ] A 390 px de ancho `/about` no tiene scroll horizontal y los destacados y el formulario colapsan a una columna.
- [ ] Las pantallas de SPEC 01 y SPEC 02 (`/home`, `/biblioteca`, `/juegos/*`, `/acceso`, `/salon`) conservan su aspecto y comportamiento.

---

## Decisiones

- **Sí:** ruta `/about`, tal como se pidió, aunque el resto de rutas del proyecto estén en español. Es una decisión del usuario; no se reabre.
- **Sí:** etiqueta de navegación "Sobre nosotros" en lugar de "Acerca de". Decisión del usuario; el título de la página conserva el texto del template.
- **Sí:** Server Action con `useActionState`. Idiomático en Next.js 16 / React 19 y la API key nunca sale del servidor.
- **No:** Route Handler `POST /api/contacto`. Añade un endpoint público y más código sin que nada más lo consuma.
- **Sí:** un solo correo al equipo con `replyTo` del visitante. Permite responder directo y no usa el remitente para escribir a terceros.
- **No:** correo de confirmación al visitante. Con `onboarding@resend.dev` Resend solo entrega al correo de la cuenta; requeriría dominio verificado.
- **Sí:** remitente `onboarding@resend.dev` y destino `f.m.covarrubias96@gmail.com` como valores de prueba, configurables por env vars. Cambiar a un dominio propio no toca código.
- **Sí:** tres variables de entorno en lugar de hardcodear el correo. Evita versionar un correo personal y separa configuración de código.
- **Sí:** validación en servidor más honeypot. Protege la cuota de Resend sin dependencias ni servicios extra.
- **No:** rate limit, CAPTCHA o BotID. Añade un servicio externo y merece su propio spec.
- **Sí:** honeypot responde éxito silencioso. Un rechazo explícito enseña al bot qué ajustar.
- **Sí:** el terminal de éxito solo aparece si Resend confirma el envío. El template lo mostraba siempre (era un simulacro); aquí sería engañoso.
- **Sí:** en error de envío se conserva lo escrito y se permite reintentar. Perder un mensaje largo es la peor experiencia posible.
- **Sí:** cuerpo del correo en texto plano. Suficiente para una bandeja interna; React Email queda para cuando haya correos al visitante.
- **Sí:** la página es un Server Component; solo `ContactForm` y `RevealObserver` son client.
- **Sí:** `.env.example` versionado con excepción en `.gitignore`. Documenta la configuración sin exponer secretos.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `onboarding@resend.dev` solo entrega al correo de la cuenta de Resend; si `CONTACT_TO_EMAIL` es otro, el envío falla | El destino de prueba debe ser el correo con el que se registró la cuenta de Resend; el fallo se maneja como error de envío visible. |
| La API key se filtra al cliente o al repositorio | Sin prefijo `NEXT_PUBLIC_`, solo se lee en `actions.ts`; `.env*` sigue ignorado y hay criterio de aceptación de búsqueda en `.next/static`. |
| Abuso del formulario agota la cuota gratuita de Resend | Validación con límites y honeypot; rate limit queda para un spec posterior. |
| Inyección de cabeceras vía el nombre en el asunto | Se eliminan saltos de línea del `nombre` antes de construir el asunto. |
| Con `cacheComponents: true`, una Server Action o la lectura de `process.env` se comporta distinto | Leer la guía en `node_modules/next/dist/docs/` y verificar un envío real en `next dev` y `next build && next start`. |
| La API de Resend cambió respecto al conocimiento previo del modelo | Consultar la documentación vigente de Resend antes del paso 4; `send` devuelve `{ data, error }` y no lanza excepciones. |
| Estilos portados chocan con los existentes (`.field`, `.kicker`, `blink`) | Solo se copian reglas y keyframes que no existan; los duplicados se omiten. |
| Los emojis del título del destacado ("❤️") se renderizan distinto según plataforma | Se acepta, igual que en el template. |

---

## Qué **no** está en este spec

- Correo de confirmación al visitante ni dominio verificado en Resend.
- Rate limiting, CAPTCHA o BotID.
- Base de datos o panel para los mensajes.
- Plantillas HTML de correo.
- Enlace a `/about` en el footer o en el Home.
- Cambios al texto o al diseño visual del template.
- Internacionalización y tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.

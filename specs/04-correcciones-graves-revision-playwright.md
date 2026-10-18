# SPEC 04 — Correcciones graves de la revisión con Playwright

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-10-18
> **Objective:** Corregir los cuatro errores graves de la revisión con Playwright del 2026-10-18: caída del sitio al fallar el envío del contacto, barra que no cabe en móviles de 360 px o menos, foco de teclado invisible en los `.btn` y accesibilidad del menú móvil y del modal de fin de juego.

---

## Por qué existe este spec

La revisión comparó la app con `references/templates/` y probó interacción, teclado y producción en 5 anchos. Dejó 4 errores graves, 8 medios y 7 menores. El informe completo y las capturas están en `.playwright-screenshots/review/` (carpeta ignorada por git, no viaja con el repositorio), así que este spec resume cada error con su reproducción. Los graves se corrigen aquí; el resto queda para specs siguientes.

| Id | Error | Origen | Reproducción |
| --- | --- | --- | --- |
| A1 | Un fallo de red al enviar el contacto sustituye todo el sitio por la pantalla blanca de Next ("This page couldn't load") y se pierde el mensaje | app | `/about`, rellenar, desconectar la red y pulsar ENVIAR. En `app/components/contact-form.tsx` la acción de `useActionState` no captura el `fetch` fallido y no existe `app/error.tsx` |
| A2 | La barra mide 374 px como mínimo: el menú hamburguesa queda fuera de pantalla a 360 px y desaparece a 320 px | app | Cualquier ruta a 320 o 360 px. `globals.css:195` fuerza `white-space: nowrap` en `.auth-btn`; en la plantilla ese botón se parte en dos líneas |
| A3 | El foco de teclado en los `.btn` es casi invisible: el `clip-path` recorta el anillo y lo poco que queda tapa el borde neón | plantilla | Tab hasta "Iniciar Sesión", JUGAR o EXPLORAR JUEGOS |
| A4 | El panel móvil es enfocable estando cerrado (5 enlaces invisibles en el orden de Tab a 1440 px), no responde a Escape, no atrapa el foco y deja hacer scroll al fondo; el modal "FIN DEL JUEGO" no es un diálogo accesible | plantilla | Tab a 1440 px en `/biblioteca`; abrir el menú a 390 px; pulsar FIN en `/juegos/bloque-buster/jugar` |

---

## Alcance

**In:**

- **A1 — Envío del contacto sin caídas:**
  - En `ContactForm`, la acción que recibe `useActionState` es una función propia que llama a `enviarContacto` dentro de `try/catch`. Si la llamada lanza (red caída, fallo 500 del servidor), devuelve `{ estado: "error", mensajeError, valores }` con lo escrito en el formulario.
  - Mensaje del aviso `terminal-error`: `[ERR] No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.` El aviso ya existe y tiene `role="alert"`.
  - Nuevo `app/error.tsx` (Client Component) como red de seguridad para cualquier otra excepción de render: se muestra dentro del layout (barra y pie visibles) con título "PARTIDA INTERRUMPIDA", un texto que dice qué pasó y qué hacer, el botón "REINTENTAR" (`retry()`) y el enlace "IR AL INICIO" (→ `/home`). Si existe `error.digest`, se muestra como código de referencia. El error se registra con `console.error`.
- **A2 — Barra en móviles estrechos:** por debajo de 421 px el botón de sesión puede encoger y partir el texto (también un nombre largo sin espacios), el logo conserva sus dos líneas y ni el logo ni el hamburguesa se encogen, de modo que el hamburguesa queda siempre dentro de la pantalla desde 320 px. Por encima de 420 px la barra no cambia.
- **A3 — Foco visible en `.btn`:** `.btn:focus-visible` dibuja un anillo de 2 px en `var(--ink)` mediante `::after` que sigue el contorno con las esquinas cortadas. No aparece con el clic del ratón y funciona también en `.btn.pulse`.
- **A4 — Menú móvil y modal accesibles:**
  - Nuevo hook `app/components/use-dialog.ts` (`useDialog`): atrapa el foco con Tab y Shift+Tab, mueve el foco dentro al abrir, lo devuelve al cerrar, bloquea el scroll del fondo sin desplazar el contenido y, si se le pasa `onEscape`, lo llama al pulsar Escape.
  - Panel móvil (`nav.tsx`): `inert` mientras está cerrado; `role="dialog"`, `aria-modal="true"` y `aria-label="Menú"`; el botón hamburguesa con `aria-expanded` y `aria-controls`; Escape cierra y devuelve el foco al hamburguesa; botón "CERRAR" dentro del panel; el fondo (`.av-mobile-backdrop`) con `aria-hidden="true"`.
  - Modal de fin de juego (`game-player.tsx`): `role="dialog"`, `aria-modal="true"` y `aria-labelledby` apuntando al título "FIN DEL JUEGO"; foco inicial en el campo de iniciales; el campo con `aria-label="Iniciales"`; tras guardar, el foco pasa a "JUGAR DE NUEVO" (el campo desaparece) y el aviso "PUNTUACIÓN GUARDADA" lleva `role="status"` para que se anuncie; al reiniciar, el foco vuelve al botón FIN.
- Estilos nuevos en `app/globals.css` (`.btn:focus-visible`, regla `max-width: 420px` de la barra, cabecera del panel, `.av-error`). Texto nuevo en mayúsculas pixel sin letras acentuadas (Press Start 2P las dibuja mal).
- Documentar el spec y los archivos nuevos en `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Los 8 errores medios (tabla del Salón en móvil, contraste de `--ink-faint`, 404 en español y con el tema, búsqueda sin tildes, portada de SERPENTINA, datos de ejemplo incoherentes, "PUNTUACIÓN GUARDADA" sin guardar, etiquetas y encabezados de formularios) y los 7 menores.
- Otros desbordes a 320 px ajenos a la barra (`.activity-card` del Home, `.detail-cover`, `.hud-actions` del reproductor, `.contact-intro`).
- `app/global-error.tsx`: no se conoce ningún error del layout raíz.
- Escape para cerrar el modal de fin de juego.
- Reintentos automáticos del envío del contacto y cualquier cambio en `app/about/actions.ts` o en la validación.
- Cambios en los textos o el diseño de las pantallas existentes y tests automatizados.

---

## Modelo de datos

No introduce estructuras de datos nuevas ni cambia `EstadoContacto` (SPEC 03). Añade un hook con esta firma:

```ts
// app/components/use-dialog.ts
interface OpcionesDialogo {
  initialFocus?: string;                       // selector CSS dentro del contenedor; por defecto, el primer elemento enfocable
  onEscape?: () => void;                       // sin esto, Escape no hace nada
  returnFocus?: () => HTMLElement | null;      // por defecto, el elemento que tenía el foco al abrir
}

export function useDialog<T extends HTMLElement>(
  active: boolean,
  opciones?: OpcionesDialogo,
): React.RefObject<T | null>;
```

Convenciones:

- Elementos enfocables: `a[href]`, `button`, `input`, `select`, `textarea` y `[tabindex]` distintos de `-1`, sin `disabled`.
- Los textos de la interfaz están en español; `retry` es el nombre de la prop de `error.tsx` en Next 16.4 (estable desde 16.3).

---

## Plan de implementación

Antes de escribir código de Next.js se leyó la guía de errores en `node_modules/next/dist/docs/01-app/` (`error.md` y `10-error-handling.md`, exigido por `AGENTS.md`). Para el diseño visual se usa `/frontend-design`, respetando la estética arcade/neón existente.

1. **Foco visible (A3).** En `app/globals.css`, tras `.btn:active`, añadir `.btn:focus-visible { outline: none; }` y `.btn:focus-visible::after` con `position: absolute; inset: 0; background: var(--ink); pointer-events: none` y un `clip-path: polygon(evenodd, …)` que recorta un anillo de 2 px siguiendo el contorno de 8 px del botón. Verificación: Tab hasta "Iniciar Sesión", JUGAR y EXPLORAR JUEGOS (`.pulse`) y capturar; el anillo se ve y el clic del ratón no lo muestra.
2. **Barra estrecha (A2).** En `app/globals.css`, tras el bloque `max-width: 1199px`, añadir `@media (max-width: 420px)` con `flex-shrink: 0` para `.logo` y `.hamburger`, `width: min-content` para `.logo-text` y, para `.auth-btn`: `min-width: 0; white-space: normal; overflow-wrap: anywhere; text-align: center; line-height: 1.35; padding: 8px 10px`. Verificación: a 320, 360, 375, 390 y 414 px, como invitado y con el usuario `WWWWWWWWWW`, el hamburguesa queda dentro del viewport en todas las rutas.
3. **Hook `useDialog`.** Crear `app/components/use-dialog.ts` según el modelo de datos, sin consumidores todavía. Verificación: `npm run lint` y `npx tsc --noEmit` sin errores.
4. **Menú móvil (A4).** En `app/components/nav.tsx`: `ref` y `useDialog(open, { onEscape: close, returnFocus })`, `inert={!open}`, atributos ARIA del panel y del hamburguesa, cabecera del panel con el botón "CERRAR" y `aria-hidden` en el fondo. En `app/globals.css`: estilos de la cabecera del panel. Verificación: a 1440 px el orden de Tab no entra en el panel; a 390 px abrir, Tab, Shift+Tab, Escape, CERRAR y el fondo funcionan según los criterios.
5. **Modal de fin de juego (A4).** En `app/components/game-player.tsx`: `useDialog(over, { initialFocus: "input", returnFocus })`, atributos ARIA del modal, `aria-label` del campo y foco en "JUGAR DE NUEVO" al guardar. Verificación: pulsar FIN, comprobar foco inicial, trampa de Tab, guardar y reiniciar.
6. **Envío del contacto (A1).** En `app/components/contact-form.tsx`: función `enviar` a nivel de módulo con `try/catch` que devuelve el estado de error con los valores del `FormData`, y `useActionState(enviar, …)`. Verificación: con el navegador sin conexión, ENVIAR muestra el aviso y conserva los tres campos; con la red restablecida el siguiente envío se procesa con normalidad.
7. **Pantalla de error (A1).** Crear `app/error.tsx` y los estilos `.av-error` en `app/globals.css`. Verificación: una ruta de prueba temporal que lance un error en render muestra la pantalla dentro del layout y REINTENTAR vuelve a renderizar; la ruta de prueba se elimina antes de seguir.
8. **Documentación.** En `CLAUDE.md`: añadir SPEC 04 a la lista de specs y mencionar `app/error.tsx` y `app/components/use-dialog.ts` en la estructura de `app/`. Verificación: `npm run lint` y `npm run build` sin errores.

---

## Criterios de aceptación

Verificados con Playwright (Chromium) sobre `npm run dev`, más `npm run lint` y `npm run build`.

**Global**

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] Las capturas a 1440 px de `/home`, `/biblioteca`, `/juegos/bloque-buster`, `/acceso`, `/salon` y `/about` no cambian respecto a las de la revisión (diff de píxeles < 0,6 %, solo animaciones).
- [x] No hay errores en la consola del navegador en esas rutas, salvo los de las pruebas con red cortada.

**A1 — Envío del contacto**

- [x] Con el navegador sin conexión, pulsar ENVIAR en `/about` muestra `[ERR] No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.` con `role="alert"`, y la barra, el pie y el formulario siguen visibles.
- [x] Tras ese error, NOMBRE, CORREO y MENSAJE conservan lo escrito y el botón de envío está activo.
- [x] Con la red restablecida, volver a enviar se procesa con normalidad (en la prueba, con el campo honeypot relleno para no mandar un correo real).
- [x] Una excepción de render en una ruta muestra "PARTIDA INTERRUMPIDA" dentro del layout, con los botones "REINTENTAR" e "IR AL INICIO" (→ `/home`), y REINTENTAR vuelve a renderizar el segmento.
- [x] La pantalla de error no contiene letras acentuadas en mayúsculas pixel y su texto dice qué pasó y qué hacer.

**A2 — Barra estrecha**

- [x] A 320, 360, 375, 390 y 414 px, en las 8 rutas, el botón hamburguesa queda completamente dentro del viewport (`right <= clientWidth`).
- [x] Con el usuario `WWWWWWWWWW`, a 320 y 360 px, ningún elemento de la barra se sale del viewport ni se solapa con otro.
- [x] A 421 px y más, "Iniciar Sesión" sigue en una sola línea y la barra mide lo mismo que antes (62 px de alto, botón de 188 × 37 px).

**A3 — Foco visible**

- [x] Al enfocar con Tab "Iniciar Sesión", JUGAR y EXPLORAR JUEGOS, la captura difiere de la versión sin foco y muestra un anillo claro de 2 px que sigue las esquinas cortadas del botón.
- [x] Al hacer clic con el ratón en un `.btn`, no aparece el anillo.

**A4 — Menú y modal**

- [x] A 1440 px, 25 pulsaciones de Tab desde el inicio de `/biblioteca` no enfocan ningún elemento dentro de `.av-mobile-panel`, que tiene el atributo `inert`.
- [x] El botón hamburguesa tiene `aria-expanded="false"` con el panel cerrado y `"true"` con el panel abierto, y `aria-controls` apunta al `id` del panel.
- [x] Al abrir el menú a 390 px, el foco pasa a "CERRAR"; Tab y Shift+Tab ciclan entre los elementos del panel sin salir.
- [x] Escape, el botón "CERRAR" y el fondo cierran el menú y el foco vuelve al botón hamburguesa.
- [x] Con el menú abierto, la rueda del ratón no cambia `scrollY`; al cerrarlo se puede volver a hacer scroll.
- [x] Pulsar un enlace del panel navega y cierra el panel.
- [x] El modal de fin de juego tiene `role="dialog"`, `aria-modal="true"` y `aria-labelledby` que apunta al título "FIN DEL JUEGO".
- [x] Al pulsar FIN, el foco queda en el campo de iniciales, que tiene `aria-label="Iniciales"`, y 12 pulsaciones de Tab no sacan el foco del modal.
- [x] Escape no cierra el modal.
- [x] Tras GUARDAR PUNTUACIÓN el foco está en "JUGAR DE NUEVO", no en `<body>`.
- [x] Al pulsar JUGAR DE NUEVO el modal se cierra y el foco vuelve al botón FIN.
- [x] Con el modal abierto, la rueda del ratón no cambia `scrollY`.

---

## Decisiones

- **Definición rápida sin aclaración detallada:** el usuario pidió crear el spec y corregir los 4 graves en un solo paso, por lo que se omitió la fase de preguntas de `/spec`. Las decisiones de diseño de abajo las toma el agente y se pueden revisar en este archivo.
- **Sí:** capturar en el cliente el fallo de la Server Action. La guía de Next 16.4 pide modelar los errores esperados como valor de retorno y no lanzar; el fallo de transporte nunca llega al servidor, así que no puede devolver nada, y los errores no capturados dentro de una transición suben al `error.tsx` más cercano.
- **Sí:** un único mensaje para red caída y fallo 500, porque para el visitante la acción correcta es la misma (reintentar).
- **No:** reintentos automáticos. Un reintento silencioso podría enviar dos correos.
- **Sí:** `app/error.tsx` como red de seguridad usando `retry` (estable desde Next 16.3). **No:** `global-error.tsx`, porque define su propio `<html>` y estilos y no hay ningún error conocido del layout raíz.
- **Sí:** `inert` en el panel cerrado. **No:** `visibility: hidden`, que obligaría a retrasar el cambio hasta el final de la transición de 220 ms.
- **Sí:** un hook compartido `useDialog` para menú y modal, en lugar de duplicar trampa de foco, bloqueo de scroll y devolución del foco. **No:** `<dialog>` nativo: obliga a reescribir la animación `.open` y los estilos del modal.
- **Sí:** `returnFocus` explícito en el menú, porque Safari no da el foco a un botón al hacer clic y el elemento activo sería `<body>`.
- **No:** Escape cierra el modal de fin de juego. Sin el modal no queda un estado coherente (partida terminada, sin HUD ni acciones); se sale con "JUGAR DE NUEVO" o "VOLVER AL VAULT".
- **Sí:** compensar con `padding-right` el ancho de la barra de scroll al bloquear el scroll, para que el contenido no salte en navegadores con barra clásica.
- **Sí:** anillo de foco con `::after` y `clip-path: polygon(evenodd, …)`. **No:** `outline` (lo recorta el `clip-path` del botón) ni `box-shadow: inset` (lo anula la animación `pulse` y se recorta en las esquinas).
- **Sí:** umbral de 420 px para la barra. A 375 px de ancho real el botón no cabe en una línea; por encima de 420 px la barra no cambia. Por debajo, la barra puede crecer 8 px de alto cuando el botón se parte en dos líneas, como ya ocurre en la plantilla.
- **Sí:** `width: min-content` en `.logo-text` por debajo de 421 px. Con solo `flex-shrink: 0` el logo ocupaba una línea (166 px) y dejaba al botón sin espacio.
- **Sí:** `role="status"` en el aviso "PUNTUACIÓN GUARDADA": al guardar el foco pasa a otro botón y, sin la región viva, el aviso no se anunciaría.
- **Sí:** "CERRAR" como texto y no un glifo "✕", que Press Start 2P no incluye.
- **Sí:** título "PARTIDA INTERRUMPIDA" sin acentos, para esquivar el error medio de las mayúsculas acentuadas, que se trata en otro spec.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `retry` solo existe desde Next 16.3 | El proyecto fija `next` 16.4.0; la guía instalada lo documenta |
| `inert` no está soportado en navegadores antiguos | El panel además queda fuera de pantalla con `transform`; el fallo solo afecta al orden de Tab en navegadores anteriores a 2023 |
| El bloqueo de scroll cambia el ancho de la página | Compensación con `padding-right` igual al ancho de la barra de scroll y restauración de los estilos previos al cerrar |
| `clip-path: polygon(evenodd, …)` del anillo se ve distinto entre navegadores | Verificación visual en Chromium; el trazo de las diagonales puede variar medio píxel, sin afectar a la visibilidad |
| La ruta de prueba de `error.tsx` se queda en el repositorio | Se elimina en el mismo paso y `git status` lo comprueba antes de seguir |

---

## Qué **no** está en este spec

- Los errores medios y menores de la revisión.
- Otros desbordes a 320 px ajenos a la barra.
- `global-error.tsx`.
- Escape para cerrar el modal de fin de juego.
- Cambios en `app/about/actions.ts`, en la validación del contacto o en los datos.
- Tests automatizados.

Cada uno de ellos, si se aborda, va en su propio spec.

# SPEC 25 — Bucle de Fast Refresh al usar Playwright con `next dev`

> **Status:** Implementado
> **Depends on:** SPEC 17 (método de medición con Playwright y registro en `references/`)
> **Date:** 2026-11-08
> **Objective:** Medir por qué `next dev` recompila en bucle mientras se usa el MCP de Playwright y corregir solo la causa confirmada, para que una sesión de pruebas no recargue la app sin cambios de código.

---

## Por qué existe este spec

Durante la verificación de la SPEC 24 (2026-11-08), `/acceso` se recargó en bucle y la terminal repitió `✓ Compiled` sin que nadie cambiara código. Borrar `.next/dev` y reiniciar lo cortó. Aun así, la consola siguió mostrando `[Fast Refresh] rebuilding` tras cada acción del MCP.

Hay tres sospechosos, y ninguno está confirmado:

| Sospechoso                       | Por qué                                                                                                                                                                                                                                                                                       | Qué lo descarta                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Escrituras del MCP de Playwright | Guarda un snapshot (`page-*.yml`) y un registro de consola (`console-*.log`) en `.playwright-mcp/`, dentro del proyecto, en cada acción. Ya hay 169 snapshots y 165 registros. Git ignora la carpeta, pero Next 16 no documenta ninguna forma de excluir carpetas del vigilante de Turbopack. | Que el bucle siga con la salida del MCP fuera del proyecto                           |
| Sincronización de OneDrive       | El proyecto vive en `C:\Users\franc\OneDrive\...`, y OneDrive toca los archivos al sincronizarlos                                                                                                                                                                                             | Que el bucle pare con la salida fuera del proyecto, o que siga con OneDrive en pausa |
| `.next/dev` obsoleto             | `CLAUDE.md` ya recoge el bucle de `✓ Compiled` como síntoma de un bundle obsoleto                                                                                                                                                                                                             | Que el bucle aparezca con `.next/dev` recién borrado                                 |

Las capturas de `browser_take_screenshot` también se guardan dentro del proyecto, en `.playwright-screenshots/`. Se miden aparte.

---

## Alcance

**In:**

- Un protocolo de medición fijo, que se repite igual en cada escenario.
- Medir tres escenarios: la configuración actual, la salida del MCP fuera del proyecto y, solo si el bucle sigue, OneDrive en pausa.
- Medir si una captura en `.playwright-screenshots/` provoca un rebuild.
- Si la causa son las escrituras del MCP, sacar su salida del proyecto con `--output-dir` en `~/.claude.json`.
- Si la causa es OneDrive, documentarlo y dejar la pauta en `CLAUDE.md`.
- Registro nuevo `references/dev-server-review.md` con el método, las cifras y la causa.
- Borrar los snapshots y registros antiguos de `.playwright-mcp/`, conservando `.gitkeep` y `audit/`.
- Actualizar `CLAUDE.md` y la memoria `playwright-review-workflow`.

**Out of scope (para futuros specs):**

- El `POST /acceso/nueva-clave` del log del servidor que no salía del navegador de Playwright.
- Mover el proyecto fuera de OneDrive o a un Dev Drive.
- Mover `.playwright-screenshots/`, aunque la medición demuestre que provoca rebuilds.
- Usar `watchOptions.pollIntervalMs`, que la guía de Next desaconseja.
- El CSS obsoleto de Turbopack tras editar `app/globals.css`, que ya recoge la memoria `playwright-review-workflow`.
- Cambiar código de `app/` o `next.config.ts`.

---

## Modelo de datos

Esta spec no introduce estructuras de datos ni toca la app.

### Configuración del MCP

El servidor `playwright` está definido en `~/.claude.json`, en el ámbito local de este proyecto. Si la causa son sus escrituras, sus `args` pasan a ser:

```json
[
  "@playwright/mcp@latest",
  "--output-dir",
  "C:\\Users\\franc\\AppData\\Local\\Temp\\playwright-mcp-arcade-vault"
]
```

- La carpeta queda fuera del repositorio y de OneDrive.
- `.mcp.json` no cambia: sigue teniendo solo `supabase`.
- El cambio lo hace el usuario, editando el archivo o con `claude mcp`, y hay que reiniciar Claude Code para que el MCP lo lea.

### Protocolo de medición

Las condiciones previas son las mismas en cada escenario:

1. Detener `next dev`, borrar `.next/dev` y arrancar `npm run dev` en segundo plano.
2. Esperar a que `/acceso` y `/home` respondan `200`, para que ninguna ruta del guion se compile en frío durante la medición (añadido al medir B: la primera visita a una ruta sin compilar da un `[Fast Refresh] rebuilding` que no viene del vigilante).
3. No cambiar ningún archivo del proyecto durante la medición.
4. Navegar como invitado, sin sesión.

**Guion:** 20 acciones del MCP, hechas con sus propias herramientas y no con `browser_run_code_unsafe`, porque cada respuesta de una herramienta es lo que escribe el snapshot. Se alternan `browser_navigate` y `browser_snapshot` sobre `/acceso` y `/home`: 10 de cada herramienta, 10 sobre cada ruta.

**Capturas:** al terminar el guion, 3 `browser_take_screenshot` en `.playwright-screenshots/dev-server/`, con 5 s de espera tras cada una.

**Qué se cuenta:**

| Métrica                        | Dónde                                                                 | Cómo                                            |
| ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| Recompilaciones                | Terminal de `next dev`, desde la línea de arranque                    | Líneas que contienen `Compiled in`              |
| Rebuilds de Fast Refresh       | Consola del navegador (`browser_console_messages`, todos los niveles) | Mensajes `[Fast Refresh] rebuilding`            |
| Archivos nuevos en el proyecto | `.playwright-mcp/`, sin contar `audit/`                               | Diferencia de recuento antes y después          |
| Rebuilds por captura           | Las dos métricas anteriores                                           | Su diferencia antes y después de las 3 capturas |

**Umbral de éxito:** 0 recompilaciones y 0 rebuilds durante el guion.

### Escenarios

| Escenario | Configuración                                                       | Cuándo se mide                |
| --------- | ------------------------------------------------------------------- | ----------------------------- |
| A         | Actual: el MCP escribe en `.playwright-mcp/` y OneDrive está activo | Siempre                       |
| B         | `--output-dir` fuera del proyecto, con OneDrive activo              | Siempre                       |
| C         | Igual que B, con OneDrive en pausa                                  | Solo si B no cumple el umbral |

Cómo se decide la causa:

- **A falla y B cumple:** la causa son las escrituras del MCP, y la configuración de B se queda.
- **B falla y C cumple:** la causa es OneDrive. Se documenta y se vuelve al `--output-dir` solo si B redujo los eventos respecto a A.
- **C también falla:** la causa no está entre los sospechosos. Se registran las cifras y la spec se cierra sin corrección. Lo siguiente va en otra spec.

---

## Plan de implementación

1. **Línea base (escenario A).** Crear `references/dev-server-review.md` con el protocolo de esta spec. Medir el escenario A, capturas incluidas, y anotar las cifras. Verificación: el registro tiene las cuatro métricas de A.
2. **Salida del MCP fuera del proyecto (escenario B).** El usuario añade `--output-dir` a los `args` de `playwright` en `~/.claude.json` y reinicia Claude Code. Comprobar con un `browser_snapshot` que el archivo aparece en la carpeta nueva y no en `.playwright-mcp/`. Medir el escenario B y anotar las cifras. Verificación: el registro tiene las cuatro métricas de B.
3. **OneDrive (escenario C), solo si B no cumple el umbral.** El usuario pausa la sincronización de OneDrive. Medir el escenario C, anotar las cifras y reanudar OneDrive. Si B cumplió el umbral, el registro dice que C no se midió. Verificación: el registro tiene C o explica por qué falta.
4. **Conclusión.** Escribir en el registro la causa según la tabla de escenarios, qué configuración se queda y qué pasa con las capturas. Si la causa es OneDrive y el `--output-dir` no redujo los eventos, el usuario quita la opción de `~/.claude.json`. Verificación: el registro nombra una causa o dice que no está entre los sospechosos.
5. **Limpieza.** Borrar los `page-*.yml` y `console-*.log` de `.playwright-mcp/`, conservando `.gitkeep` y `audit/`. Si se quedó el `--output-dir`, cargar con `browser_run_code_unsafe` y `filename` un script de `.playwright-mcp/audit/` (por ejemplo `acceso-audit.txt`), para confirmar que los agentes pueden seguir leyendo sus scripts. Verificación: en `.playwright-mcp/` solo quedan `.gitkeep` y `audit/`.
6. **Documentación.**
   - En la sección «Desarrollo» de `CLAUDE.md`: la causa, la configuración del MCP que se queda y la pauta para OneDrive si se confirmó.
   - Añadir `dev-server-review.md` a la lista de registros de trabajo de `references/` en `CLAUDE.md`.
   - En la memoria `playwright-review-workflow`, a dónde va ahora la salida automática del MCP.
   - Verificación: los dos archivos mencionan el registro nuevo.

---

## Criterios de aceptación

- [x] `references/dev-server-review.md` describe el protocolo y tiene las cuatro métricas de los escenarios A y B.
- [x] El registro tiene las métricas del escenario C, o dice que no se midió porque B cumplió el umbral.
- [x] El registro nombra la causa confirmada, o dice que no está entre los tres sospechosos.
- [x] El registro dice si las capturas en `.playwright-screenshots/` provocan rebuilds.
- [x] Si la causa son las escrituras del MCP, `~/.claude.json` tiene `--output-dir` fuera del proyecto y de OneDrive, y un `browser_snapshot` deja su archivo allí y ninguno en `.playwright-mcp/`.
- [ ] Si la causa son las escrituras del MCP, repetir el guion con la configuración final da 0 líneas `Compiled in` y 0 `[Fast Refresh] rebuilding`. _Sin marcar: con OneDrive activo, las dos mediciones de B dieron 0 `Compiled in` y 1 rebuild (36 en A). Solo C, con OneDrive en pausa, dio 0, y se midió una vez._
- [x] Si la causa es OneDrive, `CLAUDE.md` recoge la pauta de pausarlo mientras se usa `next dev` con Playwright.
- [x] `.mcp.json`, `next.config.ts` y los archivos de `app/` no cambian.
- [x] En `.playwright-mcp/` solo quedan `.gitkeep` y `audit/`.
- [x] Si se quedó el `--output-dir`, `browser_run_code_unsafe` con `filename` sigue cargando un script de `.playwright-mcp/audit/`. _Con `acceso-desktop.txt`, que no escribe archivos: `acceso-audit.txt` habría sobrescrito capturas de `mobile-porter`._
- [x] `CLAUDE.md` y la memoria `playwright-review-workflow` mencionan `references/dev-server-review.md` y dicen a dónde va la salida automática del MCP.
- [ ] `next dev` está detenido al terminar, y OneDrive vuelve a estar activo si se pausó. _Sin marcar: `next dev` está detenido, pero OneDrive sigue en pausa por decisión del usuario, que no lo inicia con Windows. Hay que reanudarlo a mano._

---

## Decisiones

- **Sí:** solo el bucle de Fast Refresh (decisión del usuario). **No:** el `POST /acceso/nueva-clave` del log, que no tiene relación con el vigilante de archivos y va aparte.
- **Sí:** medir antes de corregir, como en la SPEC 17 (decisión del usuario). Hay tres sospechosos y ninguno confirmado. Corregir a ciegas podría dejar el bucle si la causa es OneDrive. **No:** corregir directamente.
- **Sí:** un guion fijo de 20 acciones con umbral 0 (decisión del usuario). Es reproducible y deja comparar escenarios. **No:** una sesión libre de 5 minutos, que es más realista pero no se puede repetir igual.
- **Sí:** las acciones del guion usan las herramientas del MCP y no `browser_run_code_unsafe`. Las escrituras sospechosas salen de las respuestas de cada herramienta, y un solo `run_code` agruparía muchas acciones en una escritura.
- **Sí:** la salida del MCP, fuera del proyecto y de OneDrive con `--output-dir` (decisión del usuario). Es la única forma de que el vigilante no la vea, porque Next 16 no documenta cómo excluir carpetas. **No:** otra carpeta dentro del proyecto, que el vigilante seguiría viendo.
- **Sí:** configurarlo en `~/.claude.json`, donde ya está definido (decisión del usuario). Admite una ruta absoluta de esta máquina. **No:** `.mcp.json`, donde una ruta absoluta no sirve a otros y quedarían dos servidores `playwright`.
- **Sí:** medir las capturas, pero no moverlas (decisión del usuario). Son pocas, una por paso. Moverlas cambia la convención de `CLAUDE.md`, de la memoria, de `perf-auditor`, de `mobile-porter` y de `puntos-de-integracion.md`.
- **Sí:** si la causa es OneDrive, documentar y cerrar (decisión del usuario). **No:** mover el proyecto en esta spec, porque cambia las rutas absolutas del MCP, de la memoria y de los agentes.
- **Sí:** un registro nuevo, `references/dev-server-review.md` (decisión del usuario). **No:** añadirlo a `performance-review.md`, que mide los fps de los juegos y no el servidor de desarrollo.
- **Sí:** borrar los snapshots y registros antiguos de `.playwright-mcp/` (decisión del usuario). Son salida desechable que git ya ignora. `audit/` se conserva porque guarda los scripts de `perf-auditor` y `mobile-porter`.
- **No:** `watchOptions.pollIntervalMs`. La guía de Next lo deja como último recurso porque añade latencia y mucho uso de CPU y disco.
- **No:** tocar `app/` ni `next.config.ts`. La causa está en el entorno de desarrollo, no en la app.

---

## Riesgos

| Riesgo                                                                                                                                                                           | Mitigación                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Con `--output-dir`, `browser_run_code_unsafe` deja de leer los scripts de `.playwright-mcp/audit/`, porque la memoria dice que solo lee archivos dentro de las raíces permitidas | El paso 5 lo comprueba. Si falla, se registra y se decide con el usuario: mover `audit/` o volver a la configuración anterior.                                       |
| La versión `@playwright/mcp@latest` cambia el nombre o el comportamiento de `--output-dir`                                                                                       | El paso 2 comprueba dónde aparece el snapshot antes de medir.                                                                                                        |
| El bucle no se reproduce en el escenario A                                                                                                                                       | Se registra. Si A da 0 eventos, la causa no está entre los sospechosos o depende de algo que el guion no hace, y la spec se cierra sin corrección.                   |
| Otra pestaña abierta en el navegador del usuario genera peticiones durante la medición                                                                                           | Las métricas cuentan la consola del navegador de Playwright, y la terminal se revisa junto con la lista de peticiones de ese navegador (`browser_network_requests`). |
| OneDrive queda en pausa al terminar                                                                                                                                              | Lo cubre un criterio de aceptación.                                                                                                                                  |

---

## Qué **no** está en este spec

- El `POST /acceso/nueva-clave` del log del servidor.
- Mover el proyecto fuera de OneDrive o a un Dev Drive.
- Mover `.playwright-screenshots/`.
- `watchOptions.pollIntervalMs`.
- El CSS obsoleto tras editar `app/globals.css`.
- Cambios en `app/` o en `next.config.ts`.

Cada uno de ellos, si se aborda, va en su propio spec.

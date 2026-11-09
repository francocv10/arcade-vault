# Revisión del servidor de desarrollo (`next dev` + MCP de Playwright)

Registro de la SPEC 25 (`specs/25-bucle-fast-refresh-playwright.md`). Mide por qué `next dev` reconstruye sin cambios de código mientras se usa el MCP de Playwright, y qué configuración lo corta.

## Protocolo

Es el mismo en cada escenario.

**Condiciones previas**

1. Detener `next dev`, borrar `.next/dev` y arrancar `npm run dev` en segundo plano, con la salida en un log fuera del proyecto.
2. Esperar a que `/acceso` y `/home` respondan `200`. Calentar `/home` se añadió tras la primera medición de B: sin ello, su primera carga en el guion se compila en frío y da un rebuild que no viene del vigilante. A se midió sin calentar `/home`, así que a sus 36 rebuilds les sobra como mucho esa compilación.
3. No cambiar ningún archivo del proyecto durante la medición.
4. Navegar como invitado, sin sesión. El perfil del navegador del MCP es persistente y puede conservar una sesión de pruebas anterior: antes del guion se borran sus cookies, `localStorage` y `sessionStorage`, y se cierra la página para que el recuento de consola empiece de cero. Estas acciones de preparación no cuentan.

**Guion:** 20 acciones con las herramientas del MCP, no con `browser_run_code_unsafe`. Se alternan `browser_navigate` y `browser_snapshot`: navegar a `/acceso`, snapshot, navegar a `/home`, snapshot, y así cinco veces. Son 10 de cada herramienta y 10 sobre cada ruta.

**Capturas:** al terminar el guion se hacen 3 `browser_take_screenshot` en `.playwright-screenshots/dev-server/` (`<escenario>-1.png` a `-3.png`), cada una seguida de `browser_wait_for` de 5 s.

**Métricas**

| Métrica                        | Dónde                                         | Cómo                                                                                                             |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Recompilaciones                | Log de `next dev`, desde la línea de arranque | Líneas que contienen `Compiled in`                                                                               |
| Rebuilds de Fast Refresh       | Consola del navegador (todos los niveles)     | Mensajes `[Fast Refresh] rebuilding`. Se cuentan en los `console-*.log` del MCP o con `browser_console_messages` |
| Archivos nuevos en el proyecto | `.playwright-mcp/`, sin contar `audit/`       | Diferencia de recuento antes y después                                                                           |
| Rebuilds por captura           | Las dos métricas anteriores                   | Su diferencia antes y después de las 3 capturas                                                                  |

**Umbral de éxito:** 0 recompilaciones y 0 rebuilds durante el guion.

## Escenario A — configuración actual

- **Fecha:** 2026-11-08 (hora local; los nombres de archivo del MCP van en UTC, 2026-11-09T01:08–01:10).
- **Configuración:** el MCP escribe sus snapshots y registros de consola en `.playwright-mcp/`, dentro del proyecto, y OneDrive está activo.
- **Arranque:** `✓ Ready in 436ms`, y `GET /acceso 200` en 2,6 s.
- **Preparación:** la primera navegación a `/acceso` llevó a `/home` porque el perfil del MCP conservaba una sesión. Se descartó, se limpió el perfil y se empezó de nuevo.

| Métrica                               | Guion (20 acciones) | Capturas (3 + 3 esperas de 5 s) |
| ------------------------------------- | ------------------- | ------------------------------- |
| Líneas `Compiled in`                  | **0**               | **0**                           |
| `[Fast Refresh] rebuilding`           | **36**              | **84**                          |
| Archivos nuevos en `.playwright-mcp/` | **20** (337 → 357)  | **3** (357 → 360)               |

Detalle:

- **Rebuilds por carga del guion:** 1, 4, 1, 1, 6, 6, 4, 6, 1, 6, en orden de navegación (`/acceso`, `/home`, …). Cada `browser_navigate` abre un `console-*.log` nuevo y escribe un `page-*.yml`, y por eso hay 10 + 10 archivos. Un `browser_snapshot` sin `filename` devuelve el árbol en la respuesta y no crea archivo, pero sí añade líneas al `console-*.log` abierto. En cada acción, la respuesta del MCP anunciaba líneas nuevas en ese registro.
- **Capturas:** en el registro de consola abierto, los rebuilds pasaron de 6 al terminar el guion a 90. `browser_take_screenshot` escribe el PNG en `.playwright-screenshots/dev-server/` y no crea archivo en `.playwright-mcp/`, pero cada `browser_wait_for` sí guarda un `page-*.yml` (de ahí los 3 archivos). Los rebuilds no se pueden atribuir solo a los PNG, porque cada espera también escribe en `.playwright-mcp/`: lo separa el escenario B.
- **Cola tras la última acción:** el registro de consola siguió creciendo unos 4 s después de la última herramienta (de la L152 a la L182, todo `[Fast Refresh] rebuilding`/`done`) y luego se paró: en 20 s quieto no añadió nada. Encaja con una realimentación amortiguada: el MCP añade un mensaje al log, el vigilante de Turbopack lo ve y Fast Refresh reconstruye, lo que añade otro mensaje.
- **Terminal:** las 30 líneas nuevas son solo `GET /acceso`, `GET /home` y `GET /manifest.webmanifest`, todas `200`. No hay `Compiled in`, `Compiling` ni peticiones de fuera de Playwright. El bucle de `✓ Compiled` en la terminal visto en la SPEC 24 **no se reprodujo** con `.next/dev` recién borrado. Lo que sí se reproduce es el rebuild de Fast Refresh en el cliente. En la acción 10 el indicador de Next mostró «Compiling».
- **Descarte:** con `.next/dev` recién borrado hay 36 rebuilds, así que un bundle obsoleto no explica los rebuilds de Fast Refresh. Sí puede explicar el bucle de la terminal que se vio en la SPEC 24.

## Escenario B — `--output-dir` fuera del proyecto

### Primera medición (sin calentar `/home`)

- **Fecha:** 2026-11-08 (hora local; archivos del MCP en UTC, 2026-11-09T01:21–01:23).
- **Configuración:** `args` de `playwright` en `~/.claude.json` (ámbito local del proyecto) con `--output-dir C:\Users\franc\AppData\Local\Temp\playwright-mcp-arcade-vault`, fuera del repositorio y de OneDrive. OneDrive activo. `.mcp.json` sin cambios.
- **Comprobación previa:** un `browser_navigate` a `/acceso` dejó su `page-*.yml` y su `console-*.log` en la carpeta nueva, y `.playwright-mcp/` siguió en 360 archivos. `--output-dir` funciona con `@playwright/mcp@latest`.
- **Arranque:** `✓ Ready in 427ms`, y `GET /acceso 200` en 2,6 s. El perfil no conservaba sesión; aun así se limpiaron cookies y almacenamiento y se cerró la página.

| Métrica                               | Guion (20 acciones) | Capturas (3 + 3 esperas de 5 s) |
| ------------------------------------- | ------------------- | ------------------------------- |
| Líneas `Compiled in`                  | **0**               | **0**                           |
| `[Fast Refresh] rebuilding`           | **1**               | **3**                           |
| Archivos nuevos en `.playwright-mcp/` | **0** (360 → 360)   | **0** (360 → 360)               |

Detalle:

- **Rebuilds por carga del guion:** 0, 1, 0, 0, 0, 0, 0, 0, 0, 0 (frente a 36 en A). El único es la primera carga de `/home`, la única ruta que se compila en frío durante el guion (`GET /home 200 in 2.6s`; las otras cargas tardan 100–250 ms): es la compilación bajo demanda de la ruta, no el vigilante. No se repite en las otras cuatro cargas de `/home`.
- **Capturas:** exactamente **1 rebuild por captura** (a los 36,8 s, 48,1 s y 56,9 s del registro de consola, cada uno justo tras su `browser_take_screenshot`), y ninguno durante las esperas. El PNG en `.playwright-screenshots/dev-server/` está dentro del proyecto y el vigilante lo ve, pero sin la realimentación del registro de consola cada captura cuesta un rebuild de ~100–175 ms y no 28 como en A.
- **Sin cola:** el registro de consola no crece tras la última herramienta.
- **Terminal:** las 30 líneas nuevas son solo `GET /acceso`, `GET /home` y `GET /manifest.webmanifest`, todas `200`. Ninguna `Compiled in`.

### Repetición (con `/home` calentada)

- **Fecha:** 2026-11-08 (archivos del MCP en UTC, 2026-11-09T01:35–01:36). Misma configuración. `next dev` reiniciado con `.next/dev` borrado; `/acceso` (3,2 s) y `/home` (2,5 s) respondieron `200` antes del guion.
- **Capturas:** no se repitieron. Calentar `/home` no les afecta, y la primera medición ya las separa del guion.

| Métrica                               | Guion (20 acciones) |
| ------------------------------------- | ------------------- |
| Líneas `Compiled in`                  | **0**               |
| `[Fast Refresh] rebuilding`           | **1**               |
| Archivos nuevos en `.playwright-mcp/` | **0** (360 → 360)   |

- **Rebuilds por carga:** 0, 0, 0, 1, 0, 0, 0, 0, 0, 0. El único está en la segunda carga de `/home` (acción 7), a los 283 ms de cargar y sin su `done`, con `GET /home 200 in 395ms (next.js: 146ms)`, algo más lento que las demás cargas de `/home` (~10–30 ms de `next.js`). Ya no es la compilación en frío de la ruta y no hay ninguna escritura del MCP dentro del proyecto. Queda sin explicar, y por eso se mide C.
- **Terminal:** solo `GET` de `/acceso`, `/home` y `/manifest.webmanifest`, todos `200`.
- **Resultado:** B no cumple el umbral estricto (1 rebuild), pero baja de 36 a 1 y elimina la cola y la realimentación de A.

## Escenario C — OneDrive en pausa

Se mide porque B no cumplió el umbral estricto (1 rebuild en el guion).

- **Fecha:** 2026-11-08 (archivos del MCP en UTC, 2026-11-09T01:39–01:40).
- **Configuración:** la de B (`--output-dir` fuera del proyecto) con OneDrive cerrado: el usuario lo pausó y no arranca con Windows, y no había ningún proceso `OneDrive`.
- **Arranque:** `next dev` reiniciado con `.next/dev` borrado (`✓ Ready in 1094ms`). `/acceso` (7,8 s) y `/home` (8,5 s) respondieron `200` antes del guion. Una pestaña del MCP que seguía abierta en `/home` se reconectó al reiniciar (un `GET /home` de más antes del guion); se limpió el perfil y se cerró antes de empezar.

| Métrica                               | Guion (20 acciones) | Capturas (3 + 3 esperas de 5 s) |
| ------------------------------------- | ------------------- | ------------------------------- |
| Líneas `Compiled in`                  | **0**               | **0**                           |
| `[Fast Refresh] rebuilding`           | **0**               | **3**                           |
| Archivos nuevos en `.playwright-mcp/` | **0** (360 → 360)   | **0** (360 → 360)               |

- **Rebuilds por carga:** 0 en las 10. C cumple el umbral.
- **Capturas:** igual que en B, exactamente 1 rebuild por captura (a los 16,3 s, 27,2 s y 39,2 s), y ninguno en las esperas. Sin OneDrive siguen ahí, así que los provoca el vigilante de Turbopack al ver el PNG nuevo dentro del proyecto, no OneDrive.
- **Terminal:** solo `GET` de `/acceso`, `/home` y `/manifest.webmanifest`, todos `200`.
- **Límite:** C se midió una vez. El rebuild suelto de B apareció en las dos mediciones de B y en ninguna de C, lo que encaja con OneDrive, pero es un evento aislado y no se ha repetido C para descartar el azar.

## Conclusión

| Escenario                         | `Compiled in` | Rebuilds en el guion | Archivos en `.playwright-mcp/` | Rebuilds por captura |
| --------------------------------- | ------------- | -------------------- | ------------------------------ | -------------------- |
| A — actual                        | 0             | 36                   | 20                             | 28 (84 / 3)          |
| B — `--output-dir`                | 0             | 1 (y 1 al repetir)   | 0                              | 1                    |
| C — `--output-dir` + sin OneDrive | 0             | 0                    | 0                              | 1                    |

- **Causa, según la tabla de la spec:** «B falla y C cumple», así que la causa que cierra el umbral es **OneDrive**. Pero casi todo el efecto venía de las **escrituras del MCP**: sacar su salida del proyecto bajó los rebuilds del guion de 36 a 1 y eliminó la realimentación (el registro de consola dentro del proyecto disparaba un rebuild, que escribía otra línea en el registro). OneDrive explica como mucho el rebuild suelto que queda.
- **Configuración que se queda:** `--output-dir C:\Users\franc\AppData\Local\Temp\playwright-mcp-arcade-vault` en `~/.claude.json`, porque B redujo los eventos respecto a A (36 → 1). OneDrive no se mueve ni se cambia: para una sesión de pruebas sin ningún rebuild, se pausa mientras se usa `next dev` con Playwright.
- **`.next/dev` obsoleto:** descartado para los rebuilds de Fast Refresh (A los tiene con `.next/dev` recién borrado). El bucle de `✓ Compiled` en la terminal visto en la SPEC 24 no se reprodujo en ningún escenario: queda como síntoma de un bundle obsoleto, como ya recoge `CLAUDE.md`.
- **Limpieza:** se borraron de `.playwright-mcp/` los 183 `page-*.yml` y 176 `console-*.log` antiguos; solo quedan `.gitkeep` y `audit/`. Con el `--output-dir` activo, `browser_run_code_unsafe` con `filename: ".playwright-mcp/audit/acceso-desktop.txt"` sigue cargando y ejecutando el script (se eligió ese porque no escribe archivos; `acceso-audit.txt` habría sobrescrito capturas de `mobile-porter`). Las rutas relativas se siguen resolviendo contra la raíz del proyecto: `--output-dir` solo cambia dónde va la salida automática.
- **Capturas:** cada `browser_take_screenshot` en `.playwright-screenshots/` provoca **1 rebuild** de Fast Refresh (~100–560 ms), con OneDrive o sin él, y 0 `Compiled in`. Es un coste pequeño y acotado, sin bucle. No se mueven (fuera del alcance de la SPEC 25).

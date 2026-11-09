# Revisión del servidor de desarrollo (`next dev` + MCP de Playwright)

Registro de la SPEC 25 (`specs/25-bucle-fast-refresh-playwright.md`). Mide por qué `next dev` reconstruye sin cambios de código mientras se usa el MCP de Playwright, y qué configuración lo corta.

## Protocolo

Es el mismo en cada escenario.

**Condiciones previas**

1. Detener `next dev`, borrar `.next/dev` y arrancar `npm run dev` en segundo plano, con la salida en un log fuera del proyecto.
2. Esperar a que `/acceso` responda `200`.
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

_Pendiente (paso 2)._

## Escenario C — OneDrive en pausa

_Pendiente (paso 3; solo si B no cumple el umbral)._

## Conclusión

_Pendiente (paso 4)._

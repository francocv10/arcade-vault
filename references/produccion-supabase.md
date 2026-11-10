# Supabase de producción

Cómo llevar a producción la estructura y la configuración del proyecto de desarrollo (`zlsnmrbgsdxzvpoxlghx`). Claude no tiene acceso a producción: prepara los archivos y tú los aplicas. Preparado el 2026-11-09.

- **Datos:** solo la estructura y el catálogo de `games`. Producción arranca sin usuarios, partidas, puntuaciones ni nombres de jugador.
- **Despliegue en Vercel:** desde el 2026-11-10 en `https://arcade-vault-lime.vercel.app`, conectado a la base de producción. La configuración está al final, en «Despliegue en Vercel».
- **Archivos** (en `supabase/produccion/`):
  - `01-esquema.sql`: esquema completo, idempotente y en una transacción.
  - `02-verificacion.sql`: consulta de solo lectura que describe el esquema.
  - `02-verificacion-esperado.tsv`: su salida en dev (74 filas), para comparar. Refleja el esquema de dev **con** las migraciones `03-` en adelante, así que se compara después de aplicarlas.
  - `03-partidas_acumuladas.sql` (SPEC 27): `partidas.user_id` admite nulos con `ON DELETE SET NULL` e índice `partidas_game_id_idx`.

## H. Antes de empezar: aislar producción de Claude

- [ ] Crear producción en **otra organización** de Supabase y no autorizar en ella el MCP. `.mcp.json` fija `project_ref` de dev, pero el token OAuth del MCP pertenece a la cuenta, y la URL incluye `features=account`.
- [ ] (Opcional) Quitar `account` de `features` en `.mcp.json`. Claude no lo usa.
- [ ] No pegar nunca en el chat claves, contraseñas ni la cadena de conexión de producción. La salida de `02-verificacion.sql` sí se puede pegar: no contiene secretos.

## 1. Esquema (SQL Editor de producción)

- [ ] Pegar `01-esquema.sql` entero y ejecutarlo. Debe terminar sin errores. Si falla a la mitad, no se aplica nada, porque va en una transacción.
- [ ] Pegar y ejecutar, en orden, cada `NN-<nombre>.sql` desde `03-` (tabla de «Cambios futuros del esquema»).
- [ ] Pegar `02-verificacion.sql`, ejecutarlo y comparar el resultado con `02-verificacion-esperado.tsv`: deben salir las mismas 74 filas. Diferencias que hay que investigar:
  - Una fila `7 permiso` con `SELECT` en `scores`: los permisos por columna dejarían de servir.
  - Una tabla con `rls=false`.
  - `rls_auto_enable` ejecutable por `anon` o `authenticated`.
  - Que falte la fila `10 event trigger`.

Qué crea el script y de dónde sale cada parte:

| Parte                                                | Origen en dev                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `rls_auto_enable()` y el event trigger `ensure_rls`  | Los creó el panel con el proyecto; **no están en ninguna migración**                                                |
| `games` y sus 5 filas                                | `create_games_scores_leaderboard`, `insert_game_tetris`, `add_arkanoid_game`, `add_snake_game` y `add_frogger_game` |
| `partidas`                                           | `add_partidas`                                                                                                      |
| `scores` (con `partida_id` y `scores_user_id_idx`)   | `create_games_scores_leaderboard`, `add_scores_user_id_index` y `add_partidas`                                      |
| Vista `leaderboard`                                  | `create_games_scores_leaderboard`                                                                                   |
| `jugadores`                                          | `create_jugadores`, sin el relleno desde `auth.users`                                                               |
| Permisos de `scores` y `revoke` de `rls_auto_enable` | `close_scores_writes` y `revoke_rls_auto_enable_execute`                                                            |

Se omite `delete from scores where user_id is null` de `close_scores_writes`, porque no hay datos. Los permisos de `games` y `leaderboard` para `anon` y `authenticated` son los que pone Supabase por defecto; la RLS sin políticas de escritura es lo que bloquea escribir.

## A. Claves

- [ ] **Project Settings > API Keys**: crear una clave publishable (`sb_publishable_…`) y una secreta (`sb_secret_…`). No uses las `anon` ni `service_role` legacy.
- [ ] Guardarlas en el gestor de contraseñas. No van al repo ni a `.env.local`, que sigue apuntando a dev.

## B. Auth > Providers > Email

- [ ] Proveedor Email activo.
- [ ] **Confirm email** activado (SPEC 20).
- [ ] **Minimum password length**: 8 (SPEC 21).
- [ ] **Password Requirements**: minúsculas, mayúsculas, dígitos y símbolos (SPEC 21).
- [ ] **Secure password change** activado (SPEC 23).
- [ ] Protección de contraseñas filtradas: solo con el plan Pro. En dev es un riesgo aceptado; actívala si producción es Pro.

## D. OAuth (la parte que no depende de la URL)

`<REF-PROD>` es el identificador del proyecto de producción, el subdominio de su URL `https://<REF-PROD>.supabase.co`.

- [ ] **GitHub:** crear una OAuth App **nueva** (una OAuth App de GitHub solo admite una callback URL, y la de dev ya usa la de dev).
  - Authorization callback URL: `https://<REF-PROD>.supabase.co/auth/v1/callback`.
  - Homepage URL: provisional, se cambia al desplegar.
  - Copiar Client ID y Client Secret en **Authentication > Providers > GitHub** de producción.
- [ ] **Google:** crear un cliente OAuth **nuevo** (tipo «Aplicación web») en Google Cloud. Reutilizar el de dev añadiéndole la URI también funciona, pero mezcla los entornos.
  - URI de redireccionamiento autorizada: `https://<REF-PROD>.supabase.co/auth/v1/callback`.
  - Copiar Client ID y Client Secret en **Authentication > Providers > Google** de producción.

## E. Correo: bloqueante para un lanzamiento público

El correo integrado de Supabase solo entrega a los miembros del equipo del proyecto y como mucho 2 correos por hora. Sin SMTP propio, en producción nadie de fuera del equipo puede registrarse con correo ni recuperar la contraseña. Google y GitHub sí funcionan.

- [ ] Verificar un dominio propio en Resend.
- [ ] **Authentication > SMTP Settings**: activar el SMTP propio con Resend (host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = una API key de Resend) y un remitente del dominio verificado.
- [ ] Dejar las plantillas «Confirm signup» y «Reset password» **con el enlace por defecto**. La app espera que vuelvan a `/auth/callback` con un `code`.

## F. Rate Limits

- [ ] Revisar **Authentication > Rate Limits** frente a la tabla de `references/security/security-checklist.md`. Los valores por defecto deberían coincidir.
- [ ] Con SMTP propio, subir el envío de correos (2 por hora para todo el proyecto) a un valor razonable para usuarios reales, por ejemplo 30 por hora.

## G. Comprobación final

- [ ] `02-verificacion.sql` coincide con `02-verificacion-esperado.tsv`.
- [ ] En **Advisors > Security** y **Performance** solo aparecen los avisos aceptados en dev: `auth_leaked_password_protection` (si no es Pro), `rls_enabled_no_policy` en `partidas` y `jugadores` y `unused_index` (INFO) en `scores_user_id_idx` y `partidas_game_id_idx` mientras no se usen. `unindexed_foreign_keys` en `partidas.game_id` ya no debe salir: lo cierra `03-partidas_acumuladas.sql`.

## Despliegue en Vercel

URL de producción: `https://arcade-vault-lime.vercel.app`. El equipo de Vercel es `vikingcoding`, así que las URL automáticas de cada despliegue siguen el patrón `arcade-vault-<rama-o-id>-vikingcoding.vercel.app`. La URL que se comparte es solo `arcade-vault-lime.vercel.app`: una URL con id es un despliegue fijo, que puede ser anterior a un cambio de variables, y una de un PR es un Preview, que usa dev.

### Variables de entorno

Regla: **las tres variables de Supabase de un entorno son del mismo proyecto.** Una URL de un proyecto con la clave secreta de otro no tumba el build (spec 28), pero Supabase rechaza la clave: «Partidas» sale como `—` y no se puede guardar ninguna puntuación ni elegir nombre.

| Variable                                                   | Production                          | Preview (y Development)                    | Tipo en Vercel |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------------------ | -------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                 | `https://<REF-PROD>.supabase.co`    | `https://zlsnmrbgsdxzvpoxlghx.supabase.co` | **Config**     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                     | la `sb_publishable_…` de producción | la `sb_publishable_…` de dev               | **Config**     |
| `SUPABASE_SECRET_KEY`                                      | la `sb_secret_…` de producción      | la `sb_secret_…` de dev                    | **Secret**     |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | las de Resend                       | las de Resend                              | **Secret**     |

- `SUPABASE_DB_PASSWORD` no hace falta: la app no la usa.
- **Preview usa dev**, no producción. Así lo recomienda Supabase («Keep Vercel preview deployments off your production database»): lo que se prueba en un PR (cuentas, nombres que quedan reservados para siempre, partidas y puntuaciones) no llega al ranking real, y un PR con una migración nueva no falla contra un esquema de producción que aún no la tiene. Dev y producción no se sincronizan: cada dato existe solo en la base del entorno donde se generó, y lo único que se lleva a producción es el esquema, con los `NN-*.sql` de este directorio.
- **Development** solo lo usan `vercel dev` y `vercel env pull`, no los despliegues. Marcar solo Development deja a los Preview sin variables.
- Las `NEXT_PUBLIC_*` van como **Config**: Next.js las incrusta en el JavaScript del navegador, así que no son secretas, y Vercel no deja guardarlas como Secret («Remove the public framework prefix…»). Al guardar la clave publishable, Vercel avisa de que el nombre lleva `NEXT_PUBLIC_` y `KEY`: se pulsa **Mark as Safe** solo si el valor empieza por `sb_publishable_`. Una variable Secret no se puede pasar a Config: hay que borrarla y crearla de nuevo.
- `SUPABASE_SECRET_KEY` va como **Secret** y nunca con prefijo `NEXT_PUBLIC_`: salta la RLS.
- Las `NEXT_PUBLIC_*` se fijan al compilar: tras cambiarlas, **Redeploy** con «Use existing Build Cache» desmarcado. Las variables sin prefijo se leen al ejecutar, pero un Redeploy es la forma segura de aplicarlas.
- **`SUPABASE_SECRET_KEY` es obligatoria también en el build** (spec 28): el prerender de las fichas `/juegos/<id>` cuenta las partidas con ella. Su ausencia ya no tumba el build: compila, el log muestra `[queries] obtenerPartidasJugadas falló: Falta la variable de entorno SUPABASE_SECRET_KEY…`, «Partidas» sale como `—` y `guardarPuntuacion` no puede publicar. Tras cada despliegue, busca `[queries]` en el log del build; si aparece, corrige la variable y vuelve a desplegar.

Cómo comprobar a qué base apunta cada entorno: abre `/juegos/snake` en la URL de producción y en la de un Preview (o en `localhost:3000`). Cada una debe mostrar los datos de su base, y jugar en una no cambia la otra. Comprobado el 2026-11-10: dev con 6 partidas y 220, producción con 4 partidas y 230. Si producción muestra los datos de dev, recarga sin caché o en incógnito antes de tocar nada.

### URLs de retorno (Supabase > Authentication > URL Configuration)

| Proyecto   | Site URL                               | Redirect URLs                                                                                            |
| ---------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Producción | `https://arcade-vault-lime.vercel.app` | `https://arcade-vault-lime.vercel.app/**`                                                                |
| Dev        | `http://localhost:3000`                | `http://localhost:3000/**` y `https://*-vikingcoding.vercel.app/**` (para iniciar sesión en los Preview) |

Si cambia el slug del equipo de Vercel, cambia también el patrón de dev. Supabase recomienda la ruta exacta en producción y deja `**` para local y Preview.

### Lista

- [x] Variables de Production con las tres de producción y de Preview con las tres de dev (2026-11-10).
- [x] Producción y dev muestran datos distintos en `/juegos/snake` (2026-11-10).
- [x] Proveedores de producción: Email, GitHub y Google activos; el resto, desactivados.
- [x] Site URL y Redirect URLs de producción como en la tabla.
- [ ] `https://*-vikingcoding.vercel.app/**` en las Redirect URLs de dev, y un Redeploy del último Preview sin la caché del build.
- [x] **Google Cloud:** origen JavaScript autorizado `https://arcade-vault-lime.vercel.app` y pantalla de consentimiento **publicada** (en modo de prueba solo entran los usuarios de prueba).
- [x] **GitHub:** Homepage URL de la OAuth App de producción = `https://arcade-vault-lime.vercel.app`.
- [ ] HSTS lleva `includeSubDomains`: con un dominio `*.vercel.app` no hay subdominios propios que revisar; al pasar a un dominio propio, comprobar que todos sus subdominios sirven HTTPS (ver `security-checklist.md`).
- [x] Prueba de humo en incógnito (2026-11-10): entrar con Google y con GitHub, elegir nombre en `/acceso/nombre`, jugar una partida, guardarla y verla en la ficha y en `/salon`. Pendiente: probar un registro por correo cuando haya SMTP.

## Cambios futuros del esquema

Desde el 2026-11-09, **todo cambio en la base de dev se hace con una migración** (`apply_migration` del MCP): esquema, permisos, políticas, funciones, triggers, índices y datos de referencia como las filas de `games`. `execute_sql` solo se usa para leer y comprobar. Los datos de prueba temporales no son migraciones.

Cada migración se guarda también, con el mismo SQL y el mismo nombre, como `supabase/produccion/NN-<nombre>.sql`, empezando por `03-` y en el orden en que se aplicó en dev. Tú la ejecutas en el SQL Editor de producción, en ese orden, y `02-verificacion.sql` debe dar la salida de `02-verificacion-esperado.tsv`, que se actualiza con la de dev en cada migración.

Los cambios del panel (Auth, proveedores, Rate Limits, plantillas) no son SQL: se añaden a las listas de este archivo.

| Archivo                      | Migración de dev                | Aplicada en producción |
| ---------------------------- | ------------------------------- | ---------------------- |
| `03-partidas_acumuladas.sql` | `partidas_acumuladas` (SPEC 27) | Sí (2026-11-10)        |

# Supabase de producción

Cómo llevar a producción la estructura y la configuración del proyecto de desarrollo (`zlsnmrbgsdxzvpoxlghx`). Claude no tiene acceso a producción: prepara los archivos y tú los aplicas. Preparado el 2026-11-09.

- **Datos:** solo la estructura y el catálogo de `games`. Producción arranca sin usuarios, partidas, puntuaciones ni nombres de jugador.
- **Despliegue en Vercel:** todavía no. Lo que depende de la URL final está al final, en «Al desplegar en Vercel».
- **Archivos** (en `supabase/produccion/`):
  - `01-esquema.sql`: esquema completo, idempotente y en una transacción.
  - `02-verificacion.sql`: consulta de solo lectura que describe el esquema.
  - `02-verificacion-esperado.tsv`: su salida en dev (73 filas), para comparar.

## H. Antes de empezar: aislar producción de Claude

- [ ] Crear producción en **otra organización** de Supabase y no autorizar en ella el MCP. `.mcp.json` fija `project_ref` de dev, pero el token OAuth del MCP pertenece a la cuenta, y la URL incluye `features=account`.
- [ ] (Opcional) Quitar `account` de `features` en `.mcp.json`. Claude no lo usa.
- [ ] No pegar nunca en el chat claves, contraseñas ni la cadena de conexión de producción. La salida de `02-verificacion.sql` sí se puede pegar: no contiene secretos.

## 1. Esquema (SQL Editor de producción)

- [ ] Pegar `01-esquema.sql` entero y ejecutarlo. Debe terminar sin errores. Si falla a la mitad, no se aplica nada, porque va en una transacción.
- [ ] Pegar `02-verificacion.sql`, ejecutarlo y comparar el resultado con `02-verificacion-esperado.tsv`: deben salir las mismas 73 filas. Diferencias que hay que investigar:
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
- [ ] En **Advisors > Security** y **Performance** solo aparecen los avisos aceptados en dev: `auth_leaked_password_protection` (si no es Pro), `rls_enabled_no_policy` en `partidas` y `jugadores` y, cuando haya datos, `unused_index` en `scores_user_id_idx`. `unindexed_foreign_keys` en `partidas.game_id` también está aceptado.

## Al desplegar en Vercel (pendiente)

`https://TU-DOMINIO` es la URL de producción, todavía sin decidir.

- [ ] **Authentication > URL Configuration**: Site URL `https://TU-DOMINIO` y Redirect URLs `https://TU-DOMINIO/**`. Hasta entonces, la Site URL que trae el proyecto no importa, porque nadie usa producción.
- [ ] **Google Cloud:** añadir el origen JavaScript autorizado `https://TU-DOMINIO` y **publicar** la pantalla de consentimiento (en modo de prueba solo entran los usuarios de prueba).
- [ ] **GitHub:** cambiar la Homepage URL de la OAuth App a `https://TU-DOMINIO`.
- [ ] **Vercel > Environment Variables**, solo en **Production**:
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://<REF-PROD>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = la `sb_publishable_…` de producción
  - `SUPABASE_SECRET_KEY` = la `sb_secret_…` de producción, marcada como **Sensitive**
  - `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL`
  - `SUPABASE_DB_PASSWORD` no hace falta: la app no la usa.
  - Preview y Development, con los valores de dev.
- [ ] HSTS lleva `includeSubDomains`: comprobar que todos los subdominios de `TU-DOMINIO` sirven HTTPS (ver `security-checklist.md`).
- [ ] Prueba de humo: entrar con Google o GitHub, elegir nombre en `/acceso/nombre`, jugar una partida, guardarla y verla en `/salon`. Probar también un registro por correo, si ya hay SMTP.

## Cambios futuros del esquema

Desde el 2026-11-09, **todo cambio en la base de dev se hace con una migración** (`apply_migration` del MCP): esquema, permisos, políticas, funciones, triggers, índices y datos de referencia como las filas de `games`. `execute_sql` solo se usa para leer y comprobar. Los datos de prueba temporales no son migraciones.

Cada migración se guarda también, con el mismo SQL y el mismo nombre, como `supabase/produccion/NN-<nombre>.sql`, empezando por `03-` y en el orden en que se aplicó en dev. Tú la ejecutas en el SQL Editor de producción, en ese orden, y `02-verificacion.sql` debe dar la salida de `02-verificacion-esperado.tsv`, que se actualiza con la de dev en cada migración.

Los cambios del panel (Auth, proveedores, Rate Limits, plantillas) no son SQL: se añaden a las listas de este archivo.

| Archivo           | Migración de dev | Aplicada en producción |
| ----------------- | ---------------- | ---------------------- |
| (ninguna todavía) |                  |                        |

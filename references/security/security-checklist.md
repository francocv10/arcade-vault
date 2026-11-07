# Checklist de seguridad

Medidas mínimas antes de abrir la app. La SPEC 21 (`specs/21-medidas-seguridad-basicas.md`) cierra lo que faltaba. Comprobado el 2026-11-07.

## Puntos

- [x] **RLS en `games` y `scores`.** Las dos tablas tienen `relrowsecurity = true`, y la vista `leaderboard` usa `security_invoker`.
- [x] **Longitud mínima de 8.** Fijada en **Authentication > Providers > Email** y exigida también en cliente.
- [x] **Composición de contraseña.** El panel y `validarClaveNueva` exigen minúscula, mayúscula, dígito y símbolo. Un `POST` directo a `/auth/v1/signup` con `abcdefgh` o `Abc1!` responde `weak_password`.
- [ ] **Contraseñas filtradas.** Sin activar: Supabase la reserva al plan Pro. La composición no la sustituye, porque `Password1!` cumple la regla y está en cualquier lista de filtradas. Es un riesgo aceptado.
- [x] **Límite de registros.** Revisado sin cambiar nada: 30 peticiones cada 5 minutos por IP (ver «Rate Limits»).
- [x] **Cabeceras en Next.js.** `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy` en todas las rutas, desde `next.config.ts`.
- [x] **Avisos del panel.** Corregidos con las migraciones `revoke_rls_auto_enable_execute` y `add_scores_user_id_index` (ver «Avisos corregidos»).
- [x] **Protección de rutas.** `proxy.ts` exige sesión en `/acceso/nombre` y `/acceso/nueva-clave`, y saca de `/acceso` a quien ya la tiene.

## Rate Limits

Valores de **Authentication > Rate Limits** el 2026-11-07, sin modificar:

| Límite                                | Valor                       | Ámbito   |
| ------------------------------------- | --------------------------- | -------- |
| Envío de correos                      | 2 por hora                  | Proyecto |
| Envío de SMS                          | 30 por hora                 | Proyecto |
| Refresco de token                     | 150 cada 5 min (1800/h)     | IP       |
| Verificación de token (OTP y enlaces) | 30 cada 5 min (360/h)       | IP       |
| Usuarios anónimos                     | 30 por hora                 | IP       |
| Registros e inicios de sesión         | 30 cada 5 min (360/h)       | IP       |
| Registros e inicios de sesión Web3    | 30 cada 5 min               | IP       |
| Intervalo mínimo por usuario          | 60 s (solo con SMTP propio) | Usuario  |
| Reenvío de IP                         | Desactivado                 | Proyecto |

El panel no tiene un interruptor para el límite de registros: se considera activo porque tiene un valor fijado, pero no se ha comprobado superándolo. El reenvío de IP no hace falta, porque el registro y el acceso salen del navegador y cuentan con la IP de cada jugador.

## Avisos corregidos

La tabla de abajo es la exportación del asesor de seguridad del 2026-11-06. Los dos avisos se corrigieron con `revoke_rls_auto_enable_execute`, y `get_advisors` de seguridad ya no devuelve ninguno.

El aviso INFO de rendimiento por `scores_user_id_fkey` se corrigió con `add_scores_user_id_index`. Queda un aviso INFO `unused_index` sobre `scores_user_id_idx`, aceptado: ninguna consulta filtra hoy por `user_id` y el índice sirve para la clave foránea.

| name                                               | title                                                 | level | facing   | categories   | description                                                                                                                                                                                                              | detail                                                                                                                                                                                                                               | remediation                                                                                                            | metadata                                                                                                 | cache_key                                                                  | observed_at              |
| -------------------------------------------------- | ----------------------------------------------------- | ----- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| anon_security_definer_function_executable          | Public Can Execute SECURITY DEFINER Function          | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public.       | Function `public.rls_auto_enable()` can be executed by the `anon` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional.          | https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable          | {"schema":"public","name":"rls_auto_enable","language":"plpgsql","arguments":"","security_definer":true} | anon_security_definer_function_executable_public_rls_auto_enable_          | 2026-11-06T23:54:54.655Z |
| authenticated_security_definer_function_executable | Signed-In Users Can Execute SECURITY DEFINER Function | WARN  | EXTERNAL | ["SECURITY"] | Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it. | Function `public.rls_auto_enable()` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/rls_auto_enable`. Revoke `EXECUTE` or switch it to `SECURITY INVOKER` if that is not intentional. | https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable | {"schema":"public","name":"rls_auto_enable","language":"plpgsql","arguments":"","security_definer":true} | authenticated_security_definer_function_executable_public_rls_auto_enable_ | 2026-11-06T23:54:54.655Z |

# Registro de auditorías de seguridad

Lo mantiene el agente `security-auditor`. Este archivo se versiona en un repositorio público: sin secretos, datos personales ni pasos de explotación.

## Estado por área

| Área                      | Estado        | Última auditoría | Notas                                                                                                                        |
| ------------------------- | ------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Base de datos y Auth      | Con hallazgos | 2026-11-07       | RLS, políticas, vista, funciones, Storage, Auth y API como se documentan. SEG-007 y SEG-008. El panel sigue sin comprobar.   |
| Secretos y datos del repo | Con hallazgos | 2026-11-06       | Sin secretos en el repo ni en el historial. SEG-001. El build de `.next/static` revisado es anterior al último commit.       |
| Server Actions            | Con hallazgos | 2026-11-06       | SEG-002. El `score` sin validar es pendiente de la SPEC 22.                                                                  |
| Route Handlers            | Con hallazgos | 2026-11-06       | Sin redirección abierta, también probando en vivo. SEG-003.                                                                  |
| Proxy                     | OK            | 2026-11-06       | Tabla igual a la spec 21. En vivo solo se probó sin sesión y con `next dev`.                                                 |
| Sesión                    | Con hallazgos | 2026-11-06       | Sin `getSession()` en servidor ni `cookies()` en `'use cache'`. SEG-004.                                                     |
| Inyección                 | OK            | 2026-11-06       | Sin sumideros de HTML ni `eval`. El correo de contacto es texto plano y los nombres se pintan como texto con React.          |
| Cabeceras                 | OK            | 2026-11-06       | Las 3 de la spec 21 en páginas, Route Handlers, redirecciones, assets y 404. Comprobado en `next dev`. SEG-006 es solo Info. |
| Dependencias              | Con hallazgos | 2026-11-06       | Producción sin avisos. SEG-005 es solo Info y de desarrollo.                                                                 |
| Clave secreta             | Sin comprobar | 2026-11-06       | `app/lib/supabase/admin.ts` no existe: depende de la SPEC 22.                                                                |

## Hallazgos abiertos

| Id      | Severidad | Certeza    | Ubicación                                                           | Resumen                                                                                                                                                                                                                                                                                                        | Acción                                                                                                 |
| ------- | --------- | ---------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| SEG-001 | Bajo      | Confirmado | `specs/03-about-page-contacto-resend.md:35`, `:85`, `:103`, `:144`  | Un correo personal figura en una spec de un repositorio público, y también en su historial desde el commit `bfc18e9`. Expone la dirección a spam y suplantación, sin necesitar ningún acceso.                                                                                                                  | Decisión del usuario: sustituirlo por un marcador. Quitarlo del historial exige reescribirlo.          |
| SEG-002 | Bajo      | Confirmado | `app/acceso/auth-schema.ts:37`, `app/lib/leaderboard/schema.ts:47`  | Con sesión, `guardarPuntuacion` solo exige que `username` sea un texto de 1 a 10 caracteres: `PATRON_USUARIO` se aplica solo en cliente. Una cuenta puede publicar caracteres invisibles o similares.                                                                                                          | Aplicar `PATRON_USUARIO` en servidor. Se puede añadir a la SPEC 22, que no lo cubre.                   |
| SEG-003 | Bajo      | Hipótesis  | `app/auth/confirm/route.ts:6`, `:26`                                | La ruta sigue activa y, según `CLAUDE.md`, ningún correo enlaza ya a ella. Al no usar PKCE, podría permitir un inicio de sesión forzado en otra cuenta. La SPEC 20 solo razona la conservación de `email`.                                                                                                     | Decisión del usuario: retirarla hasta poder editar las plantillas, o confirmar que debe seguir.        |
| SEG-004 | Bajo      | Hipótesis  | `app/components/nueva-clave-form.tsx:43`                            | Cualquier sesión, no solo la de recuperación, puede fijar una contraseña sin dar la actual. Necesita una sesión ya abierta o robada. Depende de una opción del panel que no se puede consultar.                                                                                                                | Revisar a mano **Secure password change** en el panel y decidir.                                       |
| SEG-005 | Info      | Confirmado | `package.json` (`eslint-config-next`)                               | `npm audit` da 8 avisos moderados encadenados por `minimatch` (GHSA-g3hv-75wg-m249), solo en desarrollo. `--omit=dev` da 0.                                                                                                                                                                                    | No aplicar el arreglo que propone npm, que baja a 15.5.29. Esperar una versión compatible con Next 16. |
| SEG-006 | Info      | Confirmado | `next.config.ts:2`                                                  | `X-Powered-By: Next.js` sigue activo porque no se fija `poweredByHeader: false`. Solo revela el framework.                                                                                                                                                                                                     | Opcional: desactivarlo junto al siguiente cambio de configuración.                                     |
| SEG-007 | Bajo      | Confirmado | `information_schema.role_table_grants`, `pg_default_acl` (`public`) | `anon` y `authenticated` conservan todos los permisos sobre `games`, `scores` y `leaderboard`, y los privilegios por defecto los repiten en tablas y funciones nuevas. RLS frena `UPDATE` y `DELETE`, pero no cubre `TRUNCATE` ni `TRIGGER`. Hoy la API no da una vía para usarlos: es defensa en profundidad. | Spec para dejar solo los permisos necesarios. La SPEC 22 cubre únicamente la escritura en `scores`.    |
| SEG-008 | Bajo      | Confirmado | `public.scores.user_id`, política `scores_select_public`            | La lectura pública de `scores` incluye `user_id`, que la app nunca lee. Hoy ninguna fila lo tiene, pero con la SPEC 22 todas lo tendrían. Permitiría relacionar las puntuaciones de una misma cuenta, sin dar acceso a ella.                                                                                   | Añadir a la SPEC 22 una lectura pública sin esa columna.                                               |

## Riesgos aceptados y pendientes

| Riesgo                                                                             | Spec que lo decide | Condición de revisión                                                       |
| ---------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| **Pendiente:** `guardarPuntuacion` acepta el `score` y, sin sesión, el nombre      | SPEC 22 (Borrador) | Al implementarla, verificar que la escritura directa y la acción se cierran |
| **Pendiente:** `scores_insert_public` abierta, comprobado el 2026-11-07            | SPEC 22 (Borrador) | Al implementarla, verificar que el `INSERT` directo se cierra               |
| `enviarContacto` sin límite de envíos: solo validación y honeypot                  | SPEC 03            | Antes de un lanzamiento público                                             |
| Contraseñas filtradas sin activar                                                  | SPEC 21            | Si se contrata el plan Pro                                                  |
| Aviso INFO `unused_index` sobre `scores_user_id_idx`                               | SPEC 21            | Si cambia el aviso                                                          |
| Sin `Content-Security-Policy`, `Permissions-Policy` ni `Strict-Transport-Security` | SPEC 21            | Antes de un lanzamiento público                                             |
| Sin CAPTCHA                                                                        | SPEC 20 y 21       | Si aparece abuso de bots                                                    |
| `username` editable, no único y nombres fusionados en `leaderboard`                | SPEC 18            | Cuando exista `profiles`                                                    |
| Registro por correo solo para el equipo mientras no haya dominio                   | SPEC 20            | Al conectar Resend                                                          |
| Una partida abierta con una cifra creíble sigue siendo posible                     | SPEC 22 (Borrador) | Al implementarla: su spec lo acepta                                         |

No hay indicios de despliegue en el repositorio ni en los logs de Supabase de las últimas 24 horas del 2026-11-07, así que ninguna condición ha cambiado.

## Revisar a mano

No se pueden consultar desde el agente y no se dan por buenos.

| Punto del panel                                                              | Último valor registrado                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Authentication > Providers > Email:** longitud y composición de contraseña | 8 caracteres, minúscula, mayúscula, dígito y símbolo. Checklist, 2026-11-07 |
| **Authentication > Providers > Email:** Secure password change (SEG-004)     | Sin registrar. `/auth/v1/settings` no la expone y los logs no la aclaran    |
| **Authentication > Rate Limits**                                             | Tabla de `security-checklist.md`, 2026-11-07                                |
| **Authentication > URL Configuration:** Site URL y redirecciones             | Valores de desarrollo en `CLAUDE.md`, sin fecha registrada                  |

## Historial

| Fecha      | Modo  | Rama                                                 | Crítico | Alto | Medio | Bajo | Info | Notas                                                              |
| ---------- | ----- | ---------------------------------------------------- | ------- | ---- | ----- | ---- | ---- | ------------------------------------------------------------------ |
| 2026-11-06 | `app` | `main`                                               | 0       | 0    | 0     | 4    | 2    | Primera auditoría. Abre SEG-001 a SEG-006. Sin `db` todavía.       |
| 2026-11-07 | `db`  | `creacion-agente-security` (mismo commit que `main`) | 0       | 0    | 0     | 2    | 0    | Primera auditoría `db`. Abre SEG-007 y SEG-008. No cierra ninguno. |

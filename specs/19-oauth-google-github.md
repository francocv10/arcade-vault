# SPEC 19 — Inicio de sesión con Google y GitHub

> **Status:** Borrador
> **Depends on:** SPEC 18 (sesión de Supabase, `proxy.ts`, `AuthProvider`, `/acceso` y reglas de `username`)
> **Date:** 2026-11-03
> **Objective:** Activar los botones GOOGLE y GITHUB de `/acceso` con OAuth de Supabase y pedir un nombre de jugador en el primer acceso a quien todavía no lo tenga.

---

## Por qué existe este spec

La SPEC 18 deja listo el acceso con correo y los botones GOOGLE y GITHUB deshabilitados. OAuth se separa porque depende de credenciales externas, que no deben bloquear el cierre del acceso por correo.

La SPEC 18 no tiene confirmación de correo, así que OAuth no es necesario para registrarse. Sí da una vía de entrada a quien no puede recuperar su contraseña mientras no haya dominio, porque OAuth no envía correos.

Google da un nombre completo y GitHub un login, y ninguno cumple las reglas de `username`. Por eso quien entra por primera vez elige su nombre.

---

## Alcance

**In:**

- Requisito previo (manual, del usuario): crear las apps OAuth de Google y GitHub y activar ambos proveedores en Supabase.
- Botones GOOGLE y GITHUB activos en `/acceso`, con `signInWithOAuth`.
- Route Handler `GET /auth/callback`, que cambia el código por una sesión.
- Pantalla `/acceso/nombre` («Elige tu nombre») para sesiones sin `username`.
- Redirección a `/acceso/nombre` mientras falte `username`.
- Actualizar el mensaje de `email_address_not_authorized` para sugerir Google o GitHub.
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Otros proveedores (Discord, Apple...).
- Vincular o desvincular proveedores a mano desde un perfil.
- Cambiar el nombre después de elegirlo.
- Tabla `profiles`, usuarios únicos y reserva de nombres.
- Avatar o datos del proveedor en la UI.
- Conectar Resend, y la configuración de producción.

---

## Modelo de datos

No hay tablas, columnas ni políticas nuevas. Reutiliza `user_metadata.username` y `PATRON_USUARIO` de la SPEC 18.

Añade a `app/acceso/auth-schema.ts`:

```ts
// Propuesta para el campo de «Elige tu nombre»: conserva los caracteres válidos
// y recorta a 10. Devuelve "" si quedan menos de 3.
export function sugerirUsuario(metadatos: Record<string, unknown>): string;
```

Orden de lectura en los metadatos del proveedor: `user_name`, `preferred_username`, `name`, `full_name`.

El contexto de `AuthProvider` cambia así:

```ts
export interface Usuario {
  id: string;
  name: string; // "" si aún no hay username
  email: string;
  sinNombre: boolean; // sesión OAuth que no ha elegido nombre
}
```

Con `sinNombre`, la barra muestra `JUGADOR ▾`. El fallback `JUGADOR` de la SPEC 18 se traslada a la presentación, y el campo de nombre del modal de `GamePlayer` sigue siendo de solo lectura.

Rutas nuevas:

| Ruta             | Tipo          | Función                                                                        |
| ---------------- | ------------- | ------------------------------------------------------------------------------ |
| `/auth/callback` | Route Handler | `exchangeCodeForSession(code)`; redirige a `/home` o a `/acceso/nombre`        |
| `/acceso/nombre` | Página        | Pide el nombre de jugador y lo guarda con `updateUser({ data: { username } })` |

Cualquier error en el callback, incluida la cancelación en el proveedor, redirige a `/acceso?error=oauth`.

---

## Plan de implementación

Antes de escribir código hay que consultar con `search_docs` las guías vigentes de inicio de sesión con Google y GitHub, de PKCE con `@supabase/ssr` y de vinculación de identidades.

1. **Requisito previo (manual).** Crear la app OAuth de GitHub y el cliente OAuth de Google con la URL de retorno `https://zlsnmrbgsdxzvpoxlghx.supabase.co/auth/v1/callback`. Activar ambos proveedores en Supabase con su ID y su secreto. Los secretos solo viven en el panel de Supabase, nunca en el repositorio. Añadir `http://localhost:3000/auth/callback` a las URL de redirección si el comodín de la SPEC 18 no se mantiene. Verificación: ambos proveedores aparecen activos en el panel.
2. **Callback.** Crear `app/auth/callback/route.ts`. Con el código, llama a `exchangeCodeForSession`, y redirige a `/home` si hay `username` o a `/acceso/nombre` si falta. Verificación: `/auth/callback` sin código redirige a `/acceso?error=oauth`.
3. **Botones.** En `AuthForm`, quitar `disabled` y `title`, y llamar a `signInWithOAuth` con `provider` y `redirectTo = ${location.origin}/auth/callback`. Mientras se redirige, deshabilitar los dos botones. Mostrar el aviso de `?error=oauth`. Verificación: entrar con GitHub y volver a `/acceso/nombre`.
4. **Elige tu nombre.** Añadir `sugerirUsuario` y `sinNombre`. Crear `app/acceso/nombre/page.tsx` y `app/components/elegir-nombre-form.tsx`, con `.auth-card`, el campo prellenado con la sugerencia y validación con `PATRON_USUARIO`. Al guardar, redirige a `/home`. Sin sesión redirige a `/acceso`; con nombre ya elegido, a `/home`. Verificación: elegir un nombre y verlo en la barra.
5. **Obligar a elegir nombre.** En `AuthProvider`, con `sinNombre`, redirigir a `/acceso/nombre` desde cualquier ruta salvo esa misma. Se puede cerrar sesión desde allí. Verificación: abandonar la pantalla, navegar a `/biblioteca` y volver a `/acceso/nombre`.
6. **Puntuaciones.** Con sesión sin `username`, `guardarPuntuacion` devuelve error y no inserta. Verificación: forzando el caso, no se crea ninguna fila con nombre vacío.
7. **Mensaje y documentación.** Cambiar el texto de `email_address_not_authorized` a `[ERR] Aún no podemos enviar correos a esta dirección. Entra con Google o GitHub, o juega como invitado.` Actualizar `CLAUDE.md`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] GOOGLE y GITHUB están activos y llevan al proveedor correspondiente.
- [ ] La primera entrada con cada proveedor lleva a `/acceso/nombre` con una sugerencia válida o con el campo vacío.
- [ ] El nombre elegido sigue `PATRON_USUARIO`, se guarda en `user_metadata.username` y aparece en la barra.
- [ ] Las siguientes entradas con el mismo proveedor llevan a `/home` y conservan el nombre elegido.
- [ ] Con una sesión sin nombre, navegar a otra ruta redirige a `/acceso/nombre`.
- [ ] Cancelar en el proveedor lleva a `/acceso?error=oauth` con un aviso legible.
- [ ] `/auth/callback` sin código o con un código inválido lleva a `/acceso?error=oauth`.
- [ ] Una puntuación guardada con una cuenta OAuth crea una fila con su `user_id` y su nombre en mayúsculas.
- [ ] Entrar por OAuth con el correo de una cuenta existente abre esa misma cuenta y conserva su `username`.
- [ ] En el repositorio no aparece ningún secreto de cliente OAuth.
- [ ] No hay errores nuevos en consola en `/acceso`, `/acceso/nombre` y `/home`.
- [ ] `CLAUDE.md` describe el callback, `/acceso/nombre` y `sinNombre`.

---

## Decisiones

- **Sí:** Google y GitHub (decisión del usuario), separados de la SPEC 18.
- **Sí:** pantalla «Elige tu nombre» en el primer acceso (decisión del usuario). **No:** nombre automático del proveedor, que daría nombres recortados y sin forma de cambiarlos.
- **Sí:** nombre obligatorio para seguir con la sesión, con salida mediante CERRAR SESIÓN. Así ninguna sesión llega al ranking sin nombre.
- **Sí:** `/auth/callback` separado de `/auth/confirm`. Uno cambia un código PKCE y el otro un `token_hash`.
- **Sí:** vinculación automática de identidades de Supabase, con el riesgo que añade la falta de confirmación de correo (ver Riesgos).
- **No:** parámetro `next` en el callback, por el mismo motivo que en la SPEC 18.
- **No:** tabla `profiles`: el nombre sigue en `user_metadata` (decisión del usuario).

---

## Riesgos

| Riesgo                                                                                                                                                                                                           | Mitigación                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase actualiza los metadatos del proveedor en cada acceso y podría pisar `username`                                                                                                                          | Comprobarlo en el paso 3 entrando dos veces. Si ocurre, parar y replantear dónde se guarda el nombre antes de seguir.                                   |
| La cuenta de Google queda en modo de prueba y solo admite usuarios de prueba                                                                                                                                     | Paso manual del usuario. Publicar la pantalla de consentimiento antes de abrir el acceso.                                                               |
| Si GitHub oculta el correo del usuario, Supabase puede rechazar el acceso                                                                                                                                        | Pedir el permiso `user:email` (por defecto en Supabase) y mostrar el aviso de `?error=oauth`.                                                           |
| Apropiación previa de cuenta: sin confirmación, alguien registra el correo de otra persona y, cuando esta entra con Google o GitHub, la identidad se vincula a esa cuenta y quien la creó conserva su contraseña | Riesgo a aceptar antes de implementar: la cuenta solo guarda puntuaciones. Activar **Confirm email** y conectar Resend antes de un lanzamiento público. |
| La redirección de `sinNombre` crea un bucle                                                                                                                                                                      | Excluir `/acceso/nombre` y comprobar el caso en el paso 5.                                                                                              |
| `redirectTo` no coincide con las URL permitidas y Supabase vuelve a la Site URL                                                                                                                                  | Mantener `http://localhost:3000/**` y añadir la URL de producción al desplegar.                                                                         |
| Probar desde el móvil en `192.168.1.19` no vuelve a la app                                                                                                                                                       | Añadir `http://192.168.1.19:3000/**` a las URL permitidas si hace falta.                                                                                |

---

## Qué **no** está en este spec

- Otros proveedores de OAuth.
- Vincular o desvincular proveedores a mano.
- Cambiar el nombre después de elegirlo.
- Tabla `profiles`, usuarios únicos y reserva de nombres.
- Avatares o datos del proveedor en la UI.
- Conectar Resend y la configuración de producción.

Cada uno de ellos, si se aborda, va en su propio spec.

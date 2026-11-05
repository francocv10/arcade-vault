# SPEC 20 — Confirmación de correo al crear una cuenta

> **Status:** Aprobado
> **Depends on:** SPEC 18 (registro, `AuthForm`, `/auth/confirm` y `mensajeAuth`), SPEC 19 (vinculación de identidades y `ExigirNombre`)
> **Date:** 2026-11-04
> **Objective:** Exigir que quien crea una cuenta con correo y contraseña la confirme con un enlace enviado a ese correo antes de poder entrar.

---

## Por qué existe este spec

La SPEC 18 desactivó **Confirm email** para que cualquier jugador pudiera registrarse sin dominio propio. Ahora el usuario prefiere exigir la confirmación, y esta spec sustituye esa decisión.

Con la confirmación desactivada, alguien puede registrar el correo de otra persona. Esa dirección queda marcada como confirmada, y su dueño puede acabar compartiendo cuenta con quien la creó al entrar por OAuth (riesgo aceptado en la SPEC 19). Con la confirmación activa, las cuentas nuevas ya no tienen ese problema: según la documentación de Supabase, al vincular una identidad se eliminan las identidades sin confirmar de esa cuenta.

**Consecuencia aceptada por el usuario:** el proyecto no tiene dominio, así que el correo integrado de Supabase solo entrega a los miembros del equipo. Hasta conectar Resend, **solo el equipo puede registrarse con correo**. Los demás reciben `email_address_not_authorized`, cuyo mensaje ya sugiere Google, GitHub o jugar como invitado.

Cuentas existentes: la base tiene 3 cuentas y ninguna sin confirmar (consultado el 2026-11-04), así que activar la opción no bloquea a nadie.

---

## Alcance

**In:**

- Configuración del panel (pasos manuales del usuario): plantilla «Confirm signup» en español y **Confirm email** activado.
- `/auth/confirm` acepta también `type=email`, abre la sesión y redirige a `/home`.
- Estado «REVISA TU CORREO» dentro de la tarjeta de `AuthForm`, con el correo de destino, REENVIAR ENLACE y VOLVER A INICIAR SESIÓN.
- Reenvío del enlace con `auth.resend`.
- Iniciar sesión con una cuenta sin confirmar lleva a ese mismo estado, con un texto propio.
- El botón del registro pasa de «CREAR Y JUGAR» a «CREAR CUENTA», porque ya no entra en el juego.
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Conectar Resend como SMTP de Supabase y comprar o verificar un dominio.
- Configuración de producción: Site URL y redirecciones.
- Pantalla o ruta propia para la confirmación.
- Código de 6 dígitos como alternativa al enlace.
- Reconfirmar las 3 cuentas existentes.
- Cambiar de correo desde un perfil.
- Cambios en OAuth: Google y GitHub ya verifican el correo y no pasan por este flujo.
- CAPTCHA.

---

## Modelo de datos

No hay tablas, columnas ni políticas nuevas. No se regeneran `database.types.ts`. `app/acceso/auth-schema.ts` no cambia: `email_not_confirmed` no llega a `mensajeAuth` porque `entrar` lo atiende antes.

### Estado nuevo en `AuthForm`

```ts
type ConfirmacionPendiente = {
  correo: string;
  motivo: "registro" | "acceso";
};
const [pendiente, setPendiente] = useState<ConfirmacionPendiente | null>(null);
```

### Textos de «REVISA TU CORREO»

| `motivo`   | Texto                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `registro` | `[OK] Te hemos enviado un enlace a <correo> para confirmar tu cuenta. Si ese correo ya tiene cuenta, inicia sesión.` |
| `acceso`   | `Tu cuenta aún no está confirmada. Pulsa REENVIAR ENLACE para recibir otro en <correo>.`                             |
| reenviado  | `[OK] Enlace reenviado. Revisa también la carpeta de spam.`                                                          |

### Destinos de `/auth/confirm`

| `type`         | Con `token_hash` válido | Si falla               |
| -------------- | ----------------------- | ---------------------- |
| `recovery`     | `/acceso/nueva-clave`   | `/acceso?error=enlace` |
| `email`        | `/home`                 | `/acceso?error=enlace` |
| cualquier otro | —                       | `/acceso?error=enlace` |

El destino sigue saliendo de una tabla interna, nunca de un parámetro de la URL.

---

## Plan de implementación

Antes de escribir código hay que leer la guía de `route.ts` en `node_modules/next/dist/docs/`. El estado nuevo se diseña con `/frontend-design`, reutilizando `.auth-ok`, `.auth-intro` y `.btn`.

El orden importa: **Confirm email** se activa al final. Si se activara antes, `signUp` respondería sin sesión y el código actual lo mostraría como un error general.

1. **Plantilla (manual, en el panel).** Traducir «Confirm signup» al español con el enlace `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Verificación: la plantilla guardada no contiene `{{ .ConfirmationURL }}`.
2. **Enlace de confirmación.** En `app/auth/confirm/route.ts`, sustituir la comprobación de `recovery` por una tabla de tipos y destinos, y pasar el `type` validado a `verifyOtp`. Verificación: `/auth/confirm?type=email` sin `token_hash` y `/auth/confirm?type=signup&token_hash=x` redirigen a `/acceso?error=enlace`; `recovery` funciona como antes.
3. **Estado «REVISA TU CORREO».** Añadir a `app/components/auth-form.tsx` el componente `RevisaCorreo`, con el mismo patrón que `RecuperarClave`, y mostrarlo cuando `pendiente` no sea nulo. El texto va en `role="status"`. Verificación: forzando `pendiente`, el estado se ve y se usa con teclado a 320 px.
4. **Reenvío.** REENVIAR ENLACE llama a `auth.resend({ type: "signup", email })`, se deshabilita mientras envía y muestra los errores con `mensajeAuth` en un bloque `role="alert"`. Verificación: `over_email_send_rate_limit` muestra su mensaje y no rompe la pantalla.
5. **Registro.** En `registrar`, sin error y sin sesión, limpiar la contraseña y fijar `pendiente` con `motivo: "registro"`. Con sesión, conservar la rama actual. Con error, conservar el mensaje y lo escrito. Cambiar el texto del botón a «CREAR CUENTA» y «CREANDO CUENTA…». Verificación: `npx tsc --noEmit` sin errores.
6. **Acceso sin confirmar.** En `entrar`, con `error.code === "email_not_confirmed"`, limpiar la contraseña y fijar `pendiente` con `motivo: "acceso"`, sin enviar nada. Verificación en el paso 8.
7. **Limpieza.** VOLVER A INICIAR SESIÓN pone `pendiente` a `null` y deja la pestaña INICIAR SESIÓN con el correo escrito. Como `<Activity>` conserva el estado, `pendiente` también se limpia al detectar una sesión.
8. **Activar (manual, en el panel).** Activar **Confirm email**. Recorrer el flujo con un correo del equipo y comprobar que una contraseña errónea sobre una cuenta sin confirmar da `invalid_credentials`, no `email_not_confirmed`. Si no fuera así, el acceso revelaría qué correos existen: parar y replantear el paso 6.
9. **Documentación.** Actualizar en `CLAUDE.md` la lista de specs, `/auth/confirm`, `AuthForm`, la configuración de Auth, la limitación del correo sin dominio y el riesgo aceptado de la SPEC 19.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] **Confirm email** está activado y la plantilla «Confirm signup» está en español con el enlace a `/auth/confirm`.
- [ ] Registrarse con un correo del equipo no abre sesión, muestra «REVISA TU CORREO» con ese correo y borra la contraseña escrita.
- [ ] El correo llega en español y su enlace apunta a `/auth/confirm?token_hash=…&type=email`.
- [ ] Pulsar el enlace abre la sesión, lleva a `/home` y muestra `NOMBRE ▾` con el nombre elegido al registrarse.
- [ ] Reutilizar o manipular el enlace lleva a `/acceso?error=enlace` y muestra un aviso.
- [ ] Iniciar sesión con la contraseña correcta en una cuenta sin confirmar muestra «REVISA TU CORREO» con el texto de `acceso` y no abre sesión.
- [ ] Iniciar sesión con una contraseña errónea en una cuenta sin confirmar muestra `[ERR] Correo o contraseña incorrectos.`
- [ ] REENVIAR ENLACE envía un correo nuevo, y su enlace confirma la cuenta.
- [ ] Reenviar por encima del límite muestra `[ERR] Se ha alcanzado el límite de correos. Inténtalo dentro de un rato.` sin romper la pantalla.
- [ ] Registrarse con un correo que ya tiene cuenta muestra el mismo «REVISA TU CORREO» y no abre sesión ni envía correo.
- [ ] Registrarse con un correo ajeno al equipo muestra el mensaje de `email_address_not_authorized`, conserva lo escrito y no deja una cuenta en `auth.users`. _Requiere un correo real ajeno al equipo, con permiso de su dueño._
- [ ] VOLVER A INICIAR SESIÓN regresa a la pestaña INICIAR SESIÓN con el correo escrito.
- [ ] Tras confirmar, cerrar sesión y volver a `/acceso` no muestra «REVISA TU CORREO».
- [ ] Las cuentas existentes inician sesión como antes.
- [ ] Google, GitHub y la recuperación de contraseña funcionan como antes.
- [ ] Los enlaces de `recovery` siguen llevando a `/acceso/nueva-clave`.
- [ ] «REVISA TU CORREO» se usa solo con teclado y sin scroll horizontal a 320 px de ancho.
- [ ] No hay errores nuevos en consola en `/acceso` ni en `/home`.
- [ ] `CLAUDE.md` describe la confirmación de correo y quién puede registrarse hasta conectar Resend.

---

## Decisiones

- **Sí:** exigir confirmación (decisión del usuario). Sustituye a la decisión «No: confirmación de correo» de la SPEC 18.
- **Sí:** activarla ya, sin dominio (decisión del usuario). **No:** dejar el código listo con el panel apagado, que mantendría abierto el riesgo de la SPEC 19.
- **Sí:** «REVISA TU CORREO» dentro de la tarjeta de `AuthForm` (decisión del usuario). **No:** ruta propia, que obligaría a llevar el correo en la URL o en almacenamiento.
- **Sí:** el enlace abre la sesión y entra en `/home` (decisión del usuario). **No:** volver a `/acceso` y pedir la contraseña, un paso más sin ventaja real.
- **Sí:** un correo duplicado ve el mismo «REVISA TU CORREO» (decisión del usuario). Supabase ya responde sin error ni correo, y así el registro deja de revelar qué correos existen. **No:** detectar `identities` vacío.
- **Sí:** `/auth/confirm` para los dos tipos, con `token_hash`. Es el patrón SSR ya usado en la recuperación. **No:** `{{ .ConfirmationURL }}`, que pasa por el dominio de Supabase y no por nuestra tabla de destinos.
- **Sí:** tipo `email`, el que indica la documentación vigente para la plantilla. **No:** aceptar `signup`.
- **Sí:** el acceso sin confirmar no reenvía solo. El jugador decide, y así intentar entrar no gasta el límite de correos.
- **Sí:** cambiar el botón a «CREAR CUENTA». «CREAR Y JUGAR» promete una entrada que ya no ocurre.
- **Sí:** conservar la rama de `signUp` con sesión. Si alguien desactiva **Confirm email**, el registro sigue funcionando.
- **No:** cuenta atrás para el reenvío. El mensaje de `over_email_send_rate_limit` basta y evita duplicar en cliente un límite que decide Supabase.
- **No:** añadir `email_not_confirmed` a `mensajeAuth`. Su único origen es `entrar`, que lo convierte en estado.
- **No:** migraciones. Esta spec solo cambia configuración y cliente.

---

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Hasta conectar Resend, solo el equipo puede registrarse con correo             | Riesgo aceptado por el usuario. El mensaje de `email_address_not_authorized` ofrece Google, GitHub e invitado.              |
| El límite por hora del correo integrado bloquea las pruebas                    | Agrupar las comprobaciones del paso 8. `over_email_send_rate_limit` tiene mensaje propio.                                   |
| Un filtro de correo abre el enlace antes que el jugador y lo consume           | La cuenta queda confirmada igualmente. El jugador ve `?error=enlace` y puede iniciar sesión con su contraseña.              |
| El enlace caduca                                                               | Iniciar sesión lleva a «REVISA TU CORREO», desde donde se reenvía.                                                          |
| La pestaña original sigue en «REVISA TU CORREO» tras confirmar en otra pestaña | La sesión la crea el servidor, así que esa pestaña no se entera hasta recargar. Se acepta: la pestaña nueva ya está dentro. |
| El enlace se abre en otro dispositivo y abre la sesión allí                    | Comportamiento esperado del `token_hash`. Con `localhost` solo funciona en el mismo equipo hasta desplegar.                 |
| Las 3 cuentas existentes se crearon sin confirmación real                      | Se aceptan: son pocas y se conocen. El riesgo de apropiación de la SPEC 19 solo se cierra para las cuentas nuevas.          |
| Registrarse con un correo ajeno envía un correo a esa persona                  | Inevitable con confirmación. El límite de Supabase lo acota y la cuenta no se activa sin pulsar el enlace.                  |
| La plantilla sigue siendo la de por defecto                                    | El enlace pasaría por `/auth/v1/verify` y no por `/auth/confirm`. El paso 1 y sus criterios lo comprueban.                  |

---

## Qué **no** está en este spec

- Conectar Resend, y comprar o verificar un dominio.
- Configuración de producción.
- Ruta propia para la confirmación.
- Código de 6 dígitos.
- Reconfirmar las cuentas existentes.
- Cambiar de correo desde un perfil.
- Cambios en OAuth.
- CAPTCHA.

Cada uno de ellos, si se aborda, va en su propio spec.

# SPEC 20 — Confirmación de correo al crear una cuenta

> **Status:** Implementado (reabierta el 2026-11-05 con la plantilla por defecto). **Confirm email** ya está activo y el enlace abre la sesión, comprobado con un correo real. Los pasos 2 a 9 y 11 están fusionados en `main` y el paso 1 está comprobado; faltan los 4 criterios sin marcar, que necesitan correos reales (límite de 2 por hora, aunque en la práctica conviene contar con 1), cuentas de Google o GitHub, o un correo ajeno al equipo.
> **Depends on:** SPEC 18 (registro, `AuthForm`, `/auth/confirm` y `mensajeAuth`), SPEC 19 (vinculación de identidades y `ExigirNombre`)
> **Date:** 2026-11-04
> **Objective:** Exigir que quien crea una cuenta con correo y contraseña la confirme con un enlace enviado a ese correo antes de poder entrar.

---

## Por qué existe este spec

La SPEC 18 desactivó **Confirm email** para que cualquier jugador pudiera registrarse sin dominio propio. Ahora el usuario prefiere exigir la confirmación, y esta spec sustituye esa decisión.

Con la confirmación desactivada, alguien puede registrar el correo de otra persona. Esa dirección queda marcada como confirmada, y su dueño puede acabar compartiendo cuenta con quien la creó al entrar por OAuth (riesgo aceptado en la SPEC 19). Con la confirmación activa, las cuentas nuevas ya no tienen ese problema: según la documentación de Supabase, al vincular una identidad se eliminan las identidades sin confirmar de esa cuenta.

**Consecuencia aceptada por el usuario:** el proyecto no tiene dominio, así que el correo integrado de Supabase solo entrega a los miembros del equipo. Hasta conectar Resend, **solo el equipo puede registrarse con correo**. Los demás reciben `email_address_not_authorized`, cuyo mensaje ya sugiere Google, GitHub o jugar como invitado.

Cuentas existentes: la base tiene 3 cuentas y ninguna sin confirmar (consultado el 2026-11-04), así que activar la opción no bloquea a nadie.

### Por qué se reabre

Esta spec se aplazó el 2026-11-05: sin dominio ni SMTP propio, el panel de Supabase no dejó editar la plantilla «Confirm signup», y el plan dependía de esa edición para usar `token_hash` y `/auth/confirm`.

El nuevo plan no toca la plantilla. Su `{{ .ConfirmationURL }}` pasa por el dominio de Supabase, que debería volver a `emailRedirectTo` con un `code` de PKCE. `/auth/callback` ya canjea esos códigos. En `@supabase/auth-js` 2.118.0, `signUp` y `resend` envían el `code_challenge` y aceptan `emailRedirectTo`.

**Esta vía no está confirmada:** la documentación de Supabase solo describe la de `token_hash`. Por eso el paso 10 la prueba con correos reales, y si falla la spec vuelve a Aplazado.

### Registro con Google y GitHub

Google y GitHub siguen siendo una vía de registro, no solo de acceso: esta spec no los retira ni les añade pasos. Hasta conectar Resend, serán la única forma de crear cuenta para quien no pertenece al equipo. Lo que ocurre depende del correo que devuelve el proveedor:

| Correo del proveedor              | Resultado                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin cuenta en `auth.users`        | Se crea una cuenta nueva sin enviar correo, y `/auth/callback` lleva a `/acceso/nombre`. No hay vinculación.                                                                                |
| Con cuenta confirmada             | La identidad se vincula a esa cuenta, que conserva su nombre y sus puntuaciones.                                                                                                            |
| Con cuenta pendiente de confirmar | Según la documentación de Supabase, la identidad se vincula y se elimina la identidad de correo sin confirmar, así que la contraseña elegida no debería servir. Se comprueba en el paso 10. |

---

## Alcance

**In:**

- Configuración del panel (paso manual del usuario): **Confirm email** activado, con la plantilla «Confirm signup» por defecto.
- `signUp` y `auth.resend` envían `emailRedirectTo` a `/auth/callback?origen=correo`.
- `/auth/callback` abre la sesión del enlace de confirmación, y si falla redirige a `/acceso?error=confirmacion` con un aviso propio.
- `/auth/confirm` acepta también `type=email`, ya hecho en la rama. Queda preparado para usarlo cuando se pueda editar la plantilla.
- Estado «REVISA TU CORREO» dentro de la tarjeta de `AuthForm`, con el correo de destino, REENVIAR ENLACE y VOLVER A INICIAR SESIÓN.
- Reenvío del enlace con `auth.resend`.
- Iniciar sesión con una cuenta sin confirmar lleva a ese mismo estado, con un texto propio.
- El botón del registro pasa de «CREAR Y JUGAR» a «CREAR CUENTA», porque ya no entra en el juego.
- Actualizar `CLAUDE.md`.

**Out of scope (para futuros specs):**

- Conectar Resend como SMTP de Supabase y comprar o verificar un dominio.
- Traducir el correo de confirmación, que sigue en inglés hasta poder editar la plantilla.
- Pasar el enlace a `token_hash` y `/auth/confirm`, que depende de esa misma edición.
- Configuración de producción: Site URL y redirecciones.
- Pantalla o ruta propia para la confirmación.
- Código de 6 dígitos como alternativa al enlace.
- Reconfirmar las 3 cuentas existentes.
- Cambiar de correo desde un perfil.
- Cambios en el flujo de OAuth: Google y GitHub ya verifican el correo y no pasan por este flujo, y siguen permitiendo registrarse (ver «Registro con Google y GitHub»). `/auth/callback` solo añade la rama de `origen=correo`.
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

El destino sigue saliendo de una tabla interna, nunca de un parámetro de la URL. Con la plantilla por defecto ningún correo enlaza aquí todavía: esta tabla queda preparada para cuando se pueda editar.

### Destinos de `/auth/callback`

| `origen`             | Con `code` válido                      | Sin `code` o si falla        |
| -------------------- | -------------------------------------- | ---------------------------- |
| `correo`             | `/home`, o `/acceso/nombre` sin nombre | `/acceso?error=confirmacion` |
| ausente o otro valor | `/home`, o `/acceso/nombre` sin nombre | `/acceso?error=oauth`        |

`origen` solo elige entre dos destinos fijos. `?origen=correo` lo escribe la app en `emailRedirectTo`, y solo cambia qué aviso se muestra.

### Aviso de `?error=confirmacion`

`[ERR] No pudimos abrir la sesión con este enlace. Inicia sesión: si tu cuenta aún no está confirmada, podrás pedir otro enlace.`

Cubre el enlace caducado, el reutilizado y el abierto en otro navegador, porque `/auth/callback` no los distingue. Es válido en los tres casos: iniciar sesión entra si la cuenta ya está confirmada, y si no lleva a «REVISA TU CORREO».

---

## Plan de implementación

Antes de escribir código hay que leer la guía de `route.ts` en `node_modules/next/dist/docs/`. El estado nuevo se diseña con `/frontend-design`, reutilizando `.auth-ok`, `.auth-intro` y `.btn`.

El orden importa: **Confirm email** se activa al final. Si se activara antes, `signUp` respondería sin sesión y el código actual lo mostraría como un error general.

1. **Plantilla (manual, en el panel).** Comprobar, sin cambiar nada, que «Confirm signup» conserva el enlace `{{ .ConfirmationURL }}`. Verificación: la plantilla guardada contiene esa variable.
2. **Enlace de `/auth/confirm` (hecho en la rama).** En `app/auth/confirm/route.ts`, sustituir la comprobación de `recovery` por una tabla de tipos y destinos, y pasar el `type` validado a `verifyOtp`. Verificación: `/auth/confirm?type=email` sin `token_hash` y `/auth/confirm?type=signup&token_hash=x` redirigen a `/acceso?error=enlace`; `recovery` funciona como antes.
3. **Estado «REVISA TU CORREO».** Añadir a `app/components/auth-form.tsx` el componente `RevisaCorreo`, con el mismo patrón que `RecuperarClave`, y mostrarlo cuando `pendiente` no sea nulo. El texto va en `role="status"`. Verificación: forzando `pendiente`, el estado se ve y se usa con teclado a 320 px.
4. **Reenvío.** REENVIAR ENLACE llama a `auth.resend({ type: "signup", email })`, se deshabilita mientras envía y muestra los errores con `mensajeAuth` en un bloque `role="alert"`. Verificación: `over_email_send_rate_limit` muestra su mensaje y no rompe la pantalla.
5. **Registro.** En `registrar`, sin error y sin sesión, limpiar la contraseña y fijar `pendiente` con `motivo: "registro"`. Con sesión, conservar la rama actual. Con error, conservar el mensaje y lo escrito. Cambiar el texto del botón a «CREAR CUENTA» y «CREANDO CUENTA…». Verificación: `npx tsc --noEmit` sin errores.
6. **Acceso sin confirmar.** En `entrar`, con `error.code === "email_not_confirmed"`, limpiar la contraseña y fijar `pendiente` con `motivo: "acceso"`, sin enviar nada. Verificación en el paso 10.
7. **Limpieza.** VOLVER A INICIAR SESIÓN pone `pendiente` a `null` y deja la pestaña INICIAR SESIÓN con el correo escrito. Como `<Activity>` conserva el estado, `pendiente` también se limpia al detectar una sesión.
8. **Redirección del correo.** En `registrar` y en REENVIAR ENLACE, pasar `emailRedirectTo: ${location.origin}/auth/callback?origen=correo` en `options`. Verificación: `npx tsc --noEmit` sin errores, y con **Confirm email** desactivado el registro sigue abriendo la sesión.
9. **Callback y aviso.** En `app/auth/callback/route.ts`, elegir el destino de error con la tabla de «Destinos de `/auth/callback`». Añadir `confirmacion` a los avisos de `?error=` de `app/components/auth-form.tsx`. Verificación: `/auth/callback?origen=correo` sin código redirige a `/acceso?error=confirmacion` y muestra el aviso; `/auth/callback` y `/auth/callback?origen=otro` sin código redirigen a `/acceso?error=oauth`.
10. **Activar y probar (manual, en el panel).** Activar **Confirm email** y registrarse con un correo del equipo. Pulsar el enlace debe abrir la sesión en `/home`. Si no la abre, o el enlace no vuelve a `/auth/callback`, desactivar **Confirm email** y devolver esta spec a Aplazado. Con la opción activa, comprobar también:
    - Una contraseña errónea sobre una cuenta sin confirmar da `invalid_credentials`, no `email_not_confirmed`. Si no fuera así, el acceso revelaría qué correos existen: parar y replantear el paso 6.
    - El enlace de REENVIAR ENLACE también abre la sesión.
    - El enlace abierto en otro navegador muestra el aviso y deja la cuenta confirmada.
    - El registro con Google y GitHub, y la entrada por OAuth con el correo de una cuenta pendiente de confirmar.
11. **Documentación.** Actualizar en `CLAUDE.md` la lista de specs, `/auth/confirm`, `AuthForm`, la configuración de Auth, la limitación del correo sin dominio y el riesgo aceptado de la SPEC 19.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores.
- [x] **Confirm email** está activado y la plantilla «Confirm signup» conserva `{{ .ConfirmationURL }}`. _`mailer_autoconfirm` es `false`. La variable se vio en el HTML de la vista previa del panel, con el inspector del navegador (`<a href="{{ .ConfirmationURL }}">`), y el enlace real pasó por `/auth/v1/verify` y volvió a `/auth/callback?origen=correo`._
- [x] Registrarse con un correo del equipo no abre sesión, muestra «REVISA TU CORREO» con ese correo y borra la contraseña escrita.
- [x] El correo llega con el enlace de Supabase y, al pulsarlo, vuelve a `/auth/callback?origen=correo` con un `code`.
- [x] Pulsar el enlace abre la sesión, lleva a `/home` y muestra `NOMBRE ▾` con el nombre elegido al registrarse. _El enlace real llegó a `/home`; `NOMBRE ▾` se vio con una cuenta de prueba confirmada por `/auth/confirm`._
- [x] Reutilizar o manipular el enlace lleva a `/acceso?error=confirmacion` y muestra el aviso. _Contra el `/auth/v1/verify` real con un token inexistente, que da el mismo error que uno gastado, y con un código rechazado (`flow_state_not_found`) teniendo el verificador PKCE en el navegador._
- [x] Abrir el enlace en otro navegador muestra el mismo aviso, y después iniciar sesión con la contraseña entra en la cuenta. _Con un correo real: `/verify` confirmó la cuenta sin abrir sesión, salió el aviso y la contraseña entró en `/home`._
- [x] `/auth/callback` sin `origen=correo` y sin código sigue llevando a `/acceso?error=oauth`.
- [x] Iniciar sesión con la contraseña correcta en una cuenta sin confirmar muestra «REVISA TU CORREO» con el texto de `acceso` y no abre sesión.
- [x] Iniciar sesión con una contraseña errónea en una cuenta sin confirmar muestra `[ERR] Correo o contraseña incorrectos.` _Contra Supabase real, que responde `invalid_credentials`, con una cuenta de prueba creada por SQL._
- [x] REENVIAR ENLACE envía un correo nuevo, y su enlace confirma la cuenta. _Con un correo real, una hora después del registro._
- [x] Reenviar por encima del límite muestra `[ERR] Se ha alcanzado el límite de correos. Inténtalo dentro de un rato.` sin romper la pantalla. _Con un 429 simulado en el reenvío; el límite real se vio en el registro._
- [x] Registrarse con un correo que ya tiene cuenta muestra el mismo «REVISA TU CORREO» y no abre sesión ni envía correo. _Con una cuenta confirmada: el log da `user_repeated_signup`, sin `mail.send`._
- [ ] Registrarse con un correo ajeno al equipo muestra el mensaje de `email_address_not_authorized`, conserva lo escrito y no deja una cuenta en `auth.users`. _Requiere un correo real ajeno al equipo, con permiso de su dueño._
- [x] VOLVER A INICIAR SESIÓN regresa a la pestaña INICIAR SESIÓN con el correo escrito.
- [x] Tras confirmar, cerrar sesión y volver a `/acceso` no muestra «REVISA TU CORREO».
- [x] Las cuentas existentes inician sesión como antes. _Con una cuenta de prueba confirmada: las 3 cuentas originales ya no existen._
- [ ] Con **Confirm email** activo, registrarse con Google o con GitHub usando un correo sin cuenta crea la cuenta sin enviar correo y lleva a `/acceso/nombre`.
- [ ] Con **Confirm email** activo, entrar con Google o GitHub usando el correo de una cuenta pendiente de confirmar abre esa cuenta y la contraseña elegida al registrarse deja de funcionar.
- [ ] Google, GitHub y la recuperación de contraseña funcionan como antes.
- [x] Los enlaces de `recovery` siguen llevando a `/acceso/nueva-clave`. _Con un token de prueba creado por SQL, sin enviar correo._
- [x] «REVISA TU CORREO» se usa solo con teclado y sin scroll horizontal a 320 px de ancho.
- [x] No hay errores nuevos en consola en `/acceso` ni en `/home`.
- [x] `CLAUDE.md` describe la confirmación de correo y quién puede registrarse hasta conectar Resend.

---

## Decisiones

- **Sí:** exigir confirmación (decisión del usuario). Sustituye a la decisión «No: confirmación de correo» de la SPEC 18.
- **Sí:** activarla ya, sin dominio (decisión del usuario). **No:** dejar el código listo con el panel apagado, que mantendría abierto el riesgo de la SPEC 19.
- **Sí:** «REVISA TU CORREO» dentro de la tarjeta de `AuthForm` (decisión del usuario). **No:** ruta propia, que obligaría a llevar el correo en la URL o en almacenamiento.
- **Sí:** el enlace abre la sesión y entra en `/home` (decisión del usuario). **No:** volver a `/acceso` y pedir la contraseña, un paso más sin ventaja real.
- **Sí:** un correo duplicado ve el mismo «REVISA TU CORREO» (decisión del usuario). Supabase ya responde sin error ni correo, y así el registro deja de revelar qué correos existen. **No:** detectar `identities` vacío.
- **Sí:** plantilla por defecto con `{{ .ConfirmationURL }}` y retorno a `/auth/callback` (decisión del usuario). Se puede hacer sin dominio y sustituye a la decisión anterior de usar `token_hash`. **No:** esperar a tener dominio y Resend, que mantendría abierto el riesgo de la SPEC 19.
- **Sí:** correo en inglés mientras no se pueda editar la plantilla (decisión del usuario, consecuencia de la anterior).
- **Sí:** aviso propio `?error=confirmacion` (decisión del usuario). **No:** reutilizar `?error=oauth`, que hablaría de proveedores a quien se registró con correo.
- **Sí:** marca fija `origen=correo` en `emailRedirectTo`. Es la forma mínima de elegir el aviso sin aceptar un destino desde la URL.
- **Sí:** conservar `type=email` en `/auth/confirm`, que ya está en la rama. Es inofensivo sin un enlace que lo use y evita rehacerlo cuando se pueda editar la plantilla. **No:** revertirlo.
- **Sí:** tipo `email`, el que indica la documentación vigente para la plantilla. **No:** aceptar `signup`.
- **Sí:** el acceso sin confirmar no reenvía solo. El jugador decide, y así intentar entrar no gasta el límite de correos.
- **Sí:** cambiar el botón a «CREAR CUENTA». «CREAR Y JUGAR» promete una entrada que ya no ocurre.
- **Sí:** conservar la rama de `signUp` con sesión. Si alguien desactiva **Confirm email**, el registro sigue funcionando.
- **No:** cuenta atrás para el reenvío. El mensaje de `over_email_send_rate_limit` basta y evita duplicar en cliente un límite que decide Supabase.
- **No:** añadir `email_not_confirmed` a `mensajeAuth`. Su único origen es `entrar`, que lo convierte en estado.
- **No:** migraciones. Esta spec solo cambia configuración y cliente.

---

## Riesgos

| Riesgo                                                                                                | Mitigación                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hasta conectar Resend, solo el equipo puede registrarse con correo                                    | Riesgo aceptado por el usuario. El mensaje de `email_address_not_authorized` ofrece Google, GitHub e invitado.                                                                           |
| Google en modo de prueba solo admite a sus usuarios de prueba                                         | Hasta publicar la pantalla de consentimiento, GitHub es la única vía de registro abierta a cualquiera.                                                                                   |
| El límite por hora del correo integrado bloquea las pruebas                                           | Agrupar las comprobaciones del paso 10. `over_email_send_rate_limit` tiene mensaje propio.                                                                                               |
| Un filtro de correo abre el enlace antes que el jugador y lo consume                                  | La cuenta debería quedar confirmada igualmente. El jugador ve `?error=confirmacion` y puede iniciar sesión con su contraseña.                                                            |
| El enlace caduca                                                                                      | Iniciar sesión lleva a «REVISA TU CORREO», desde donde se reenvía.                                                                                                                       |
| La pestaña original sigue en «REVISA TU CORREO» tras confirmar en otra pestaña                        | La sesión la crea el servidor, así que esa pestaña no se entera hasta recargar. Se acepta: la pestaña nueva ya está dentro.                                                              |
| El enlace se abre en otro navegador o dispositivo                                                     | PKCE necesita el mismo navegador, así que no abre la sesión: muestra `?error=confirmacion` y el jugador inicia sesión. Con `localhost` solo funciona en el mismo equipo hasta desplegar. |
| Las 3 cuentas existentes se crearon sin confirmación real                                             | Se aceptan: son pocas y se conocen. El riesgo de apropiación de la SPEC 19 solo se cierra para las cuentas nuevas.                                                                       |
| Registrarse con un correo ajeno envía un correo a esa persona                                         | Inevitable con confirmación. El límite de Supabase lo acota y la cuenta no se activa sin pulsar el enlace.                                                                               |
| La vía de la plantilla por defecto no está documentada                                                | El paso 10 la prueba con correos reales. Si falla, se desactiva **Confirm email** y la spec vuelve a Aplazado.                                                                           |
| La URL con `?origen=correo` no encaja en las redirecciones permitidas y Supabase vuelve a la Site URL | El paso 10 lo detecta porque no se abre la sesión. `http://localhost:3000/**` debería cubrirla.                                                                                          |
| El correo llega en inglés                                                                             | Riesgo aceptado por el usuario hasta poder editar la plantilla.                                                                                                                          |
| Registrarse y reenviar dejan varios verificadores PKCE y un enlace anterior puede fallar              | Se muestra `?error=confirmacion` y queda el enlace más reciente. El paso 10 comprueba el reenvío.                                                                                        |

---

## Qué **no** está en este spec

- Conectar Resend, y comprar o verificar un dominio.
- Traducir el correo de confirmación.
- Pasar el enlace a `token_hash` y `/auth/confirm`.
- Configuración de producción.
- Ruta propia para la confirmación.
- Código de 6 dígitos.
- Reconfirmar las cuentas existentes.
- Cambiar de correo desde un perfil.
- Cambios en el código de OAuth.
- CAPTCHA.

Cada uno de ellos, si se aborda, va en su propio spec.

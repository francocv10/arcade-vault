"use server";
import {
  esRecuperacionReciente,
  mensajeAuth,
  validarClaveNueva,
} from "@/app/acceso/auth-schema";
import { createClient } from "@/app/lib/supabase/server";
const ERROR_CLAVE_DEBIL = "[ERR] La contraseña es demasiado débil.";
// Mismo texto que AVISOS_URL muestra en /acceso para `error=enlace`.
const ERROR_ENLACE =
  "[ERR] El enlace ha caducado o ya se usó. Solicita uno nuevo.";
// Cambia la contraseña desde /acceso/nueva-clave (spec 23). Es un endpoint
// público: solo una sesión abierta con el enlace de recuperación hace como
// mucho VENTANA_RECUPERACION_SEGUNDOS puede usarlo. La contraseña nunca va a
// un log. `updateUser` usa el cliente de la sesión, no la clave secreta, para
// que Supabase siga aplicando Password Requirements y Secure password change.
export async function cambiarClave(
  clave: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof clave !== "string" || validarClaveNueva(clave) !== null) {
    return { ok: false, error: ERROR_CLAVE_DEBIL };
  }
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims) return { ok: false, error: ERROR_ENLACE };
    const ahora = Math.floor(Date.now() / 1000);
    if (!esRecuperacionReciente(claims.amr, ahora)) {
      return { ok: false, error: ERROR_ENLACE };
    }
    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) return { ok: false, error: mensajeAuth(error.code) };
    // La contraseña ya cambió: un fallo aquí solo se registra, para no hacer
    // creer al usuario que no se guardó.
    const { error: errorCierre } = await supabase.auth.signOut({
      scope: "others",
    });
    if (errorCierre) {
      console.error(
        "cambiarClave: no se cerraron las demás sesiones",
        errorCierre.code ?? errorCierre.message,
      );
    }
    return { ok: true };
  } catch (error) {
    console.error(
      "cambiarClave: fallo inesperado",
      error instanceof Error ? error.name : "desconocido",
    );
    return { ok: false, error: mensajeAuth(undefined) };
  }
}

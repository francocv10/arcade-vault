export const LIMITES_AUTH = {
  usuarioMin: 3,
  usuarioMax: 10,
  claveMin: 8,
} as const;
export const PATRON_USUARIO = /^[A-Za-z0-9_]{3,10}$/;
const CORREO_MAX = 254;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MENSAJE_GENERICO =
  "[ERR] No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.";
const CORREO_DUPLICADO =
  "[ERR] Ya existe una cuenta con ese correo. Inicia sesión.";
const MENSAJES_AUTH = new Map<string, string>([
  ["invalid_credentials", "[ERR] Correo o contraseña incorrectos."],
  ["user_already_exists", CORREO_DUPLICADO],
  ["email_exists", CORREO_DUPLICADO],
  [
    "email_address_not_authorized",
    "[ERR] Aún no podemos enviar correos a esta dirección.",
  ],
  [
    "over_email_send_rate_limit",
    "[ERR] Se ha alcanzado el límite de correos. Inténtalo dentro de un rato.",
  ],
  ["over_request_rate_limit", "[ERR] Demasiados intentos. Espera un momento."],
  ["weak_password", "[ERR] La contraseña es demasiado débil."],
  [
    "same_password",
    "[ERR] La contraseña nueva debe ser distinta de la anterior.",
  ],
]);
function validarCorreo(email: string): string | null {
  const correo = email.trim();
  if (!correo) return "El correo es obligatorio.";
  if (correo.length > CORREO_MAX || !FORMATO_CORREO.test(correo)) {
    return "Introduce un correo válido.";
  }
  return null;
}
export function validarRegistro(datos: {
  username: string;
  email: string;
  password: string;
}): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!datos.username) {
    errores.username = "El usuario es obligatorio.";
  } else if (!PATRON_USUARIO.test(datos.username)) {
    errores.username = `De ${LIMITES_AUTH.usuarioMin} a ${LIMITES_AUTH.usuarioMax} caracteres: letras sin acentos, números y _.`;
  }
  const errorCorreo = validarCorreo(datos.email);
  if (errorCorreo) errores.email = errorCorreo;
  if (!datos.password) {
    errores.password = "La contraseña es obligatoria.";
  } else if (datos.password.length < LIMITES_AUTH.claveMin) {
    errores.password = `Mínimo ${LIMITES_AUTH.claveMin} caracteres.`;
  }
  return errores;
}
// Sin longitud mínima de contraseña: al iniciar sesión solo Supabase decide si
// es correcta, y así un error nunca revela nada sobre la cuenta.
export function validarAcceso(datos: {
  email: string;
  password: string;
}): Record<string, string> {
  const errores: Record<string, string> = {};
  const errorCorreo = validarCorreo(datos.email);
  if (errorCorreo) errores.email = errorCorreo;
  if (!datos.password) errores.password = "La contraseña es obligatoria.";
  return errores;
}
export function mensajeAuth(codigo: string | undefined): string {
  return (codigo && MENSAJES_AUTH.get(codigo)) || MENSAJE_GENERICO;
}

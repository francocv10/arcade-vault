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
    "[ERR] Aún no podemos enviar correos a esta dirección. Entra con Google o GitHub, o juega como invitado.",
  ],
  [
    "email_address_invalid",
    "[ERR] No podemos enviar correos a esta dirección.",
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
// Una sesión OAuth nueva no tiene username hasta que elige su nombre. Exige
// también PATRON_USUARIO (spec 22): `updateUser` por API puede fijar cualquier
// valor sin pasar por `validarUsuario`, y esa cuenta debe volver a elegirlo.
export function tieneUsuario(username: unknown): username is string {
  return typeof username === "string" && PATRON_USUARIO.test(username);
}
// Metadatos del proveedor, en orden de preferencia.
const CLAVES_SUGERENCIA = [
  "user_name",
  "preferred_username",
  "name",
  "full_name",
] as const;
// Propuesta para el campo de «Elige tu nombre»: conserva los caracteres válidos
// y recorta a 10. Devuelve "" si quedan menos de 3.
export function sugerirUsuario(metadatos: Record<string, unknown>): string {
  for (const clave of CLAVES_SUGERENCIA) {
    const valor = metadatos[clave];
    if (typeof valor !== "string") continue;
    const limpio = valor
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, LIMITES_AUTH.usuarioMax);
    if (limpio.length >= LIMITES_AUTH.usuarioMin) return limpio;
  }
  return "";
}
export function validarUsuario(username: string): string | null {
  if (!username) return "El usuario es obligatorio.";
  if (!PATRON_USUARIO.test(username)) {
    return `De ${LIMITES_AUTH.usuarioMin} a ${LIMITES_AUTH.usuarioMax} caracteres: letras sin acentos, números y _.`;
  }
  return null;
}
export function validarCorreo(email: string): string | null {
  const correo = email.trim();
  if (!correo) return "El correo es obligatorio.";
  if (correo.length > CORREO_MAX || !FORMATO_CORREO.test(correo)) {
    return "Introduce un correo válido.";
  }
  return null;
}
// Los símbolos son los de Password Requirements en Supabase, y las letras solo
// cuentan si son ASCII: así cliente y servidor aplican la misma regla.
const REQUISITOS_CLAVE = [
  { patron: /[a-z]/, falta: "una minúscula" },
  { patron: /[A-Z]/, falta: "una mayúscula" },
  { patron: /[0-9]/, falta: "un dígito" },
  { patron: /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/, falta: "un símbolo" },
] as const;
const LISTA_ES = new Intl.ListFormat("es", {
  style: "long",
  type: "conjunction",
});
// null si la contraseña es válida; si no, el texto de .field-error.
export function validarClaveNueva(password: string): string | null {
  if (!password) return "La contraseña es obligatoria.";
  const faltan: string[] = REQUISITOS_CLAVE.filter(
    ({ patron }) => !patron.test(password),
  ).map(({ falta }) => falta);
  if (password.length < LIMITES_AUTH.claveMin) {
    faltan.unshift(`al menos ${LIMITES_AUTH.claveMin} caracteres`);
  }
  return faltan.length ? `Falta: ${LISTA_ES.format(faltan)}.` : null;
}
export function validarRegistro(datos: {
  username: string;
  email: string;
  password: string;
}): Record<string, string> {
  const errores: Record<string, string> = {};
  const errorUsuario = validarUsuario(datos.username);
  if (errorUsuario) errores.username = errorUsuario;
  const errorCorreo = validarCorreo(datos.email);
  if (errorCorreo) errores.email = errorCorreo;
  const errorClave = validarClaveNueva(datos.password);
  if (errorClave) errores.password = errorClave;
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

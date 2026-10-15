export type CampoContacto = "nombre" | "correo" | "mensaje";

export interface ValoresContacto {
  nombre: string;
  correo: string;
  mensaje: string;
}

export interface EstadoContacto {
  estado: "inicial" | "exito" | "error";
  nombre?: string; // nombre enviado, para el mensaje de éxito
  errores?: Partial<Record<CampoContacto, string>>;
  valores?: ValoresContacto; // se conserva si falla
  mensajeError?: string; // error de envío de Resend
}

export const LIMITES = {
  nombreMax: 80,
  correoMax: 254,
  mensajeMin: 10,
  mensajeMax: 2000,
} as const;

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultadoValidacion =
  | { ok: true; valores: ValoresContacto }
  | {
      ok: false;
      errores: Partial<Record<CampoContacto, string>>;
      valores: ValoresContacto;
    };

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

export function validarContacto(formData: FormData): ResultadoValidacion {
  const valores: ValoresContacto = {
    // Sin saltos de línea: el nombre va en el asunto del correo (evita inyección de cabeceras).
    nombre: texto(formData.get("nombre")).replace(/[\r\n]+/g, " ").trim(),
    correo: texto(formData.get("correo")).trim(),
    mensaje: texto(formData.get("mensaje")).trim(),
  };

  const errores: Partial<Record<CampoContacto, string>> = {};

  if (!valores.nombre) {
    errores.nombre = "El nombre es obligatorio.";
  } else if (valores.nombre.length > LIMITES.nombreMax) {
    errores.nombre = `Máximo ${LIMITES.nombreMax} caracteres.`;
  }

  if (!valores.correo) {
    errores.correo = "El correo es obligatorio.";
  } else if (
    valores.correo.length > LIMITES.correoMax ||
    !FORMATO_CORREO.test(valores.correo)
  ) {
    errores.correo = "Introduce un correo válido.";
  }

  if (!valores.mensaje) {
    errores.mensaje = "El mensaje es obligatorio.";
  } else if (valores.mensaje.length < LIMITES.mensajeMin) {
    errores.mensaje = `Escribe al menos ${LIMITES.mensajeMin} caracteres.`;
  } else if (valores.mensaje.length > LIMITES.mensajeMax) {
    errores.mensaje = `Máximo ${LIMITES.mensajeMax} caracteres.`;
  }

  return Object.keys(errores).length > 0
    ? { ok: false, errores, valores }
    : { ok: true, valores };
}

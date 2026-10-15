"use server";

import { Resend } from "resend";
import { validarContacto, type EstadoContacto } from "./contact-schema";

const ERROR_ENVIO = "[ERR] No se pudo enviar el mensaje. Inténtalo de nuevo.";

export async function enviarContacto(
  _estadoPrevio: EstadoContacto,
  formData: FormData,
): Promise<EstadoContacto> {
  // Honeypot: un bot rellena el campo oculto; respondemos éxito sin llamar a Resend.
  const trampa = formData.get("website");
  if (typeof trampa === "string" && trampa.trim() !== "") {
    return { estado: "exito", nombre: "" };
  }

  const resultado = validarContacto(formData);
  if (!resultado.ok) {
    return {
      estado: "inicial",
      errores: resultado.errores,
      valores: resultado.valores,
    };
  }
  const { nombre, correo, mensaje } = resultado.valores;

  const apiKey = process.env.RESEND_API_KEY;
  const para = process.env.CONTACT_TO_EMAIL;
  const de = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !para || !de) {
    console.error(
      "[contacto] Faltan variables de entorno: RESEND_API_KEY, CONTACT_TO_EMAIL o CONTACT_FROM_EMAIL.",
    );
    return {
      estado: "error",
      mensajeError: ERROR_ENVIO,
      valores: resultado.valores,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: de,
      to: para,
      replyTo: correo,
      subject: `[Arcade Vault] Mensaje de ${nombre}`,
      text: `Nombre: ${nombre}\nCorreo: ${correo}\n\nMensaje:\n${mensaje}`,
    });

    if (error) {
      console.error("[contacto] Resend rechazó el envío:", error.name, error.message);
      return {
        estado: "error",
        mensajeError: ERROR_ENVIO,
        valores: resultado.valores,
      };
    }
  } catch (err) {
    console.error("[contacto] Fallo inesperado al enviar:", err);
    return {
      estado: "error",
      mensajeError: ERROR_ENVIO,
      valores: resultado.valores,
    };
  }

  return { estado: "exito", nombre };
}

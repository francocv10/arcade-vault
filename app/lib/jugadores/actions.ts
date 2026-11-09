"use server";
import {
  ERROR_NOMBRE_NO_DISPONIBLE,
  mensajeAuth,
  nombreReservado,
  validarUsuario,
} from "@/app/acceso/auth-schema";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import {
  copiarAMetadatos,
  reservarNombre,
  sincronizarNombre,
} from "./servidor";
// Server Actions de los nombres únicos (spec 24). Son endpoints públicos: los
// argumentos se validan aquí y la sesión sale siempre de las cookies.
// Para el registro: true si el nombre es válido, no reservado y libre. Lanza si
// falla la consulta, para que el formulario muestre el error genérico y no
// llame a signUp. Revela si un nombre existe, pero ya son públicos en el ranking.
export async function nombreDisponible(username: string): Promise<boolean> {
  if (typeof username !== "string" || validarUsuario(username) !== null) {
    return false;
  }
  if (nombreReservado(username)) return false;
  // ilike sin comodines equivale a comparar en minúsculas; `_` es el único
  // comodín que admite PATRON_USUARIO y se escapa.
  const { count, error } = await createAdminClient()
    .from("jugadores")
    .select("id", { count: "exact", head: true })
    .ilike("username", username.replaceAll("_", "\\_"));
  if (error) {
    console.error("nombreDisponible: error de Supabase", error.message);
    throw new Error("No se pudo comprobar el nombre.");
  }
  return (count ?? 0) === 0;
}
// Para /acceso/nombre. Exige sesión con getUser(). Un nombre ya reservado no
// cambia nunca: si la cuenta tiene fila, solo se copia esa fila a los metadatos.
export async function elegirNombre(
  username: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const usuario = data.user;
    if (!usuario) return { ok: false, error: mensajeAuth(undefined) };
    if (typeof username !== "string") {
      return { ok: false, error: mensajeAuth(undefined) };
    }
    const errorFormato = validarUsuario(username);
    if (errorFormato) return { ok: false, error: errorFormato };
    if (nombreReservado(username)) {
      return { ok: false, error: ERROR_NOMBRE_NO_DISPONIBLE };
    }
    const resultado = await reservarNombre(usuario.id, username);
    // Sin log: los nombres son públicos y no hay nada que investigar.
    if (resultado === "ocupado") {
      return { ok: false, error: ERROR_NOMBRE_NO_DISPONIBLE };
    }
    try {
      if (resultado === "ya-tiene") {
        // La cuenta ya tenía nombre: sincronizarNombre copia el de la fila.
        await sincronizarNombre(usuario);
      } else {
        await copiarAMetadatos(usuario.id, username);
      }
    } catch (error) {
      // El nombre ya es suyo en `jugadores`; la copia se repara en la
      // siguiente comprobación de asegurarNombre.
      console.error("elegirNombre: no se copiaron los metadatos", error);
    }
    return { ok: true };
  } catch (error) {
    console.error("elegirNombre: fallo inesperado", error);
    return { ok: false, error: mensajeAuth(undefined) };
  }
}
// Para AuthProvider, una vez por cuenta al abrir sesión. Exige sesión con
// getUser(); sin sesión, o si algo falla, no hace nada y se reintenta en la
// siguiente carga.
export async function asegurarNombre(): Promise<{
  metadatosCambiados: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { metadatosCambiados: false };
    const { metadatosCambiados } = await sincronizarNombre(data.user);
    return { metadatosCambiados };
  } catch (error) {
    console.error("asegurarNombre: fallo inesperado", error);
    return { metadatosCambiados: false };
  }
}

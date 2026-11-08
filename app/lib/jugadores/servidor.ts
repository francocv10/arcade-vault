import "server-only";
import {
  nombreReservado,
  PATRON_USUARIO,
  tieneUsuario,
} from "@/app/acceso/auth-schema";
import { createAdminClient } from "@/app/lib/supabase/admin";
// Nombres únicos y fijos (spec 24). `jugadores` es la fuente de verdad del
// nombre: solo se lee y se escribe aquí, con la clave secreta.
// `user_metadata.username` es una copia para la interfaz.
// Restricción `unique` de `user_id`: un 23505 con este nombre significa que la
// cuenta ya tenía fila; cualquier otro 23505 es el índice de `lower(username)`.
const RESTRICCION_CUENTA = "jugadores_user_id_key";
// Nombre de la cuenta en `jugadores`, o null si no tiene fila.
export async function nombreDeJugador(userId: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("jugadores")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`nombreDeJugador: ${error.message}`);
  return data?.username ?? null;
}
// Inserta la fila. "ocupado" si el nombre ya existe sin distinguir mayúsculas
// (23505 del índice) o está reservado; "ya-tiene" si la cuenta ya tenía fila.
export async function reservarNombre(
  userId: string,
  username: string,
): Promise<"ok" | "ocupado" | "ya-tiene"> {
  if (!PATRON_USUARIO.test(username)) {
    throw new Error("reservarNombre: nombre con formato inválido");
  }
  if (nombreReservado(username)) return "ocupado";
  const { error } = await createAdminClient()
    .from("jugadores")
    .insert({ user_id: userId, username });
  if (!error) return "ok";
  if (error.code === "23505") {
    return error.message.includes(RESTRICCION_CUENTA) ? "ya-tiene" : "ocupado";
  }
  // 23514: el check de reservados de la tabla, por si la lista del código y la
  // de la base de datos llegaran a diferir.
  if (error.code === "23514") return "ocupado";
  throw new Error(`reservarNombre: ${error.message}`);
}
// Copia el nombre de la fila (o null) a `user_metadata.username`. Supabase
// fusiona `user_metadata` en la actualización de administrador, así que los
// demás campos (por ejemplo `full_name`) se conservan.
async function copiarAMetadatos(
  userId: string,
  username: string | null,
): Promise<void> {
  const { error } = await createAdminClient().auth.admin.updateUserById(
    userId,
    { user_metadata: { username } },
  );
  if (error) throw new Error(`copiarAMetadatos: ${error.message}`);
}
// Lo que comparten `/auth/callback` y `asegurarNombre`.
export async function sincronizarNombre(usuario: {
  id: string;
  user_metadata: Record<string, unknown>;
}): Promise<{ nombre: string | null; metadatosCambiados: boolean }> {
  const enMetadatos = usuario.user_metadata?.username;
  const fila = await nombreDeJugador(usuario.id);
  if (fila !== null) {
    // Tiene fila: los metadatos solo pueden ser una copia de ella.
    if (enMetadatos === fila)
      return { nombre: fila, metadatosCambiados: false };
    await copiarAMetadatos(usuario.id, fila);
    return { nombre: fila, metadatosCambiados: true };
  }
  // Sin fila y sin nombre válido (OAuth nuevo): elegirá en /acceso/nombre.
  if (!tieneUsuario(enMetadatos)) {
    return { nombre: null, metadatosCambiados: false };
  }
  const resultado = await reservarNombre(usuario.id, enMetadatos);
  if (resultado === "ok") {
    return { nombre: enMetadatos, metadatosCambiados: false };
  }
  if (resultado === "ya-tiene") {
    // Otra petición de la misma cuenta reservó entre medias: manda su fila.
    const actual = await nombreDeJugador(usuario.id);
    if (actual === null) {
      throw new Error("sincronizarNombre: fila desaparecida tras ya-tiene");
    }
    if (actual === enMetadatos) {
      return { nombre: actual, metadatosCambiados: false };
    }
    await copiarAMetadatos(usuario.id, actual);
    return { nombre: actual, metadatosCambiados: true };
  }
  // Ocupado o reservado: se vacían los metadatos para que elija otro.
  await copiarAMetadatos(usuario.id, null);
  return { nombre: null, metadatosCambiados: true };
}

import { NextResponse, type NextRequest } from "next/server";
import { tieneUsuario } from "@/app/acceso/auth-schema";
import { sincronizarNombre } from "@/app/lib/jugadores/servidor";
import { createClient } from "@/app/lib/supabase/server";
// Destinos cerrados: nunca salen de un parámetro de la URL, así este enlace no
// puede usarse como redirección abierta.
const DESTINO_CON_NOMBRE = "/home";
const DESTINO_SIN_NOMBRE = "/acceso/nombre";
const DESTINO_RECUPERACION = "/acceso/nueva-clave";
const DESTINO_ERROR_OAUTH = "/acceso?error=oauth";
const DESTINO_ERROR_CONFIRMACION = "/acceso?error=confirmacion";
const DESTINO_ERROR_RECUPERACION = "/acceso?error=enlace";
const DESTINOS_ERROR = new Map([
  ["correo", DESTINO_ERROR_CONFIRMACION],
  ["recuperacion", DESTINO_ERROR_RECUPERACION],
]);
function redirigir(destino: string, request: NextRequest) {
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  // Esta respuesta puede llevar las cookies de la sesión recién creada.
  respuesta.headers.set("Cache-Control", "private, no-store");
  return respuesta;
}
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  // `origen` lo escribe la app en los enlaces de sus correos y solo elige entre
  // destinos fijos de este archivo: nunca decide una URL.
  const origen = searchParams.get("origen") ?? "";
  const destinoError = DESTINOS_ERROR.get(origen) ?? DESTINO_ERROR_OAUTH;
  // Sin código también llega quien cancela en el proveedor.
  const code = searchParams.get("code");
  if (!code) return redirigir(destinoError, request);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirigir(destinoError, request);
  if (origen === "recuperacion") {
    return redirigir(DESTINO_RECUPERACION, request);
  }
  return redirigir(
    (await nombreTrasSincronizar(data.user))
      ? DESTINO_CON_NOMBRE
      : DESTINO_SIN_NOMBRE,
    request,
  );
}
// Reserva el nombre de los metadatos o copia el de `jugadores` (spec 24) antes
// de decidir el destino. Si falla, decide con los metadatos como antes:
// AuthProvider vuelve a sincronizar con asegurarNombre al cargar la app, y
// guardarPuntuacion exige la fila de todos modos.
async function nombreTrasSincronizar(usuario: {
  id: string;
  user_metadata: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const { nombre } = await sincronizarNombre(usuario);
    return nombre !== null;
  } catch (error) {
    console.error("auth/callback: no se sincronizó el nombre", error);
    return tieneUsuario(usuario.user_metadata.username);
  }
}

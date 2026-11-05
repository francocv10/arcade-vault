import { NextResponse, type NextRequest } from "next/server";
import { tieneUsuario } from "@/app/acceso/auth-schema";
import { createClient } from "@/app/lib/supabase/server";
// Destinos cerrados: nunca salen de un parámetro de la URL, así este enlace no
// puede usarse como redirección abierta.
const DESTINO_CON_NOMBRE = "/home";
const DESTINO_SIN_NOMBRE = "/acceso/nombre";
const DESTINO_ERROR = "/acceso?error=oauth";
function redirigir(destino: string, request: NextRequest) {
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  // Esta respuesta puede llevar las cookies de la sesión recién creada.
  respuesta.headers.set("Cache-Control", "private, no-store");
  return respuesta;
}
export async function GET(request: NextRequest) {
  // Sin código también llega quien cancela en el proveedor.
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirigir(DESTINO_ERROR, request);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirigir(DESTINO_ERROR, request);
  return redirigir(
    tieneUsuario(data.user.user_metadata.username)
      ? DESTINO_CON_NOMBRE
      : DESTINO_SIN_NOMBRE,
    request,
  );
}

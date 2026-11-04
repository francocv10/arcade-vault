import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
// Destinos cerrados: nunca salen de un parámetro de la URL, así este enlace no
// puede usarse como redirección abierta.
const DESTINO_RECUPERACION = "/acceso/nueva-clave";
const DESTINO_ENLACE_INVALIDO = "/acceso?error=enlace";
function redirigir(destino: string, request: NextRequest) {
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  // Esta respuesta puede llevar las cookies de la sesión recién creada.
  respuesta.headers.set("Cache-Control", "private, no-store");
  return respuesta;
}
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!tokenHash || type !== "recovery") {
    return redirigir(DESTINO_ENLACE_INVALIDO, request);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  return redirigir(
    error ? DESTINO_ENLACE_INVALIDO : DESTINO_RECUPERACION,
    request,
  );
}

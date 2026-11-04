import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";
// Refresca la sesión de Supabase y devuelve la respuesta con sus cookies. Se
// usa una sola vez por petición: las cabeceras anti-caché solo llegan en la
// primera escritura de cookies de cada cliente.
export async function actualizarSesion(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();
  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        respuesta = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([clave, valor]) =>
          respuesta.headers.set(clave, valor),
        );
      },
    },
  });
  // No añadas código entre createServerClient y getClaims(): la guía de
  // Supabase avisa de que provoca cierres de sesión aleatorios.
  await supabase.auth.getClaims();
  return respuesta;
}

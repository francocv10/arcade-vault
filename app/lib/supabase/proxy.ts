import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";
// Destinos fijos: nunca salen de un parámetro de la URL. Es solo una comprobación
// previa: cada formulario sigue reaccionando si la sesión cambia con la página
// abierta, y las operaciones las autoriza Supabase.
const RUTAS_CON_SESION = new Map([
  ["/acceso/nombre", "/acceso"],
  ["/acceso/nueva-clave", "/acceso?error=enlace"],
]);
const RUTA_SOLO_SIN_SESION = "/acceso";
const DESTINO_CON_SESION = "/home";
function destinoDeRuta(ruta: string, conSesion: boolean): string | null {
  if (conSesion) {
    return ruta === RUTA_SOLO_SIN_SESION ? DESTINO_CON_SESION : null;
  }
  return RUTAS_CON_SESION.get(ruta) ?? null;
}
// Refresca la sesión de Supabase y devuelve la respuesta con sus cookies, o una
// redirección que las conserva si la ruta no admite ese estado de sesión. Se usa
// una sola vez por petición: las cabeceras anti-caché solo llegan en la primera
// escritura de cookies de cada cliente.
export async function actualizarSesion(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();
  let respuesta = NextResponse.next({ request });
  let cabecerasAntiCache: Record<string, string> = {};
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
        cabecerasAntiCache = headers;
        Object.entries(headers).forEach(([clave, valor]) =>
          respuesta.headers.set(clave, valor),
        );
      },
    },
  });
  // No añadas código entre createServerClient y getClaims(): la guía de
  // Supabase avisa de que provoca cierres de sesión aleatorios.
  const { data } = await supabase.auth.getClaims();
  const destino = destinoDeRuta(request.nextUrl.pathname, !!data?.claims);
  if (!destino) return respuesta;
  const redireccion = NextResponse.redirect(new URL(destino, request.url));
  // Sin esto se perdería una sesión recién refrescada en esta misma petición.
  respuesta.cookies
    .getAll()
    .forEach((cookie) => redireccion.cookies.set(cookie));
  Object.entries(cabecerasAntiCache).forEach(([clave, valor]) =>
    redireccion.headers.set(clave, valor),
  );
  return redireccion;
}

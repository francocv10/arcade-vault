import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/app/lib/supabase/proxy";
export function proxy(request: NextRequest) {
  return actualizarSesion(request);
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|games/|.*\\.[^/]*$).*)",
  ],
};

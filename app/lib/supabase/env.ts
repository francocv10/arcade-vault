// Next solo sustituye `process.env.NEXT_PUBLIC_*` en el bundle del navegador
// cuando se accede por nombre literal, por eso cada variable se lee aquí de
// forma estática y no con un acceso dinámico `process.env[name]`.
function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Defínela en .env.local (ver .env.example).`,
    );
  }
  return valor;
}
export function supabaseEnv() {
  return {
    url: requerida(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requerida(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

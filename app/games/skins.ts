export const SKINS_BASE = ["clasico", "neon", "retro"] as const;
export type SkinBase = (typeof SKINS_BASE)[number];
export const NOMBRES_SKIN: Record<string, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};
// Devuelve la skin siguiente de la lista; si `actual` no está, la primera.
export function siguienteSkin<T extends string>(
  lista: readonly T[],
  actual: T,
): T {
  const i = lista.indexOf(actual);
  return lista[(i + 1) % lista.length];
}

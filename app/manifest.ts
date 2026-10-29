import type { MetadataRoute } from "next";
// Colores de la paleta de app/globals.css: --bg (#0a0a0f) y --cyan (#00f5ff).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arcade Vault",
    short_name: "Arcade Vault",
    description: "Juega online y compite por la mayor cantidad de puntos.",
    lang: "es",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
  };
}

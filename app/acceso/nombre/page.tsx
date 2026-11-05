import type { Metadata } from "next";
import { ElegirNombreForm } from "@/app/components/elegir-nombre-form";
export const metadata: Metadata = {
  title: "Elige tu nombre · Arcade Vault",
};
export default function ElegirNombrePage() {
  return <ElegirNombreForm />;
}

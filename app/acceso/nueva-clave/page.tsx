import type { Metadata } from "next";
import { NuevaClaveForm } from "@/app/components/nueva-clave-form";
export const metadata: Metadata = {
  title: "Nueva contraseña · Arcade Vault",
};
export default function NuevaClavePage() {
  return <NuevaClaveForm />;
}

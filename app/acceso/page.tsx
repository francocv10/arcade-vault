import type { Metadata } from "next";
import { AuthForm } from "@/app/components/auth-form";

export const metadata: Metadata = { title: "Acceso · Arcade Vault" };

export default function AccesoPage() {
  return <AuthForm />;
}

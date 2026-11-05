"use client";
import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tieneUsuario } from "@/app/acceso/auth-schema";
import type { PuntuacionGuardada, Usuario } from "@/app/data";
import { createClient } from "@/app/lib/supabase/client";
// Clave de la sesión simulada anterior: solo se usa para borrarla.
const USER_KEY_ANTIGUA = "av_user";
const SCORES_KEY = "av_scores";
const RUTA_NOMBRE = "/acceso/nombre";
interface AuthContextValue {
  user: Usuario | null;
  cargando: boolean; // true hasta recibir la primera sesión
  logout: () => Promise<void>;
  saveScore: (entry: Omit<PuntuacionGuardada, "at">) => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
function aUsuario(cuenta: User): Usuario {
  const { username } = cuenta.user_metadata;
  const conNombre = tieneUsuario(username);
  return {
    id: cuenta.id,
    name: conNombre ? username : "",
    email: cuenta.email ?? "",
    sinNombre: !conNombre,
  };
}
function mismoUsuario(a: Usuario | null, b: Usuario | null): boolean {
  return a?.id === b?.id && a?.name === b?.name && a?.email === b?.email;
}
// Ninguna sesión sigue sin nombre. Va aparte, en su propio Suspense, porque
// usePathname puede suspender y no debe arrastrar al proveedor ni a la app.
function ExigirNombre() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const sinNombre = !!user?.sinNombre;
  useEffect(() => {
    if (sinNombre && pathname !== RUTA_NOMBRE) router.replace(RUTA_NOMBRE);
  }, [sinNombre, pathname, router]);
  return null;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  // Render inicial sin sesión: la sesión se resuelve en cliente tras hidratar.
  const [user, setUser] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    try {
      localStorage.removeItem(USER_KEY_ANTIGUA);
    } catch {}
    // El callback solo actualiza estado: llamar a Supabase dentro lo bloquearía.
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((_evento, sesion) => {
      const siguiente = sesion ? aUsuario(sesion.user) : null;
      // Refrescar el token no debe volver a renderizar a quien usa useAuth,
      // como GamePlayer: si la cuenta es la misma, se conserva el objeto.
      setUser((actual) =>
        mismoUsuario(actual, siguiente) ? actual : siguiente,
      );
      setCargando(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const logout = useCallback(async () => {
    await createClient().auth.signOut();
  }, []);
  const saveScore = useCallback((entry: Omit<PuntuacionGuardada, "at">) => {
    try {
      const all: PuntuacionGuardada[] = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]",
      );
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);
  const value = useMemo(
    () => ({ user, cargando, logout, saveScore }),
    [user, cargando, logout, saveScore],
  );
  return (
    <AuthContext.Provider value={value}>
      <Suspense fallback={null}>
        <ExigirNombre />
      </Suspense>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

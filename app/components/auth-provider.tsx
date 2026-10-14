"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PuntuacionGuardada, Usuario } from "@/app/data";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

interface AuthContextValue {
  user: Usuario | null;
  login: (user: Usuario) => void;
  logout: () => void;
  saveScore: (entry: Omit<PuntuacionGuardada, "at">) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Render inicial sin sesión; localStorage se lee en useEffect para evitar errores de hidratación.
  const [user, setUser] = useState<Usuario | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras hidratar
      if (raw) setUser(JSON.parse(raw) as Usuario);
    } catch {}
  }, []);

  const login = useCallback((u: Usuario) => {
    setUser(u);
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {}
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
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
    () => ({ user, login, logout, saveScore }),
    [user, login, logout, saveScore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

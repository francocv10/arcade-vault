"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { mensajeAuth, validarAcceso } from "@/app/acceso/auth-schema";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "./auth-provider";
// Lee la URL en su propio límite de Suspense para que el formulario se
// prerrenderice: useSearchParams no se puede resolver en el HTML estático.
function AvisoEnlace() {
  const parametros = useSearchParams();
  if (parametros.get("error") !== "enlace") return null;
  return (
    <div className="terminal-error" role="alert">
      <span className="err-tag">&gt;</span> [ERR] El enlace ha caducado o ya se
      usó. Solicita uno nuevo.
    </div>
  );
}
export function AuthForm() {
  const router = useRouter();
  const { user: sesion, cargando, logout } = useAuth();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Única redirección tras entrar: también cubre a quien llega con sesión.
  useEffect(() => {
    if (!cargando && sesion) router.replace("/home");
  }, [cargando, sesion, router]);
  const cambiarTab = (siguiente: "in" | "up") => {
    setTab(siguiente);
    setErrores({});
    setErrorGeneral(null);
  };
  const entrar = async () => {
    const encontrados = validarAcceso({ email, password: pass });
    setErrores(encontrados);
    setErrorGeneral(null);
    if (Object.keys(encontrados).length > 0) return;
    setEnviando(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) {
        setErrorGeneral(mensajeAuth(error.code));
        setEnviando(false);
      }
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
      setEnviando(false);
    }
  };
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (tab === "in") void entrar();
  };
  const playAsGuest = async () => {
    await logout();
    router.push("/home");
  };
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>
        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => cambiarTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => cambiarTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="acceso-usuario">Usuario</label>
              <input
                id="acceso-usuario"
                name="username"
                autoComplete="username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="px_kai"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="acceso-correo">Correo electrónico</label>
            <input
              id="acceso-correo"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              aria-invalid={!!errores.email}
              aria-describedby={
                errores.email ? "acceso-correo-error" : undefined
              }
            />
            {errores.email && (
              <p className="field-error" id="acceso-correo-error">
                {errores.email}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="acceso-clave">Contraseña</label>
            <input
              id="acceso-clave"
              name="password"
              type="password"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              aria-invalid={!!errores.password}
              aria-describedby={
                errores.password ? "acceso-clave-error" : undefined
              }
            />
            {errores.password && (
              <p className="field-error" id="acceso-clave-error">
                {errores.password}
              </p>
            )}
          </div>
          {errorGeneral ? (
            <div className="terminal-error" role="alert">
              <span className="err-tag">&gt;</span> {errorGeneral}
            </div>
          ) : (
            <Suspense fallback={null}>
              <AvisoEnlace />
            </Suspense>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={enviando}
            style={{ width: "100%", marginTop: 8 }}
          >
            {enviando
              ? "ENTRANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>
        <button
          className="btn ghost"
          type="button"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>
        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled
            title="Próximamente"
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled
            title="Próximamente"
          >
            ▣ GITHUB
          </button>
        </div>
        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

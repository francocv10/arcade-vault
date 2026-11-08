"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode, SubmitEvent } from "react";
import {
  esRecuperacionReciente,
  mensajeAuth,
  validarClaveNueva,
} from "@/app/acceso/auth-schema";
import { cambiarClave } from "@/app/acceso/nueva-clave/actions";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "./auth-provider";
export function Tarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{titulo}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}
export function NuevaClaveForm() {
  const router = useRouter();
  const { user, cargando } = useAuth();
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Resultado de comprobar `amr` para una cuenta (spec 23). Si el id no
  // coincide con la sesión actual, la comprobación sigue pendiente. Solo decide
  // qué se muestra: quien impide el cambio es `cambiarClave`.
  const [recuperacion, setRecuperacion] = useState<{
    userId: string;
    valida: boolean;
  } | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let activo = true;
    createClient()
      .auth.getClaims()
      .then(({ data }) => {
        const valida = esRecuperacionReciente(
          data?.claims?.amr,
          Math.floor(Date.now() / 1000),
        );
        if (activo) setRecuperacion({ userId, valida });
      })
      .catch(() => {
        if (activo) setRecuperacion({ userId, valida: false });
      });
    return () => {
      activo = false;
    };
  }, [userId]);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const encontrado = validarClaveNueva(clave);
    setErrorClave(encontrado);
    setErrorGeneral(null);
    if (encontrado) return;
    setEnviando(true);
    try {
      const resultado = await cambiarClave(clave);
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
      } else {
        // <Activity> conserva esta ruta oculta: no debe guardar la contraseña.
        setClave("");
        router.replace("/home");
      }
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setEnviando(false);
  };
  const comprobando = cargando || (!!user && recuperacion?.userId !== user.id);
  if (comprobando) {
    return (
      <Tarjeta titulo="NUEVA CONTRASEÑA">
        <p className="auth-intro" role="status">
          Comprobando el enlace…
        </p>
      </Tarjeta>
    );
  }
  if (!user || !recuperacion?.valida) {
    return (
      <Tarjeta titulo="ENLACE NO VÁLIDO">
        <p className="auth-intro">
          El enlace ha caducado o ya se usó. Solicita uno nuevo desde la
          pantalla de acceso.
        </p>
        <Link href="/acceso" className="btn lg" style={{ width: "100%" }}>
          IR A ACCESO
        </Link>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo="NUEVA CONTRASEÑA">
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="nueva-clave">Contraseña nueva</label>
          <input
            id="nueva-clave"
            name="password"
            type="password"
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!errorClave}
            aria-describedby={errorClave ? "nueva-clave-error" : undefined}
          />
          {errorClave && (
            <p className="field-error" id="nueva-clave-error">
              {errorClave}
            </p>
          )}
        </div>
        {errorGeneral && (
          <div className="terminal-error" role="alert">
            <span className="err-tag">&gt;</span> {errorGeneral}
          </div>
        )}
        <button
          className="btn lg"
          type="submit"
          disabled={enviando}
          style={{ width: "100%", marginTop: 8 }}
        >
          {enviando ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
        </button>
      </form>
    </Tarjeta>
  );
}

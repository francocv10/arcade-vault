"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { flushSync } from "react-dom";
import {
  mensajeAuth,
  validarAcceso,
  validarCorreo,
  validarRegistro,
} from "@/app/acceso/auth-schema";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "./auth-provider";
type Proveedor = "google" | "github";
type ConfirmacionPendiente = {
  correo: string;
  motivo: "registro" | "acceso";
};
const AVISOS_URL = new Map([
  ["enlace", "[ERR] El enlace ha caducado o ya se usó. Solicita uno nuevo."],
  [
    "oauth",
    "[ERR] No se pudo iniciar sesión con el proveedor. Inténtalo de nuevo o usa tu correo.",
  ],
]);
// Lee la URL en su propio límite de Suspense para que el formulario se
// prerrenderice: useSearchParams no se puede resolver en el HTML estático.
function AvisoUrl() {
  const parametros = useSearchParams();
  const aviso = AVISOS_URL.get(parametros.get("error") ?? "");
  if (!aviso) return null;
  return (
    <div className="terminal-error" role="alert">
      <span className="err-tag">&gt;</span> {aviso}
    </div>
  );
}
function RecuperarClave({
  correoInicial,
  onVolver,
}: {
  correoInicial: string;
  onVolver: () => void;
}) {
  const [email, setEmail] = useState(correoInicial);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const encontrado = validarCorreo(email);
    setErrorCorreo(encontrado);
    setErrorGeneral(null);
    if (encontrado) return;
    setEnviando(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
      );
      if (error) setErrorGeneral(mensajeAuth(error.code));
      else setEnviado(true);
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setEnviando(false);
  };
  if (enviado) {
    return (
      <>
        {/* Mismo texto exista o no la cuenta: no revela qué correos hay. */}
        <div className="auth-ok" role="status">
          [OK] Si hay una cuenta con ese correo, recibirás un enlace para crear
          una contraseña nueva.
        </div>
        <button
          className="btn ghost"
          type="button"
          style={{ width: "100%" }}
          onClick={onVolver}
        >
          VOLVER A INICIAR SESIÓN
        </button>
      </>
    );
  }
  return (
    <form onSubmit={submit} noValidate>
      <p className="auth-intro">
        Escribe tu correo y te enviaremos un enlace para crear una contraseña
        nueva.
      </p>
      <div className="field">
        <label htmlFor="recuperar-correo">Correo electrónico</label>
        <input
          id="recuperar-correo"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jugador@vault.gg"
          aria-invalid={!!errorCorreo}
          aria-describedby={errorCorreo ? "recuperar-correo-error" : undefined}
        />
        {errorCorreo && (
          <p className="field-error" id="recuperar-correo-error">
            {errorCorreo}
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
        {enviando ? "ENVIANDO…" : "ENVIAR ENLACE"}
      </button>
      <button
        className="btn ghost"
        type="button"
        style={{ width: "100%", marginTop: 10 }}
        onClick={onVolver}
      >
        VOLVER A INICIAR SESIÓN
      </button>
    </form>
  );
}
function RevisaCorreo({
  pendiente,
  onVolver,
}: {
  pendiente: ConfirmacionPendiente;
  onVolver: () => void;
}) {
  const { correo, motivo } = pendiente;
  const titulo = useRef<HTMLHeadingElement>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  // Este estado sustituye al formulario: sin esto el foco se perdería con el
  // botón que lo abrió y el teclado volvería al principio de la página.
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  const reenviar = async () => {
    setErrorGeneral(null);
    setReenviado(false);
    setEnviando(true);
    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: correo,
      });
      if (error) setErrorGeneral(mensajeAuth(error.code));
      else setReenviado(true);
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setEnviando(false);
  };
  return (
    <>
      <h3 className="auth-estado" ref={titulo} tabIndex={-1}>
        REVISA TU CORREO
      </h3>
      <div role="status">
        {reenviado ? (
          <div className="auth-ok">
            [OK] Enlace reenviado. Revisa también la carpeta de spam.
          </div>
        ) : motivo === "registro" ? (
          <div className="auth-ok">
            [OK] Te hemos enviado un enlace a {correo} para confirmar tu cuenta.
            Si ese correo ya tiene cuenta, inicia sesión.
          </div>
        ) : (
          <p className="auth-intro">
            Tu cuenta aún no está confirmada. Pulsa REENVIAR ENLACE para recibir
            otro en {correo}.
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
        type="button"
        disabled={enviando}
        style={{ width: "100%" }}
        onClick={() => void reenviar()}
      >
        {enviando ? "REENVIANDO…" : "REENVIAR ENLACE"}
      </button>
      <button
        className="btn ghost"
        type="button"
        style={{ width: "100%", marginTop: 10 }}
        onClick={onVolver}
      >
        VOLVER A INICIAR SESIÓN
      </button>
    </>
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
  const [recuperando, setRecuperando] = useState(false);
  const [redirigiendo, setRedirigiendo] = useState(false);
  const [pendiente, setPendiente] = useState<ConfirmacionPendiente | null>(
    null,
  );
  const campoCorreo = useRef<HTMLInputElement>(null);
  // <Activity> conserva este estado al navegar: sin esto reaparecería al cerrar
  // sesión y volver a /acceso. Se ajusta en el render, sin un efecto.
  if (sesion && pendiente) setPendiente(null);
  // Volver atrás desde el proveedor restaura la página tal como quedó, con los
  // botones deshabilitados: sin esto no se podría reintentar.
  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (e.persisted) setRedirigiendo(false);
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);
  // Next oculta esta ruta con <Activity> al navegar, sin desmontarla: tras
  // entrar hay que limpiar la contraseña y el envío para que no reaparezcan.
  // Única redirección tras entrar: también cubre a quien llega con sesión. Una
  // sesión sin nombre la lleva AuthProvider a /acceso/nombre.
  useEffect(() => {
    if (!cargando && sesion && !sesion.sinNombre) router.replace("/home");
  }, [cargando, sesion, router]);
  const limpiarErrores = () => {
    setErrores({});
    setErrorGeneral(null);
  };
  const cambiarTab = (siguiente: "in" | "up") => {
    setTab(siguiente);
    limpiarErrores();
  };
  const volverDeConfirmacion = () => {
    // Síncrono porque el campo aún no existe: RevisaCorreo ocupa su lugar.
    flushSync(() => {
      setPendiente(null);
      cambiarTab("in");
    });
    campoCorreo.current?.focus();
  };
  const abrirRecuperacion = () => {
    limpiarErrores();
    setRecuperando(true);
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
      if (error?.code === "email_not_confirmed") {
        // No reenvía solo: intentar entrar no debe gastar el límite de correos.
        setPass("");
        setPendiente({ correo: email.trim(), motivo: "acceso" });
      } else if (error) {
        setErrorGeneral(mensajeAuth(error.code));
      } else {
        setPass("");
      }
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setEnviando(false);
  };
  const registrar = async () => {
    const encontrados = validarRegistro({
      username: user,
      email,
      password: pass,
    });
    setErrores(encontrados);
    setErrorGeneral(null);
    if (Object.keys(encontrados).length > 0) return;
    setEnviando(true);
    try {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { username: user } },
      });
      if (error) {
        setErrorGeneral(mensajeAuth(error.code));
      } else {
        setPass("");
        // Con Confirm email activo no hay sesión hasta pulsar el enlace. Un
        // correo duplicado responde igual, así no se revela qué correos existen.
        if (!data.session) {
          setPendiente({ correo: email.trim(), motivo: "registro" });
        }
      }
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setEnviando(false);
  };
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void (tab === "in" ? entrar() : registrar());
  };
  const entrarConProveedor = async (provider: Proveedor) => {
    limpiarErrores();
    setRedirigiendo(true);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      // Sin error el navegador ya va camino del proveedor.
      if (!error) return;
      setErrorGeneral(mensajeAuth(error.code));
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setRedirigiendo(false);
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
        {pendiente ? (
          <RevisaCorreo pendiente={pendiente} onVolver={volverDeConfirmacion} />
        ) : recuperando ? (
          <RecuperarClave
            correoInicial={email}
            onVolver={() => setRecuperando(false)}
          />
        ) : (
          <>
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
                    aria-invalid={!!errores.username}
                    aria-describedby={
                      errores.username ? "acceso-usuario-error" : undefined
                    }
                  />
                  {errores.username && (
                    <p className="field-error" id="acceso-usuario-error">
                      {errores.username}
                    </p>
                  )}
                </div>
              )}
              <div className="field">
                <label htmlFor="acceso-correo">Correo electrónico</label>
                <input
                  ref={campoCorreo}
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
                  autoComplete={
                    tab === "in" ? "current-password" : "new-password"
                  }
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
              {tab === "in" && (
                <button
                  type="button"
                  className="auth-link"
                  onClick={abrirRecuperacion}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
              {errorGeneral ? (
                <div className="terminal-error" role="alert">
                  <span className="err-tag">&gt;</span> {errorGeneral}
                </div>
              ) : (
                <Suspense fallback={null}>
                  <AvisoUrl />
                </Suspense>
              )}
              <button
                className="btn lg"
                type="submit"
                disabled={enviando}
                style={{ width: "100%", marginTop: 8 }}
              >
                {tab === "in"
                  ? enviando
                    ? "ENTRANDO…"
                    : "ENTRAR AL VAULT"
                  : enviando
                    ? "CREANDO CUENTA…"
                    : "CREAR CUENTA"}
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
                disabled={redirigiendo}
                onClick={() => void entrarConProveedor("google")}
              >
                ◆ GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={redirigiendo}
                onClick={() => void entrarConProveedor("github")}
              >
                ▣ GITHUB
              </button>
            </div>
          </>
        )}
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

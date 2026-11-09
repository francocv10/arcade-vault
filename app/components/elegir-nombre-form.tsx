"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import {
  mensajeAuth,
  sugerirUsuario,
  validarUsuario,
} from "@/app/acceso/auth-schema";
import { elegirNombre } from "@/app/lib/jugadores/actions";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { Tarjeta } from "./nueva-clave-form";
export function ElegirNombreForm() {
  const router = useRouter();
  const { user, cargando } = useAuth();
  const [nombre, setNombre] = useState("");
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const eligiendo = !!user?.sinNombre;
  // Única redirección: también cubre guardar el nombre y cerrar sesión, porque
  // ambos cambian la sesión que llega por onAuthStateChange.
  useEffect(() => {
    if (cargando) return;
    if (!user) router.replace("/acceso");
    else if (!user.sinNombre) router.replace("/home");
  }, [cargando, user, router]);
  // Los metadatos del proveedor no están en el contexto: solo se usan aquí.
  useEffect(() => {
    if (!eligiendo) return;
    let activo = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        const sugerencia = sugerirUsuario(
          data.session?.user.user_metadata ?? {},
        );
        // No pisa lo que ya se haya escrito mientras llegaba la sesión.
        if (activo) setNombre((actual) => actual || sugerencia);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [eligiendo]);
  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const username = nombre.trim();
    const encontrado = validarUsuario(username);
    setErrorNombre(encontrado);
    setErrorGeneral(null);
    if (encontrado) return;
    setEnviando(true);
    try {
      // El servidor reserva el nombre en `jugadores` y lo copia a los
      // metadatos (spec 24); updateUser desde aquí ya no basta.
      const resultado = await elegirNombre(username);
      if (!resultado.ok) {
        // Los textos de campo (formato, ERROR_NOMBRE_NO_DISPONIBLE) van bajo el
        // input; los de mensajeAuth empiezan por [ERR] y van al aviso general.
        if (resultado.error.startsWith("[ERR]")) {
          setErrorGeneral(resultado.error);
        } else {
          setErrorNombre(resultado.error);
        }
      } else {
        // Los metadatos los escribió el servidor: el navegador solo los ve al
        // refrescar la sesión. El nuevo `user` llega por onAuthStateChange y
        // el efecto de arriba redirige. Reintentar es seguro: elegirNombre no
        // cambia el nombre de una cuenta que ya tiene fila.
        const { error } = await createClient().auth.refreshSession();
        if (error) setErrorGeneral(mensajeAuth(error.code));
      }
    } catch {
      setErrorGeneral(mensajeAuth(undefined));
    }
    setEnviando(false);
  };
  if (!eligiendo) {
    return (
      <Tarjeta titulo="ELIGE TU NOMBRE">
        <p className="auth-intro" role="status">
          Comprobando la sesión…
        </p>
      </Tarjeta>
    );
  }
  return (
    <Tarjeta titulo="ELIGE TU NOMBRE">
      <form onSubmit={submit} noValidate>
        <p className="auth-intro">
          Con este nombre saldrás en los rankings. Después no podrás cambiarlo.
        </p>
        <div className="field">
          <label htmlFor="elegir-nombre">Nombre de jugador</label>
          <input
            id="elegir-nombre"
            name="username"
            autoComplete="nickname"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="px_kai"
            aria-invalid={!!errorNombre}
            aria-describedby={errorNombre ? "elegir-nombre-error" : undefined}
          />
          {errorNombre && (
            <p className="field-error" id="elegir-nombre-error">
              {errorNombre}
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
          {enviando ? "GUARDANDO…" : "GUARDAR NOMBRE"}
        </button>
      </form>
    </Tarjeta>
  );
}

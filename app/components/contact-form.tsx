"use client";

import { useActionState, useEffect, useState } from "react";
import { enviarContacto } from "@/app/about/actions";
import type { EstadoContacto } from "@/app/about/contact-schema";

const ESTADO_INICIAL: EstadoContacto = { estado: "inicial" };

export function ContactForm() {
  const [estado, accion, enviando] = useActionState(enviarContacto, ESTADO_INICIAL);
  // Estados ya "consumidos": el shake terminó o el usuario cerró el terminal de éxito.
  const [sacudido, setSacudido] = useState<EstadoContacto | null>(null);
  const [cerrado, setCerrado] = useState<EstadoContacto | null>(null);

  const hayErrores = !!estado.errores && estado !== sacudido;
  useEffect(() => {
    if (!estado.errores) return;
    const t = setTimeout(() => setSacudido(estado), 400);
    return () => clearTimeout(t);
  }, [estado]);

  const exito = estado.estado === "exito" && estado !== cerrado;
  const errores = estado.errores ?? {};
  const valores = estado.valores;

  return (
    <form
      className={"contact-form" + (hayErrores ? " shake" : "")}
      action={accion}
      noValidate
    >
      {exito ? (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body" role="status">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS
              {estado.nombre ? `, ${estado.nombre.toUpperCase()}` : ""}.
              <span className="caret" aria-hidden="true">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setCerrado(estado)}
              >
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="contacto-nombre">NOMBRE</label>
            <input
              id="contacto-nombre"
              name="nombre"
              autoComplete="name"
              maxLength={80}
              placeholder="px_kai"
              defaultValue={valores?.nombre}
              aria-invalid={!!errores.nombre}
              aria-describedby={errores.nombre ? "contacto-nombre-error" : undefined}
            />
            {errores.nombre && (
              <p className="field-error" id="contacto-nombre-error">
                {errores.nombre}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="contacto-correo">CORREO ELECTRÓNICO</label>
            <input
              id="contacto-correo"
              name="correo"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="jugador@vault.gg"
              defaultValue={valores?.correo}
              aria-invalid={!!errores.correo}
              aria-describedby={errores.correo ? "contacto-correo-error" : undefined}
            />
            {errores.correo && (
              <p className="field-error" id="contacto-correo-error">
                {errores.correo}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="contacto-mensaje">MENSAJE</label>
            <textarea
              id="contacto-mensaje"
              name="mensaje"
              rows={5}
              maxLength={2000}
              placeholder="Cuéntanos qué tienes en mente…"
              defaultValue={valores?.mensaje}
              aria-invalid={!!errores.mensaje}
              aria-describedby={errores.mensaje ? "contacto-mensaje-error" : undefined}
            />
            {errores.mensaje && (
              <p className="field-error" id="contacto-mensaje-error">
                {errores.mensaje}
              </p>
            )}
          </div>

          {/* Honeypot: invisible y fuera del orden de tabulación; un humano nunca lo rellena. */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="contacto-website">NO RELLENAR</label>
            <input
              id="contacto-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          {estado.estado === "error" && estado.mensajeError && (
            <div className="terminal-error" role="alert">
              <span className="err-tag">&gt;</span> {estado.mensajeError}
            </div>
          )}

          <button
            className="btn xl press"
            type="submit"
            style={{ width: "100%" }}
            disabled={enviando}
          >
            {enviando ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      )}
    </form>
  );
}

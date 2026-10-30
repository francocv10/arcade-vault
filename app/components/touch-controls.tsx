"use client";
import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import {
  CONTROLES_TACTILES,
  TECLAS_DIRECCION,
  type BotonAccion,
  type ControlesTactiles,
  type DireccionTactil,
  type TeclaEmulada,
} from "@/app/games/controles-tactiles";
const RETARDO_REPETICION_MS = 250;
const INTERVALO_REPETICION_MS = 80;
const DIRECCIONES: {
  dir: DireccionTactil;
  flecha: string;
  nombre: string;
}[] = [
  { dir: "up", flecha: "M12 4 L20 16 L4 16 Z", nombre: "Arriba" },
  { dir: "left", flecha: "M16 4 L16 20 L4 12 Z", nombre: "Izquierda" },
  { dir: "right", flecha: "M8 4 L20 12 L8 20 Z", nombre: "Derecha" },
  { dir: "down", flecha: "M4 8 L20 8 L12 20 Z", nombre: "Abajo" },
];
interface Pulsada {
  tecla: TeclaEmulada;
  retardo?: ReturnType<typeof setTimeout>;
  intervalo?: ReturnType<typeof setInterval>;
}
function despachar(
  tipo: "keydown" | "keyup",
  tecla: TeclaEmulada,
  repeat = false,
) {
  window.dispatchEvent(
    new KeyboardEvent(tipo, {
      code: tecla.code,
      key: tecla.key,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}
function capitalizar(texto: string) {
  return texto.charAt(0) + texto.slice(1).toLowerCase();
}
interface BotonTactilProps {
  className: string;
  nombre: string;
  tecla: TeclaEmulada | null;
  repetir: boolean;
  presionar: (tecla: TeclaEmulada, repetir: boolean) => void;
  soltar: (code: string) => void;
  children: React.ReactNode;
}
function BotonTactil({
  className,
  nombre,
  tecla,
  repetir,
  presionar,
  soltar,
  children,
}: BotonTactilProps) {
  const alPulsar = (e: PointerEvent<HTMLButtonElement>) => {
    if (!tecla) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    presionar(tecla, repetir);
  };
  const alSoltar = () => {
    if (tecla) soltar(tecla.code);
  };
  return (
    <button
      type="button"
      className={`touch-btn ${className}`}
      aria-label={nombre}
      disabled={!tecla}
      onPointerDown={alPulsar}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onLostPointerCapture={alSoltar}
    >
      {children}
    </button>
  );
}
function Consola({ controles }: { controles: ControlesTactiles }) {
  const pulsadas = useRef(new Map<string, Pulsada>());
  const soltar = useCallback((code: string) => {
    const entrada = pulsadas.current.get(code);
    if (!entrada) return;
    clearTimeout(entrada.retardo);
    clearInterval(entrada.intervalo);
    pulsadas.current.delete(code);
    despachar("keyup", entrada.tecla);
  }, []);
  const presionar = useCallback((tecla: TeclaEmulada, repetir: boolean) => {
    if (pulsadas.current.has(tecla.code)) return;
    const entrada: Pulsada = { tecla };
    pulsadas.current.set(tecla.code, entrada);
    despachar("keydown", tecla);
    if (repetir) {
      entrada.retardo = setTimeout(() => {
        entrada.intervalo = setInterval(
          () => despachar("keydown", tecla, true),
          INTERVALO_REPETICION_MS,
        );
      }, RETARDO_REPETICION_MS);
    }
  }, []);
  useEffect(() => {
    const mapa = pulsadas.current;
    const soltarTodas = () => {
      for (const code of [...mapa.keys()]) soltar(code);
    };
    const alCambiarVisibilidad = () => {
      if (document.hidden) soltarTodas();
    };
    window.addEventListener("blur", soltarTodas);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      window.removeEventListener("blur", soltarTodas);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      soltarTodas();
    };
  }, [soltar]);
  const accion = (
    letra: "A" | "B",
    boton: BotonAccion | null,
    clase: string,
  ) => (
    <div className="touch-action">
      <BotonTactil
        className={clase}
        nombre={boton ? capitalizar(boton.etiqueta) : `Botón ${letra}`}
        tecla={boton ? boton.tecla : null}
        repetir={false}
        presionar={presionar}
        soltar={soltar}
      >
        {letra}
      </BotonTactil>
      <span className="touch-label">{boton ? boton.etiqueta : ""}</span>
    </div>
  );
  return (
    <div
      className="touch-console"
      role="group"
      aria-label="Controles táctiles"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="touch-dpad">
        {DIRECCIONES.map(({ dir, flecha, nombre }) => (
          <BotonTactil
            key={dir}
            className={`touch-dir touch-dir-${dir}`}
            nombre={nombre}
            tecla={
              controles.direcciones.includes(dir) ? TECLAS_DIRECCION[dir] : null
            }
            repetir={controles.repetir}
            presionar={presionar}
            soltar={soltar}
          >
            <svg
              className="touch-arrow"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d={flecha} fill="currentColor" />
            </svg>
          </BotonTactil>
        ))}
        <div className="touch-hub" aria-hidden="true">
          <span className="touch-hub-gem" />
        </div>
      </div>
      <div className="touch-actions">
        {accion("B", controles.b, "touch-action-b")}
        {accion("A", controles.a, "touch-action-a")}
      </div>
    </div>
  );
}
export function TouchControls({ gameId }: { gameId: string }) {
  const controles = CONTROLES_TACTILES[gameId];
  if (!controles) return null;
  return <Consola controles={controles} />;
}

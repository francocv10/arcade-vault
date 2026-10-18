import { useEffect, useRef, type RefObject } from "react";

const ENFOCABLES =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface OpcionesDialogo {
  /** Selector CSS dentro del contenedor; por defecto, el primer elemento enfocable. */
  initialFocus?: string;
  /** Sin esto, Escape no hace nada. */
  onEscape?: () => void;
  /** Por defecto, el elemento que tenía el foco al abrir. */
  returnFocus?: () => HTMLElement | null;
}

function enfocables(contenedor: HTMLElement): HTMLElement[] {
  return Array.from(contenedor.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
    (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
  );
}

// Comportamiento de diálogo modal para el contenedor devuelto: foco dentro al abrir, Tab y Shift+Tab
// atrapados, scroll del fondo bloqueado y foco devuelto al cerrar.
export function useDialog<T extends HTMLElement>(
  active: boolean,
  { initialFocus, onEscape, returnFocus }: OpcionesDialogo = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  // Los callbacks viven en un ref: si cambiaran de identidad en cada render, el efecto se reiniciaría y robaría el foco.
  const callbacks = useRef({ onEscape, returnFocus });
  useEffect(() => {
    callbacks.current = { onEscape, returnFocus };
  });

  useEffect(() => {
    const contenedor = ref.current;
    if (!active || !contenedor) return;

    const previo = document.activeElement as HTMLElement | null;
    const inicial =
      (initialFocus && contenedor.querySelector<HTMLElement>(initialFocus)) ||
      enfocables(contenedor)[0];
    inicial?.focus({ preventScroll: true });

    // Al ocultar la barra de scroll el contenido se ensancharía: se compensa con padding.
    const { body } = document;
    const antes = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const barra = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (barra > 0) body.style.paddingRight = `${barra}px`;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && callbacks.current.onEscape) {
        e.preventDefault();
        callbacks.current.onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      const lista = enfocables(contenedor);
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const actual = document.activeElement;
      if (!contenedor.contains(actual)) {
        e.preventDefault();
        (e.shiftKey ? ultimo : primero).focus();
      } else if (e.shiftKey && actual === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && actual === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = antes.overflow;
      body.style.paddingRight = antes.paddingRight;
      const destino = callbacks.current.returnFocus?.() ?? previo;
      if (destino?.isConnected) destino.focus({ preventScroll: true });
    };
  }, [active, initialFocus]);

  return ref;
}

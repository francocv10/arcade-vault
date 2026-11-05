"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Usuario } from "@/app/data";
import { nombreDeCuenta } from "@/app/lib/leaderboard/schema";
export function AccountMenu({
  user,
  onSalir,
}: {
  user: Usuario;
  onSalir: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const idPanel = useId();
  useEffect(() => {
    if (!abierto) return;
    itemRef.current?.focus();
    const alPulsarFuera = (e: MouseEvent) => {
      if (raizRef.current?.contains(e.target as Node)) return;
      setAbierto(false);
      // Si el clic cayó en otro control, el foco se queda allí.
      if (document.activeElement === document.body) botonRef.current?.focus();
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      botonRef.current?.focus();
    };
    document.addEventListener("click", alPulsarFuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("click", alPulsarFuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);
  const salir = () => {
    setAbierto(false);
    botonRef.current?.focus();
    onSalir();
  };
  return (
    <div className="account-menu" ref={raizRef}>
      {/* Solo abre con clic, Enter o Espacio: las flechas son de los juegos. */}
      <button
        ref={botonRef}
        type="button"
        className="btn ghost auth-btn"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        onClick={() => setAbierto((actual) => !actual)}
      >
        {nombreDeCuenta(user.name)} ▾
      </button>
      {abierto && (
        <div
          id={idPanel}
          className="account-panel"
          role="menu"
          aria-label={`Cuenta ${user.email}`}
        >
          <p className="account-email" role="none">
            {user.email}
          </p>
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            onClick={salir}
            onKeyDown={(e) => {
              if (e.key === "Tab") setAbierto(false);
            }}
          >
            CERRAR SESIÓN
          </button>
        </div>
      )}
    </div>
  );
}

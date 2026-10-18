"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="av-error fade-in" role="alert">
      <h1 className="flicker">PARTIDA INTERRUMPIDA</h1>
      <p>
        No se pudo cargar esta pantalla. Reinténtalo y, si el fallo continúa,
        vuelve al inicio.
      </p>
      <div className="actions">
        <button type="button" className="btn lg" onClick={() => retry()}>
          REINTENTAR
        </button>
        <Link href="/home" className="btn ghost lg">
          IR AL INICIO
        </Link>
      </div>
      {error.digest && (
        <div className="digest">Código de referencia: {error.digest}</div>
      )}
    </section>
  );
}

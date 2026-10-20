import Link from "next/link";
// Estado vacío de los rankings reales: sin datos de ejemplo, solo la invitación a jugar.
export function EmptyBoard({ gameId }: { gameId: string }) {
  return (
    <div className="empty-board" role="status">
      <div className="eb-title">
        SIN PUNTUACIONES — SÉ EL PRIMERO
        <span className="eb-caret" aria-hidden="true">
          _
        </span>
      </div>
      <Link href={`/juegos/${gameId}/jugar`} className="btn yellow">
        ▶ JUGAR
      </Link>
    </div>
  );
}

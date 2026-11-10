// Estado «no disponible» de los rankings y la actividad (spec 28): la consulta
// devolvió `null` porque Supabase falló. Distinto de `EmptyBoard`, que significa
// «no hay datos»: aquí no se invita a jugar ni hay cursor parpadeante. Se
// recupera solo, porque el fallo se guarda en caché solo unos segundos.
export function UnavailableBoard() {
  return (
    <div className="empty-board unavailable" role="status">
      <div className="eb-title">
        DATOS NO DISPONIBLES — VUELVE EN UN MOMENTO
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  GAMES,
  getGame,
  seededScores,
  type PuntuacionRanking,
} from "@/app/data";
import { obtenerMejorMarca } from "@/app/lib/leaderboard/actions";
import { useAuth } from "./auth-provider";
import { EmptyBoard } from "./empty-board";

// Único juego con ranking real en Supabase; las demás pestañas siguen con datos falsos.
const JUEGO_REAL = "asteroides";

type MejorMarca = { rank: number; score: number; date: string };

export function HallOfFame({
  asteroides,
}: {
  asteroides: PuntuacionRanking[];
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState(GAMES[0].id);
  const esReal = tab === JUEGO_REAL;
  const rows = useMemo(
    () => (esReal ? asteroides : seededScores(tab.length * 23 + 7, 12)),
    [tab, esReal, asteroides],
  );
  const game = getGame(tab) ?? GAMES[0];
  const nombreUsuario = user?.name ?? null;

  // «TU MEJOR MARCA» de Asteroides: se pide a la base por el nombre de la sesión local.
  const [marca, setMarca] = useState<{
    nombre: string;
    datos: MejorMarca | null;
  } | null>(null);
  useEffect(() => {
    if (!esReal || !nombreUsuario) return;
    let activo = true;
    obtenerMejorMarca(JUEGO_REAL, nombreUsuario)
      .then((datos) => activo && setMarca({ nombre: nombreUsuario, datos }))
      .catch(() => activo && setMarca({ nombre: nombreUsuario, datos: null }));
    return () => {
      activo = false;
    };
  }, [esReal, nombreUsuario]);
  const mejorMarca: MejorMarca | null =
    esReal && marca?.nombre === nombreUsuario ? marca.datos : null;

  const youRank = user ? Math.floor(8 + (tab.length % 4)) : null;
  const youScore = user ? rows[5]?.score - 2400 : null;
  const [r1, r2, r3] = rows;
  const puntos = (n: number) => n.toLocaleString("es-ES");

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyBoard gameId={tab} />
      ) : (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">02</div>
              <div className="name">{r2?.name ?? "—"}</div>
              <div className="score">{r2 ? puntos(r2.score) : ""}</div>
              <div className="date">{r2?.date ?? ""}</div>
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{r1?.name ?? "—"}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {r1 ? puntos(r1.score) : ""}
              </div>
              <div className="date">{r1?.date ?? ""}</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">03</div>
              <div className="name">{r3?.name ?? "—"}</div>
              <div className="score">{r3 ? puntos(r3.score) : ""}</div>
              <div className="date">{r3?.date ?? ""}</div>
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={
                  "tr" +
                  (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{puntos(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && (!esReal || mejorMarca) && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(mejorMarca?.rank ?? youRank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {puntos(mejorMarca?.score ?? (youScore || 9999))}
                  </div>
                  <div className="dt">{mejorMarca?.date ?? "11/05/2026"}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

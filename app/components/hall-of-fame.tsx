"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GAMES, getGame, type PuntuacionRanking } from "@/app/data";
import { obtenerMejorMarca } from "@/app/lib/leaderboard/actions";
import { nombreDeCuenta } from "@/app/lib/leaderboard/schema";
import { useAuth } from "./auth-provider";
import { EmptyBoard } from "./empty-board";
import { UnavailableBoard } from "./unavailable-board";
type MejorMarca = { rank: number; score: number; date: string };
// Ranking de un juego: `null` si no se pudo leer de Supabase (spec 28).
type RankingJuego = PuntuacionRanking[] | null;
export function HallOfFame({
  asteroides,
  tetris,
  arkanoid,
  snake,
  frogger,
}: {
  asteroides: RankingJuego;
  tetris: RankingJuego;
  arkanoid: RankingJuego;
  snake: RankingJuego;
  frogger: RankingJuego;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState(GAMES[0].id);
  // Ranking de Supabase de cada juego, indexado por id.
  const reales = useMemo<Record<string, RankingJuego>>(
    () => ({ asteroides, tetris, arkanoid, snake, frogger }),
    [asteroides, tetris, arkanoid, snake, frogger],
  );
  // `null`: no se pudo leer (UnavailableBoard solo en esta pestaña).
  const disponible = reales[tab] !== null;
  const rows = reales[tab] ?? [];
  const game = getGame(tab) ?? GAMES[0];
  const nombreUsuario = user?.name ?? null;
  // «TU MEJOR MARCA» de un juego real: se pide a la base por el nombre de la sesión local.
  const [marca, setMarca] = useState<{
    juego: string;
    nombre: string;
    datos: MejorMarca | null;
  } | null>(null);
  useEffect(() => {
    if (!nombreUsuario) return;
    let activo = true;
    obtenerMejorMarca(tab, nombreUsuario)
      .then(
        (datos) =>
          activo && setMarca({ juego: tab, nombre: nombreUsuario, datos }),
      )
      .catch(
        () =>
          activo &&
          setMarca({ juego: tab, nombre: nombreUsuario, datos: null }),
      );
    return () => {
      activo = false;
    };
  }, [tab, nombreUsuario]);
  const mejorMarca: MejorMarca | null =
    marca?.juego === tab && marca.nombre === nombreUsuario ? marca.datos : null;
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
      {!disponible ? (
        <UnavailableBoard />
      ) : rows.length === 0 ? (
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
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{puntos(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && mejorMarca && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(mejorMarca.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {nombreDeCuenta(user.name)}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {puntos(mejorMarca.score)}
                  </div>
                  <div className="dt">{mejorMarca.date}</div>
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

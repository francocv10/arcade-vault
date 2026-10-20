import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyBoard } from "@/app/components/empty-board";
import {
  GAMES,
  getGame,
  seededScores,
  type PuntuacionRanking,
} from "@/app/data";
import { obtenerRanking } from "@/app/lib/leaderboard/queries";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata(
  props: PageProps<"/juegos/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `${game.title} · Arcade Vault`, description: game.short };
}

export default function GameDetailPage(props: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={<div className="av-detail" aria-busy="true" />}>
      <GameDetail params={props.params} />
    </Suspense>
  );
}

async function GameDetail({
  params,
}: Pick<PageProps<"/juegos/[id]">, "params">) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/biblioteca" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {game.id === "asteroides" ? (
            <Suspense fallback={<div aria-busy="true" style={{ minHeight: 120 }} />}>
              <RankingReal gameId={game.id} />
            </Suspense>
          ) : (
            <FilasRanking scores={seededScores(id.length * 17 + 3, 10)} />
          )}
        </div>
      </aside>
    </div>
  );
}

// Top 10 real (Supabase) con estado vacío; los demás juegos usan datos falsos.
async function RankingReal({ gameId }: { gameId: string }) {
  const scores = await obtenerRanking(gameId, 10);
  if (scores.length === 0) return <EmptyBoard gameId={gameId} />;
  return <FilasRanking scores={scores} />;
}

function FilasRanking({ scores }: { scores: PuntuacionRanking[] }) {
  return (
    <>
      {scores.map((r, i) => (
        <div
          key={r.rank}
          className={
            "lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
          }
        >
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
              {r.date}
            </div>
          </div>
          <div className="sc">{r.score.toLocaleString("es-ES")}</div>
        </div>
      ))}
    </>
  );
}

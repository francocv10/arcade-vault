"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { SnapshotAsteroides } from "@/app/games/asteroids/types";
import { AsteroidsCanvas } from "./asteroids-canvas";
import { useAuth } from "./auth-provider";
import { useDialog } from "./use-dialog";

const LIVES = 3;

export function GamePlayer({ gameId, title }: { gameId: string; title: string }) {
  const { user, saveScore } = useAuth();
  const esAsteroides = gameId === "asteroides";
  const [fakeScore, setScore] = useState(0);
  // Snapshot que envía el motor de canvas (solo en los juegos reales).
  const [snap, setSnap] = useState<SnapshotAsteroides | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // null = sin editar: se usa el usuario de la sesión (que carga tras hidratar) o INVITADO.
  const [editedName, setEditedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const finRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  // Escape no cierra el modal: sin él no queda un estado coherente (partida terminada, sin HUD).
  const modalRef = useDialog<HTMLDivElement>(over, {
    initialFocus: "input",
    returnFocus: () => finRef.current,
  });

  const name = editedName ?? user?.name ?? "INVITADO";
  const score = esAsteroides ? (snap?.score ?? 0) : fakeScore;
  const lives = esAsteroides ? (snap?.lives ?? LIVES) : LIVES;
  const level = esAsteroides
    ? (snap?.level ?? 1)
    : 1 + Math.floor(score / 2500);

  // Al guardar desaparece el campo (que tenía el foco): el foco pasa a la acción siguiente.
  useEffect(() => {
    if (saved) restartRef.current?.focus();
  }, [saved]);

  useEffect(() => {
    if (esAsteroides || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [esAsteroides, over, paused]);

  const restart = () => {
    setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setRestartKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button ref={finRef} className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link href={`/juegos/${gameId}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {esAsteroides ? (
            <AsteroidsCanvas
              onChange={setSnap}
              paused={paused || over}
              restartKey={restartKey}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId}>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  aria-label="Iniciales"
                  value={name}
                  onChange={(e) =>
                    setEditedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: gameId, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved" role="status">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button ref={restartRef} className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

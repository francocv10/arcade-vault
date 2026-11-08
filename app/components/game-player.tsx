"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type {
  SkinArkanoid,
  SnapshotArkanoid,
} from "@/app/games/arkanoid/types";
import type {
  SkinAsteroides,
  SnapshotAsteroides,
} from "@/app/games/asteroids/types";
import { NOMBRES_SKIN, SKINS_BASE, siguienteSkin } from "@/app/games/skins";
import type { SkinFrogger, SnapshotFrogger } from "@/app/games/frogger/types";
import type { SkinSnake, SnapshotSnake } from "@/app/games/snake/types";
import type { SnapshotTetris, TemaTetris } from "@/app/games/tetris/types";
import { ArkanoidCanvas } from "./arkanoid-canvas";
import { AsteroidsCanvas } from "./asteroids-canvas";
import { FroggerCanvas } from "./frogger-canvas";
import { SnakeCanvas } from "./snake-canvas";
import { TetrisCanvas } from "./tetris-canvas";
import { TouchControls } from "./touch-controls";
import {
  guardarPuntuacion,
  iniciarPartida,
} from "@/app/lib/leaderboard/actions";
import { nombreDeCuenta } from "@/app/lib/leaderboard/schema";
import { useAuth } from "./auth-provider";
import { useDialog } from "./use-dialog";
const LIVES = 3;
const UNA_VIDA = 1; // Tetris y Snake
const CLAVE_TEMA_TETRIS = "av-tetris-theme";
const CLAVE_SKIN_ASTEROIDES = "av-asteroides-skin";
const CLAVE_SKIN_ARKANOID = "av-arkanoid-skin";
const CLAVE_SKIN_SNAKE = "av-snake-skin";
const CLAVE_SKIN_FROGGER = "av-frogger-skin";
const ERROR_GUARDADO =
  "[ERR] No se pudo guardar la puntuación. Revisa tu conexión e inténtalo de nuevo.";
export function GamePlayer({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const { user, saveScore } = useAuth();
  const esAsteroides = gameId === "asteroides";
  const esTetris = gameId === "tetris";
  const esArkanoid = gameId === "arkanoid";
  const esSnake = gameId === "snake";
  // Juegos con motor de canvas y ranking en Supabase; el resto son maquetas.
  const esFrogger = gameId === "frogger";
  const esReal = esAsteroides || esTetris || esArkanoid || esSnake || esFrogger;
  const [fakeScore, setScore] = useState(0);
  // Snapshot que envía el motor de canvas (solo en los juegos reales).
  const [snap, setSnap] = useState<
    | SnapshotAsteroides
    | SnapshotTetris
    | SnapshotArkanoid
    | SnapshotSnake
    | SnapshotFrogger
    | null
  >(null);
  // Tema del canvas de Tetris: arranca oscuro y se lee de localStorage tras hidratar.
  const [tema, setTema] = useState<TemaTetris>("dark");
  // Skin del canvas de Asteroides: arranca en clasico y se lee de localStorage tras hidratar.
  const [skinAsteroides, setSkinAsteroides] =
    useState<SkinAsteroides>("clasico");
  // Skin del canvas de Arkanoid: misma lógica que la de Asteroides.
  const [skinArkanoid, setSkinArkanoid] = useState<SkinArkanoid>("clasico");
  // Skin del canvas de Snake: misma lógica que la de Asteroides y Arkanoid.
  const [skinSnake, setSkinSnake] = useState<SkinSnake>("clasico");
  // Skin del canvas de Frogger: misma lógica que la de Snake.
  const [skinFrogger, setSkinFrogger] = useState<SkinFrogger>("clasico");
  const [restartKey, setRestartKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // null = sin editar: se usa el usuario de la sesión (que carga tras hidratar) o INVITADO.
  const [editedName, setEditedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Asteroides, Tetris, Arkanoid y Snake guardan en Supabase; el resto de juegos sigue en localStorage.
  const [saving, setSaving] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const finRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const enviandoRef = useRef(false);
  const restartRef = useRef<HTMLButtonElement>(null);
  // Id de la partida abierta en el servidor (spec 22). Ref y no estado: no se pinta.
  const partidaRef = useRef<string | null>(null);
  const userId = user?.id;
  const titleId = useId();
  // En los juegos reales el modal también se abre solo al terminar la partida
  // (`win` solo existe en Arkanoid).
  const gameOver =
    over || (esReal && (snap?.status === "gameover" || snap?.status === "win"));
  // Escape no cierra el modal: sin él no queda un estado coherente (partida terminada, sin HUD).
  const modalRef = useDialog<HTMLDivElement>(gameOver, {
    initialFocus: "input",
    returnFocus: () => finRef.current,
  });
  const name = user ? nombreDeCuenta(user.name) : (editedName ?? "INVITADO");
  const score = esReal ? (snap?.score ?? 0) : fakeScore;
  const lives = esReal
    ? (snap?.lives ?? (esTetris || esSnake ? UNA_VIDA : LIVES))
    : LIVES;
  const level = esReal ? (snap?.level ?? 1) : 1 + Math.floor(score / 2500);
  // Lee el tema guardado tras hidratar; con localStorage bloqueado o un valor raro queda oscuro.
  useEffect(() => {
    if (!esTetris) return;
    try {
      if (localStorage.getItem(CLAVE_TEMA_TETRIS) === "light")
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras hidratar
        setTema("light");
    } catch {
      // Sin localStorage el juego funciona en oscuro, sin persistir.
    }
  }, [esTetris]);
  const cambiarTema = () => {
    const nuevo: TemaTetris = tema === "dark" ? "light" : "dark";
    setTema(nuevo);
    try {
      localStorage.setItem(CLAVE_TEMA_TETRIS, nuevo);
    } catch {
      // Sin localStorage el tema no se recuerda.
    }
  };
  // Lee la skin guardada tras hidratar; con localStorage bloqueado o un valor raro queda clasico.
  useEffect(() => {
    if (!esAsteroides) return;
    try {
      const guardada = localStorage.getItem(CLAVE_SKIN_ASTEROIDES);
      const valida = SKINS_BASE.find((s) => s === guardada);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras hidratar
      if (valida) setSkinAsteroides(valida);
    } catch {
      // Sin localStorage el juego funciona en clasico, sin persistir.
    }
  }, [esAsteroides]);
  const cambiarSkin = () => {
    const nueva = siguienteSkin(SKINS_BASE, skinAsteroides);
    setSkinAsteroides(nueva);
    try {
      localStorage.setItem(CLAVE_SKIN_ASTEROIDES, nueva);
    } catch {
      // Sin localStorage la skin no se recuerda.
    }
  };
  useEffect(() => {
    if (!esArkanoid) return;
    try {
      const guardada = localStorage.getItem(CLAVE_SKIN_ARKANOID);
      const valida = SKINS_BASE.find((s) => s === guardada);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras hidratar
      if (valida) setSkinArkanoid(valida);
    } catch {
      // Sin localStorage el juego funciona en clasico, sin persistir.
    }
  }, [esArkanoid]);
  const cambiarSkinArkanoid = () => {
    const nueva = siguienteSkin(SKINS_BASE, skinArkanoid);
    setSkinArkanoid(nueva);
    try {
      localStorage.setItem(CLAVE_SKIN_ARKANOID, nueva);
    } catch {
      // Sin localStorage la skin no se recuerda.
    }
  };
  useEffect(() => {
    if (!esSnake) return;
    try {
      const guardada = localStorage.getItem(CLAVE_SKIN_SNAKE);
      const valida = SKINS_BASE.find((s) => s === guardada);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras hidratar
      if (valida) setSkinSnake(valida);
    } catch {
      // Sin localStorage el juego funciona en clasico, sin persistir.
    }
  }, [esSnake]);
  const cambiarSkinSnake = () => {
    const nueva = siguienteSkin(SKINS_BASE, skinSnake);
    setSkinSnake(nueva);
    try {
      localStorage.setItem(CLAVE_SKIN_SNAKE, nueva);
    } catch {
      // Sin localStorage la skin no se recuerda.
    }
  };
  useEffect(() => {
    if (!esFrogger) return;
    try {
      const guardada = localStorage.getItem(CLAVE_SKIN_FROGGER);
      const valida = SKINS_BASE.find((s) => s === guardada);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única tras hidratar
      if (valida) setSkinFrogger(valida);
    } catch {
      // Sin localStorage el juego funciona en clasico, sin persistir.
    }
  }, [esFrogger]);
  const cambiarSkinFrogger = () => {
    const nueva = siguienteSkin(SKINS_BASE, skinFrogger);
    setSkinFrogger(nueva);
    try {
      localStorage.setItem(CLAVE_SKIN_FROGGER, nueva);
    } catch {
      // Sin localStorage la skin no se recuerda.
    }
  };
  // Al guardar desaparece el campo (que tenía el foco): el foco pasa a la acción siguiente.
  useEffect(() => {
    if (saved) restartRef.current?.focus();
  }, [saved]);
  // Deshabilitar el botón durante el envío le quita el foco: se devuelve si falla.
  useEffect(() => {
    if (errorGuardado) saveRef.current?.focus();
  }, [errorGuardado]);
  // Cada partida real con sesión abre una partida en el servidor: al montar, al
  // reiniciar y al cambiar de cuenta. Los invitados no la piden. Si falla, se
  // juega igual y el error aparece al guardar. Una respuesta que llega tras la
  // limpieza (reinicio, Strict Mode) se ignora y esa fila caduca sola.
  useEffect(() => {
    partidaRef.current = null;
    if (!esReal || !userId) return;
    let vigente = true;
    iniciarPartida(gameId)
      .then((res) => {
        if (vigente && res.ok && res.partidaId) {
          partidaRef.current = res.partidaId;
        }
      })
      .catch(() => {
        // Red caída: sin partida, `guardarPuntuacion` responderá con su error.
      });
    return () => {
      vigente = false;
    };
  }, [esReal, userId, restartKey, gameId]);
  useEffect(() => {
    if (esReal || gameOver || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [esReal, gameOver, paused]);
  const restart = () => {
    setScore(0);
    // Descarta el snapshot "gameover" para que el modal no reaparezca antes del primero nuevo.
    setSnap(null);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setErrorGuardado(null);
    setRestartKey((k) => k + 1);
  };
  const guardar = async () => {
    if (!esReal) {
      saveScore({ game: gameId, score, name });
      setSaved(true);
      return;
    }
    // El ref bloquea al instante: `saving` no se actualiza hasta el siguiente render.
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setSaving(true);
    setErrorGuardado(null);
    try {
      // Sin partida (iniciarPartida falló) el servidor rechaza con su mensaje.
      const res = await guardarPuntuacion({
        partidaId: partidaRef.current ?? "",
        score,
      });
      if (res.ok) setSaved(true);
      else setErrorGuardado(res.error ?? ERROR_GUARDADO);
    } catch {
      // Red caída o 500: se conserva el modal y lo escrito.
      setErrorGuardado(ERROR_GUARDADO);
    } finally {
      enviandoRef.current = false;
      setSaving(false);
    }
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
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
          {esAsteroides && (
            <button className="btn cyan" onClick={cambiarSkin}>
              SKIN: {NOMBRES_SKIN[skinAsteroides]}
            </button>
          )}
          {esArkanoid && (
            <button className="btn cyan" onClick={cambiarSkinArkanoid}>
              SKIN: {NOMBRES_SKIN[skinArkanoid]}
            </button>
          )}
          {esSnake && (
            <button className="btn cyan" onClick={cambiarSkinSnake}>
              SKIN: {NOMBRES_SKIN[skinSnake]}
            </button>
          )}
          {esFrogger && (
            <button className="btn cyan" onClick={cambiarSkinFrogger}>
              SKIN: {NOMBRES_SKIN[skinFrogger]}
            </button>
          )}
          {esTetris && (
            <button className="btn cyan" onClick={cambiarTema}>
              TEMA
            </button>
          )}
          <button
            ref={finRef}
            className="btn magenta"
            onClick={() => setOver(true)}
          >
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
              paused={paused || gameOver}
              restartKey={restartKey}
              skin={skinAsteroides}
            />
          ) : esTetris ? (
            <TetrisCanvas
              onChange={setSnap}
              paused={paused || gameOver}
              restartKey={restartKey}
              theme={tema}
            />
          ) : esArkanoid ? (
            <ArkanoidCanvas
              onChange={setSnap}
              paused={paused || gameOver}
              restartKey={restartKey}
              skin={skinArkanoid}
            />
          ) : esSnake ? (
            <SnakeCanvas
              onChange={setSnap}
              paused={paused || gameOver}
              restartKey={restartKey}
              skin={skinSnake}
            />
          ) : esFrogger ? (
            <FroggerCanvas
              onChange={setSnap}
              paused={paused || gameOver}
              restartKey={restartKey}
              skin={skinFrogger}
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
      <TouchControls gameId={gameId} />
      {gameOver && (
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
            {esReal && !user ? (
              // Invitado en un juego real (spec 22): solo las cuentas publican.
              // Sin input, useDialog enfoca el primer enlace: va antes de JUGAR DE NUEVO.
              <div className="ranking-lock">
                <p className="ranking-lock-msg">
                  INICIA SESIÓN PARA ENTRAR EN EL RANKING
                </p>
                <p className="ranking-lock-note">
                  Esta partida no se guardará en el ranking.
                </p>
                <Link href="/acceso" className="btn yellow ranking-lock-cta">
                  INICIAR SESIÓN
                </Link>
              </div>
            ) : !saved ? (
              <div className="input-row">
                <input
                  aria-label="Iniciales"
                  value={name}
                  readOnly={!!user}
                  onChange={(e) =>
                    setEditedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  ref={saveRef}
                  className="btn yellow"
                  disabled={saving}
                  onClick={guardar}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved" role="status">
                ▸ PUNTUACIÓN GUARDADA_
              </div>
            )}
            {errorGuardado && !saved && (
              <div className="terminal-error" role="alert">
                <span className="err-tag">&gt;</span> {errorGuardado}
              </div>
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

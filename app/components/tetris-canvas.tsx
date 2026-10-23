"use client";
import { useEffect, useRef } from "react";
import { createTetrisGame } from "@/app/games/tetris/game";
import type {
  JuegoTetris,
  SnapshotTetris,
  TemaTetris,
} from "@/app/games/tetris/types";
interface TetrisCanvasProps {
  onChange: (snapshot: SnapshotTetris) => void;
  paused?: boolean;
  // Al cambiar este valor el juego se reinicia (0 puntos, 0 líneas, nivel 1).
  restartKey?: number;
  theme?: TemaTetris;
}
export function TetrisCanvas({
  onChange,
  paused = false,
  restartKey = 0,
  theme = "dark",
}: TetrisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<JuegoTetris | null>(null);
  const onChangeRef = useRef(onChange);
  const pausedRef = useRef(paused);
  const themeRef = useRef(theme);
  const restartKeyRef = useRef(restartKey);
  // El motor se crea una sola vez: los cambios de props llegan por refs.
  useEffect(() => {
    onChangeRef.current = onChange;
    pausedRef.current = paused;
    themeRef.current = theme;
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createTetrisGame(canvas, (s) => onChangeRef.current(s));
    game.setTheme(themeRef.current);
    if (pausedRef.current) game.pause();
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (paused) gameRef.current?.pause();
    else gameRef.current?.resume();
  }, [paused]);
  useEffect(() => {
    gameRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (restartKeyRef.current === restartKey) return;
    restartKeyRef.current = restartKey;
    gameRef.current?.restart();
  }, [restartKey]);
  return (
    <canvas
      ref={canvasRef}
      className="tetris-canvas"
      width={800}
      height={600}
      role="img"
      aria-label="Juego TETRIS: usa las flechas para mover y bajar la pieza, arriba o X para rotarla y Espacio para dejarla caer"
    />
  );
}

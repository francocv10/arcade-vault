"use client";
import { useEffect, useRef } from "react";
import { createArkanoidGame } from "@/app/games/arkanoid/game";
import type {
  JuegoArkanoid,
  SnapshotArkanoid,
} from "@/app/games/arkanoid/types";
interface ArkanoidCanvasProps {
  onChange: (snapshot: SnapshotArkanoid) => void;
  paused?: boolean;
  // Al cambiar este valor el juego se reinicia (0 puntos, 3 vidas, nivel 1).
  restartKey?: number;
}
export function ArkanoidCanvas({
  onChange,
  paused = false,
  restartKey = 0,
}: ArkanoidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<JuegoArkanoid | null>(null);
  const onChangeRef = useRef(onChange);
  const pausedRef = useRef(paused);
  const restartKeyRef = useRef(restartKey);
  // El motor se crea una sola vez: los cambios de props llegan por refs.
  useEffect(() => {
    onChangeRef.current = onChange;
    pausedRef.current = paused;
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createArkanoidGame(canvas, (s) => onChangeRef.current(s));
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
    if (restartKeyRef.current === restartKey) return;
    restartKeyRef.current = restartKey;
    gameRef.current?.restart();
  }, [restartKey]);
  return (
    <canvas
      ref={canvasRef}
      className="arkanoid-canvas"
      width={800}
      height={600}
      role="img"
      aria-label="Juego ARKANOID: mueve la paleta con las flechas o el ratón para rebotar la pelota y romper los bloques"
    />
  );
}

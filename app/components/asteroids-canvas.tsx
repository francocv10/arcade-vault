"use client";
import { useEffect, useRef } from "react";
import { createAsteroidsGame } from "@/app/games/asteroids/game";
import type {
  JuegoAsteroides,
  SkinAsteroides,
  SnapshotAsteroides,
} from "@/app/games/asteroids/types";
interface AsteroidsCanvasProps {
  onChange: (snapshot: SnapshotAsteroides) => void;
  paused?: boolean;
  // Al cambiar este valor el juego se reinicia (0 puntos, 3 vidas, nivel 1).
  restartKey?: number;
  skin?: SkinAsteroides;
}
export function AsteroidsCanvas({
  onChange,
  paused = false,
  restartKey = 0,
  skin = "clasico",
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<JuegoAsteroides | null>(null);
  const onChangeRef = useRef(onChange);
  const pausedRef = useRef(paused);
  const restartKeyRef = useRef(restartKey);
  const skinRef = useRef(skin);
  // El motor se crea una sola vez: los cambios de props llegan por refs.
  useEffect(() => {
    onChangeRef.current = onChange;
    pausedRef.current = paused;
    skinRef.current = skin;
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createAsteroidsGame(canvas, (s) => onChangeRef.current(s));
    game.setSkin(skinRef.current);
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
    gameRef.current?.setSkin(skin);
  }, [skin]);
  useEffect(() => {
    if (restartKeyRef.current === restartKey) return;
    restartKeyRef.current = restartKey;
    gameRef.current?.restart();
  }, [restartKey]);
  return (
    <canvas
      ref={canvasRef}
      className="asteroids-canvas"
      width={800}
      height={600}
      role="img"
      aria-label="Juego ASTEROIDES: usa las flechas para rotar y propulsar la nave, y Espacio para disparar"
    />
  );
}

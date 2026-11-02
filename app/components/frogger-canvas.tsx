"use client";
import { useEffect, useRef } from "react";
import { createFroggerGame } from "@/app/games/frogger/game";
import type {
  JuegoFrogger,
  SkinFrogger,
  SnapshotFrogger,
} from "@/app/games/frogger/types";
interface FroggerCanvasProps {
  onChange: (snapshot: SnapshotFrogger) => void;
  paused?: boolean;
  // Al cambiar este valor el juego se reinicia (0 puntos, 3 vidas, nivel 1).
  restartKey?: number;
  skin?: SkinFrogger;
}
export function FroggerCanvas({
  onChange,
  paused = false,
  restartKey = 0,
  skin = "clasico",
}: FroggerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<JuegoFrogger | null>(null);
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
    const game = createFroggerGame(canvas, (s) => onChangeRef.current(s));
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
      className="frogger-canvas"
      width={800}
      height={600}
      role="img"
      aria-label="Juego FROGGER: guía a la rana con las flechas o WASD, cruza la carretera y el río y llena las cinco bocas de meta"
    />
  );
}

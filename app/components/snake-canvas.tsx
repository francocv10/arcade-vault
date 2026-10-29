"use client";
import { useEffect, useRef } from "react";
import { createSnakeGame } from "@/app/games/snake/game";
import type {
  JuegoSnake,
  SkinSnake,
  SnapshotSnake,
} from "@/app/games/snake/types";
interface SnakeCanvasProps {
  onChange: (snapshot: SnapshotSnake) => void;
  paused?: boolean;
  // Al cambiar este valor el juego se reinicia (0 puntos, 1 vida, nivel 1).
  restartKey?: number;
  skin?: SkinSnake;
}
export function SnakeCanvas({
  onChange,
  paused = false,
  restartKey = 0,
  skin = "clasico",
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<JuegoSnake | null>(null);
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
    const game = createSnakeGame(canvas, (s) => onChangeRef.current(s));
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
      className="snake-canvas"
      width={800}
      height={600}
      role="img"
      aria-label="Juego SNAKE: guía a la serpiente con las flechas o WASD, come las frutas y evita las paredes y tu propio cuerpo"
    />
  );
}

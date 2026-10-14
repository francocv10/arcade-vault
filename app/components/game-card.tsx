"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Juego } from "@/app/data";

export function GameCard({ game }: { game: Juego }) {
  const router = useRouter();
  const tiltRef = useRef<HTMLDivElement>(null);

  // Al desmontar no debe quedar la tarjeta inclinada.
  useEffect(() => {
    const el = tiltRef.current;
    return () => {
      if (el) el.style.transform = "";
    };
  }, []);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (el) el.style.transform = "";
  };

  const open = () => {
    onLeave();
    router.push(`/juegos/${game.id}`);
  };

  const btnColor =
    game.color === "magenta" ? "magenta" : game.color === "yellow" ? "yellow" : "";

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={open}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover}></div>
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <button
            className={"btn " + btnColor}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            JUGAR
          </button>
        </div>
      </div>
    </div>
  );
}

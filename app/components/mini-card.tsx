import Link from "next/link";
import type { Juego } from "@/app/data";

export function MiniCard({ game }: { game: Juego }) {
  return (
    <Link href={`/juegos/${game.id}`} className="mini-card block">
      <div className="mini-cover">
        <div className={"cover-bg " + game.cover}></div>
      </div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}

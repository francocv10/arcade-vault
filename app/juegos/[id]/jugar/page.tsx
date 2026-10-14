import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/app/data";
import { GamePlayer } from "@/app/components/game-player";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata(
  props: PageProps<"/juegos/[id]/jugar">,
): Promise<Metadata> {
  const { id } = await props.params;
  const game = getGame(id);
  return { title: game ? `Jugando ${game.title} · Arcade Vault` : "Arcade Vault" };
}

export default async function PlayPage(props: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer gameId={game.id} title={game.title} />;
}

import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/app/data";
import { GamePlayer } from "@/app/components/game-player";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function PlayPage(props: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await props.params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer gameId={game.id} title={game.title} />;
}

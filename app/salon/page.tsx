import type { Metadata } from "next";
import { Suspense } from "react";
import { HallOfFame } from "@/app/components/hall-of-fame";
import { obtenerRanking } from "@/app/lib/leaderboard/queries";
export const metadata: Metadata = { title: "Salón de la Fama · Arcade Vault" };
export default function SalonPage() {
  return (
    <Suspense fallback={<div className="av-hall" aria-busy="true" />}>
      <SalonConDatos />
    </Suspense>
  );
}
// HallOfFame es un Client Component y no puede consultar la base: los datos
// reales de Asteroides, Tetris y Arkanoid se leen aquí y se le pasan como props.
async function SalonConDatos() {
  const [asteroides, tetris, arkanoid] = await Promise.all([
    obtenerRanking("asteroides", 12),
    obtenerRanking("tetris", 12),
    obtenerRanking("arkanoid", 12),
  ]);
  return (
    <HallOfFame asteroides={asteroides} tetris={tetris} arkanoid={arkanoid} />
  );
}

import type { Metadata } from "next";
import { PokemonCounter } from "@/app/components/pokemon-counter";
export const metadata: Metadata = {
  title: "Contador Pokémon · Arcade Vault",
  description:
    "Haz clic para subir el contador y descubrir un Pokémon nuevo en cada número.",
};
export default function ContadorPage() {
  return (
    <section className="contador-hero fade-in">
      <div className="kicker pixel neon-yellow">▸ CONTADOR</div>
      <h1 className="about-title">CONTADOR POKÉMON</h1>
      <PokemonCounter />
    </section>
  );
}

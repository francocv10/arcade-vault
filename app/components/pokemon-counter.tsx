"use client";
import { useState } from "react";
// Pokédex nacional: 1025 Pokémon. Al pasar del último, vuelve al #1.
const TOTAL_POKEMON = 1025;
function spriteUrl(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}
export function PokemonCounter() {
  const [count, setCount] = useState(1);
  const pokemonId = ((count - 1) % TOTAL_POKEMON) + 1;
  return (
    <div className="contador-panel">
      <div className="contador-numero pixel" aria-live="polite">
        {count}
      </div>
      <div className="contador-imagen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={pokemonId}
          src={spriteUrl(pokemonId)}
          alt={`Pokémon número ${pokemonId}`}
          width={240}
          height={240}
        />
      </div>
      <div className="contador-id mono">
        POKÉDEX #{String(pokemonId).padStart(4, "0")}
      </div>
      <div className="contador-acciones">
        <button
          type="button"
          className="btn lg"
          onClick={() => setCount((c) => c + 1)}
        >
          +1
        </button>
        <button type="button" className="btn ghost" onClick={() => setCount(1)}>
          REINICIAR
        </button>
      </div>
    </div>
  );
}

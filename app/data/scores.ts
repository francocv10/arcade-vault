// Puntuaciones y jugadores ficticios. Esta capa se sustituirá por una base de datos.
export interface PuntuacionRanking {
  rank: number;
  name: string;
  score: number;
  date: string;
}
export interface Usuario {
  id: string; // auth.users.id
  name: string; // user_metadata.username; "" si aún no hay username
  email: string;
  sinNombre: boolean; // sesión OAuth que no ha elegido nombre
}

# Sugerencias de juegos — To Do

Registro del agente `game-planner`. `[ ]` pendiente, `[x]` implementado.

## Pendientes

- [ ] **INVASORES** (`invasores`, SHOOTER, green, M) — Space Invaders: ningún juego real es verde y es la maqueta SHOOTER más reconocible; motor propio sin assets obligatorios · sugerido 2026-10-28 (recomendado)
- [ ] **RANARIA** (`ranaria`, ARCADE, green, M) — Frogger: color verde sin representar, mecánica de cruce distinta a las existentes; exige carriles, troncos y colisiones por zona · sugerido 2026-10-28
- [ ] **GLOTÓN** (`gloton`, ARCADE, yellow, L) — Pac-Man: laberinto e IA de fantasmas; alto coste, ARCADE ya tiene dos reales · sugerido 2026-10-28

### SHOOTER

- [ ] **CIEMPIÉS** (`ciempies`, SHOOTER, green, M) — Centipede: disparo de precisión contra un enemigo que se fragmenta en un campo de setas; sin assets · sugerido 2026-10-28 (recomendado de la categoría)
- [ ] **DEFENSA ORBITAL** (`defensa-orbital`, SHOOTER, magenta, M) — Missile Command: defensa por apuntado con cursor; las «vidas» son las ciudades · sugerido 2026-10-28
- [ ] **ESCUADRÓN** (`escuadron`, SHOOTER, cyan, M) — Galaga: enemigos que bajan en picado; se solapa con `invasores` · sugerido 2026-10-28
- [ ] **RÍO DE FUEGO** (`rio-de-fuego`, SHOOTER, yellow, L) — River Raid: scroll vertical, río procedural y combustible; el más caro · sugerido 2026-10-28
- [ ] **TANQUES PIXEL** (`tanques-pixel`, SHOOTER, green, M) — Battle City: tanques en laberinto con muros destructibles y 5 mapas · sugerido 2026-10-28

### PUZZLE

- [ ] **SIMÓN** (`simon`, PUZZLE, magenta, S) — memoria de secuencias de 4 colores; barato, sin assets (tonos WebAudio) · sugerido 2026-10-28 (recomendado de la categoría)
- [ ] **2048** (`2048`, PUZZLE, yellow, S) — fusión de fichas con flechas; comprobar que el id numérico no dé problemas en ruta y CSS (alternativa `dos-mil-cuarenta-y-ocho`) · sugerido 2026-10-28
- [ ] **BUSCAMINAS** (`buscaminas`, PUZZLE, cyan, M) — deducción con cursor de teclado y estado `win`; fijar fórmula de puntos · sugerido 2026-10-28
- [ ] **SOKOBAN** (`sokoban`, PUZZLE, green, M) — empujar cajas en ~8 niveles; hay que validar que sean resolubles · sugerido 2026-10-28
- [ ] **COLUMNAS** (`columnas`, PUZZLE, cyan, M) — Columns de Sega; muy cercano a Tetris · sugerido 2026-10-28

### ARCADE

- [ ] **ALUNIZAJE** (`alunizaje`, ARCADE, green, M) — Lunar Lander: física de inercia y combustible, vectorial como Asteroides · sugerido 2026-10-28 (recomendado de la categoría)
- [ ] **ATRAPABOMBAS** (`atrapabombas`, ARCADE, magenta, S) — Kaboom: reflejos con entrada horizontal; el más barato · sugerido 2026-10-28
- [ ] **ALETEO** (`aleteo`, ARCADE, cyan, S) — Flappy Bird: un solo botón, partidas cortas · sugerido 2026-10-28
- [ ] **CORREDOR** (`corredor`, ARCADE, yellow, M) — endless runner tipo Dino de Chrome · sugerido 2026-10-28
- [ ] **SALTARÍN** (`saltarin`, ARCADE, green, M) — Doodle Jump: scroll vertical, puntos por altura · sugerido 2026-10-28

### VERSUS (contra la CPU)

- [ ] **HOCKEY DE AIRE** (`hockey-aire`, VERSUS, cyan, M) — disco y mazo contra la CPU, física 2D distinta a Pong · sugerido 2026-10-28 (recomendado de la categoría)
- [ ] **PONG CPU** (`pong-cpu`, VERSUS, magenta, S) — Pong contra IA falible; se solapa en concepto con la maqueta `duelo-pixel` · sugerido 2026-10-28
- [ ] **BOXEO PIXEL** (`boxeo-pixel`, VERSUS, yellow, L) — combate por rondas con rivales de patrón propio; puede requerir dividir la spec · sugerido 2026-10-28
- [ ] **FUTBOLÍN NEÓN** (`futbolin-neon`, VERSUS, green, M) — varillas en bloque contra la CPU; control por teclado poco intuitivo · sugerido 2026-10-28
- [ ] **DUELO DE TANQUES** (`duelo-tanques`, VERSUS, magenta, M) — arena con muros y proyectiles que rebotan contra un tanque CPU · sugerido 2026-10-28

## Implementados

- [x] **ASTEROIDES** (`asteroides`, SHOOTER, cyan)
- [x] **TETRIS** (`tetris`, PUZZLE, magenta)
- [x] **ARKANOID** (`arkanoid`, ARCADE, yellow)
- [x] **SNAKE** (`snake`, ARCADE, cyan)

## Descartados

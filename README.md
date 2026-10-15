## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Pantallas

- `/home`: página de inicio (`/` redirige aquí).
- `/biblioteca`: catálogo de juegos.
- `/juegos/[id]` y `/juegos/[id]/jugar`: detalle y reproductor de cada juego.
- `/salon`: Salón de la Fama.
- `/acceso`: inicio de sesión / registro.
- `/about`: "Sobre nosotros" con formulario de contacto que envía un correo real mediante [Resend](https://resend.com).

## Usa Spec Driven Design

Basado en /spec y /spec-impl. Las specs están en `specs/`.

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Configuración

Copia `.env.example` a `.env.local` y rellena las variables del formulario de contacto:

```bash
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=
```

## Comandos

```bash
npm run dev     # next dev
npm run build   # next build
npm start       # next start (después de compilar)
npm run lint    # eslint (flat config: eslint.config.mjs, eslint-config-next)
```

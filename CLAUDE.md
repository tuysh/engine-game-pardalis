# CLAUDE.md

Lee [`AGENTS.md`](AGENTS.md) completo antes de tocar algo: ahí están el contexto, la arquitectura y las reglas.
El diseño acordado de la API está en [`docs/DISENO-3.0.md`](docs/DISENO-3.0.md).

## Usa Bun para todo

- `bun install`, no `npm install` ni `yarn`.
- `bun test`, no `vitest` ni `jest`. Las pruebas importan de `bun:test`.
- `bun check` para revisar tipos.
- `bun run construir` para generar `dist/`. **No** `bun build`: ese es el empaquetador de Bun y aquí no se usa.
- `bunx <paquete>`, no `npx`.

Node solo se usa para comprobar que el paquete ya construido (`dist/`) también corre ahí.

## Commits

- Deja la línea `Co-Authored-By` de Claude, pero **no** agregues la línea `Claude-Session:`
  ni ninguna otra URL de la sesión.

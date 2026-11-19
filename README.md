# escenario-engine

Motor del **modo Aventura de Pardalis**: juegos educativos libres para que niñas y niños de 1.º a 3.º de primaria
aprendan inglés. Dibuja personajes y objetos 2D «de papel» parados dentro de un escenario 3D.

> **Estado: versión 3.0 en construcción.** Es una reescritura completa.
> Hoy el paquete ya **valida un nivel completo** (mapa, contenido y assets), genera manifiestos de assets,
> **dibuja el nivel en 3D**, permite **jugarlo entero** (caminar, hablar, elegir, minijuegos y salir),
> **reproduce cinemáticas** y **pasa de un nivel a otro** guardando la partida de cada uno.
> El avance por fases está en [`docs/DISENO-3.0.md` §13](docs/DISENO-3.0.md).

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 1. Paquete | Estructura, construcción a JavaScript con tipos, pruebas, CLI vacío | Hecha |
| 2. Núcleo | Contenido, pasos, condiciones, estado, partida, validación | Hecha |
| 3. Assets | Manifiesto, validación cruzada, carga de SVG | Hecha (`raizDeAssets` no se ha probado contra un CDN real) |
| 4. Escenario | Mapa de Tiled, piso, telones, personajes, cámara | Hecha |
| 5. Interfaz y audio | Globos, opciones, tarjetas, voces | Hecha (el audio no se ha oído en una prueba: verificar en un navegador con sonido) |
| 6. Minijuegos | Minijuegos en un elemento del DOM | Hecha |
| 7. Cinemáticas | Pasos nuevos, saltar, video, modo código | Hecha, salvo la cámara libre de depuración (el video no se ha probado con un MP4 real) |
| 8. Varios niveles | La casa y el barrio de punta a punta | Hecha |

## Ver la demo

```bash
bun install
bun ejemplo/servidor.ts     # y abrir http://localhost:3000
```

Empieza en la casa (`ejemplo/niveles/casa`): una cinemática en la que mamá le pide tortillas a Tommy y que
termina saliendo al barrio (`ejemplo/niveles/barrio`). Ahí Tommy se mueve tocando el piso o con las teclas
`W` `A` `S` `D` y las flechas. Toca a Doña Tortu para hablar con ella y abrir el minijuego de las tortillas
([`ejemplo/tortilleria.ts`](ejemplo/tortilleria.ts)); con las tortillas ya se puede salir por la derecha.
Las cinemáticas se saltan con el botón de abajo a la derecha. Para entrar directo a un nivel:
`http://localhost:3000/?nivel=barrio`.
Las voces del ejemplo no están grabadas, así que se oye la voz sintetizada del navegador.

## Uso

```js
import { crearEscenario } from '@pardalis/escenario-engine';

const juego = await crearEscenario(document.querySelector('#juego'), {
  niveles: { casa: '/niveles/casa/nivel.json', barrio: '/niveles/barrio/nivel.json' },
  nivel: 'casa',
  minijuegos: { Tortilleria },
  partida: JSON.parse(localStorage.getItem('pardalis:partida')),
});

juego.on('guardar', (partida) => localStorage.setItem('pardalis:partida', JSON.stringify(partida)));
```

La API completa (opciones, eventos, minijuegos, cinemáticas) está en [`docs/DISENO-3.0.md`](docs/DISENO-3.0.md).

## Validar un nivel (ya funciona)

```bash
bunx escenario-engine validar niveles/barrio/nivel.json --minijuegos Tortilleria
```

Revisa `nivel.json`, el mapa de Tiled, el contenido y que existan sus imágenes y voces, y lista cada problema
con la ruta de donde está. Cómo se escribe un nivel: [`docs/NIVELES.md`](docs/NIVELES.md).

Para generar el manifiesto de una carpeta de assets (`assets.json`):

```bash
bunx escenario-engine assets niveles/barrio
```

## Desarrollo

Hace falta [Bun](https://bun.sh).

```bash
bun install
bun check            # tipos: debe decir "No type errors"
bun test             # pruebas, incluida la de arquitectura
bun run construir    # genera dist/ (JavaScript y tipos)
bun src/cli.ts validar ejemplo/niveles/barrio/nivel.json --minijuegos Tortilleria
bun src/cli.ts validar ejemplo/niveles/casa/nivel.json
bun src/cli.ts assets ejemplo/niveles/barrio
bun ejemplo/servidor.ts    # la demo, en http://localhost:3000
```

Antes de cambiar código, lee [`AGENTS.md`](AGENTS.md): explica la arquitectura y las reglas para que
cualquier persona entienda el código sin ayuda.

## Licencia

[MPL-2.0](LICENSE).

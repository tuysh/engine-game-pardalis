# escenario-engine

Motor del **modo Aventura de Pardalis**: juegos educativos libres para que niñas y niños de 1.º a 3.º de primaria
aprendan inglés. Dibuja personajes y objetos 2D «de papel» parados dentro de un escenario 3D.

> **Estado: versión 3.0 en construcción.** Es una reescritura completa.
> Hoy el paquete ya se instala y trae sus tipos, pero `crearEscenario()` todavía no dibuja nada:
> rechaza con un `ErrorDeEscenario` que lo dice. El avance por fases está en
> [`docs/DISENO-3.0.md` §13](docs/DISENO-3.0.md).

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 1. Paquete | Estructura, construcción a JavaScript con tipos, pruebas, CLI vacío | Hecha |
| 2. Núcleo | Contenido, pasos, condiciones, estado, partida, validación | Pendiente |
| 3. Assets | Manifiesto, validación cruzada, carga de SVG | Pendiente |
| 4. Escenario | Mapa de Tiled, piso, telones, personajes, cámara | Pendiente |
| 5. Interfaz y audio | Globos, opciones, tarjetas, voces | Pendiente |
| 6. Minijuegos | Minijuegos en un elemento del DOM | Pendiente |
| 7. Cinemáticas | Pasos nuevos, saltar, video, modo código | Pendiente |
| 8. Varios niveles | La casa y el barrio de punta a punta | Pendiente |

## Uso (como quedará)

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

La API completa (opciones, eventos, minijuegos, cinemáticas, niveles) está en [`docs/DISENO-3.0.md`](docs/DISENO-3.0.md).

## Desarrollo

Hace falta [Bun](https://bun.sh).

```bash
bun install
bun check            # tipos: debe decir "No type errors"
bun test             # pruebas, incluida la de arquitectura
bun run construir    # genera dist/ (JavaScript y tipos)
```

Antes de cambiar código, lee [`AGENTS.md`](AGENTS.md): explica la arquitectura y las reglas para que
cualquier persona entienda el código sin ayuda.

## Licencia

[MPL-2.0](LICENSE).

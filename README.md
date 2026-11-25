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
| 7. Cinemáticas | Pasos nuevos, saltar, video, modo código, cámara libre | Hecha (el video no se ha probado con un MP4 real) |
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
`http://localhost:3000/?nivel=barrio`. Con `&depurar` se ven las guías del mapa y la tecla `C` abre la cámara
libre con la que se crean los planos de cámara ([`docs/NIVELES.md`](docs/NIVELES.md)).
Las voces del ejemplo no están grabadas, así que se oye la voz sintetizada del navegador.

## Instalar desde otro proyecto

El paquete todavía no está publicado en npm, así que se instala **desde GitHub**. Lo que se usa es la carpeta
`dist/`, que no está en el repositorio: se construye sola al instalar (el script `prepare`).

Con **npm**, **pnpm** o **yarn** no hay que hacer nada más (hace falta tener [Bun](https://bun.sh) instalado,
porque la construcción lo usa):

```bash
npm install github:tuysh/engine-game-pardalis
```

Con **Bun** hacen falta dos cosas en el `package.json` del proyecto que lo usa, porque Bun no corre los scripts
de una dependencia sin permiso ni instala lo que esa dependencia necesita para construirse:

```json
{
  "dependencies": { "@pardalis/escenario-engine": "github:tuysh/engine-game-pardalis" },
  "trustedDependencies": ["@pardalis/escenario-engine"],
  "devDependencies": { "typescript": "^7.0.2", "@types/bun": "^1.4.4", "@types/three": "^0.187.0" }
}
```

Después de `bun install` ya funcionan `import { crearEscenario } from '@pardalis/escenario-engine'` y
`bunx escenario-engine validar ...`. Si `dist/` no aparece, `bun pm untrusted` dice si el script quedó bloqueado.

Conviene fijar un commit (`github:tuysh/engine-game-pardalis#<commit>`) para que el motor no cambie solo.

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

Con eso el juego muestra el botón de jugar, reproduce la intro de la casa, pasa al barrio y avisa cada vez
que conviene guardar. Solo `nivel` es obligatoria, y una opción en `null` cuenta igual que no ponerla
(por eso funciona el `JSON.parse` de arriba cuando todavía no hay partida guardada).
Todo lo que el paquete ofrece son esa función, el objeto `juego` que entrega y `ErrorDeEscenario`;
lo demás son tipos. Cada uno trae su explicación al pasar el cursor en el editor, y los que se usan
llamándolos (`crearEscenario`, `juego.on`, `Minijuego`, `CinematicaEnCodigo`) traen además un ejemplo.

### El objeto `juego`

```js
juego.on('objetivo', (id) => marcarEnLaLista(id));          // devuelve una función que deja de escuchar
juego.on('palabra', ({ en, es }) => anotarPalabra(en, es));
juego.on('cinematica', ({ fase }) => ocultarMenu(fase === 'inicio'));
juego.on('minijuego', ({ fase }) => ocultarMenu(fase === 'inicio'));
juego.on('estado', ({ variables }) => pintarMonedero(variables.dinero));   // cada vez que cambia una variable
pintarMonedero(juego.estado.obtener('dinero'));                            // y para leerlo cuando haga falta
juego.on('salida', (destino) => irA(destino));              // un destino que no es un nivel: decide el host
juego.on('error', (error) => console.error(error.problemas));

juego.pausar();                 // y juego.reanudar()
juego.proyeccion = true;        // modo salón de clases: todo más grande
await juego.cargar('barrio');   // cambia de nivel en el mismo lienzo
await juego.reproducir('intro');
juego.destruir();               // al salir de la página o desmontar el componente
```

El motor no navega entre páginas ni guarda por su cuenta: avisa con eventos y el host decide.

### Un minijuego

Es una función que recibe un elemento a pantalla completa, dibuja lo que quiera y promete un resultado.
El nivel la llama con el paso `{ "juego": "Tortilleria" }`.

```js
/** @type {import('@pardalis/escenario-engine').Minijuego} */
export function Tortilleria({ elemento, assets, senal }) {
  return new Promise((terminar) => {
    const tortilla = document.createElement('img');
    tortilla.src = assets.url('item_tortillas');
    tortilla.onclick = () => terminar({ exito: true, otorgar: { tortillas: true } });
    elemento.append(tortilla);
    senal.addEventListener('abort', () => terminar({ exito: false }));
  });
}
```

`exito: false` nunca es un castigo: solo lleva al diálogo amable `siNo` del nivel.
Un ejemplo completo: [`ejemplo/tortilleria.ts`](ejemplo/tortilleria.ts).

### Una cinemática en código

Las cinemáticas se escriben en el JSON del nivel ([`docs/NIVELES.md`](docs/NIVELES.md)). Cuando hace falta
lógica, se escriben en código con los mismos pasos, y se registran en `crearEscenario({ cinematicas: { intro } })`:

```js
/** @type {import('@pardalis/escenario-engine').CinematicaEnCodigo} */
export async function intro(escena) {
  await escena.fundido('abrir', { duracion: 1 });
  await escena.juntos(escena.aparece('mama', 'puerta'), escena.sonido('puerta_abre'));
  await escena.camina('mama', 'junto_al_sillon');
  await escena.dice('mama', '¿Me traes tortillas, mijo?', { audio: 'vo_mama_tortillas' });
  if (!escena.estado.cumple('tengo tortillas')) {
    escena.sale('barrio');
  }
}
```

Para pausar se usa `escena.espera(segundos)` y no `setTimeout`: así la cinemática se puede saltar.

### Mientras carga y si algo falla

```js
import { crearEscenario, ErrorDeEscenario } from '@pardalis/escenario-engine';

const cancelacion = new AbortController();   // cancelacion.abort() si el componente se desmonta mientras carga
try {
  const juego = await crearEscenario(elemento, {
    nivel: '/niveles/casa/nivel.json',
    alCargar: ({ cargados, total }) => dibujarBarra(cargados / total),
    senal: cancelacion.signal,
  });
} catch (error) {
  if (error instanceof ErrorDeEscenario) mostrar(error.problemas.join('\n'));
}
```

`error.problemas` trae **todos** los problemas juntos, cada uno con la ruta donde está: los del nivel
(el mapa, el contenido, una imagen que falta) y también los de la llamada, por ejemplo
`opciones.nivel: "csa" no está en "niveles" (casa, barrio) ni es la dirección de un nivel.json`.
Una opción que no existe (un nombre mal escrito) solo da una advertencia en la consola.

Con `depurar: true` se ven las guías del mapa y la tecla `C` abre la cámara libre.

La referencia completa (todas las opciones, eventos, minijuegos y cinemáticas) está en
[`docs/DISENO-3.0.md`](docs/DISENO-3.0.md).

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

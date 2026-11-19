# escenario-engine 3.0 — diseño de la API

Estado: **diseño acordado y construido** (el avance por fases está en el [`README`](../README.md)).
Los detalles que el diseño no decía y se definieron al construir están reunidos en §7.6, para que el equipo
los revise en un solo lugar.
Es una **reescritura completa**: no se mantiene compatibilidad con la versión 2.0 (`EscenarioEngine` sobre Phaser),
ni con sus mapas, ni con sus partidas guardadas.

## 1. Objetivo

Un paquete simple de usar que dibuje el modo Aventura de Pardalis con estilo «papel»:
**personajes y objetos 2D parados dentro de un escenario 3D**, con cámara en perspectiva.

Decisiones ya tomadas:

| Decisión | Resultado |
| --- | --- |
| Motor gráfico | **Three.js** (se retira Phaser) |
| Mapa | **Tiled visto desde arriba** (plano del lugar) |
| API pública | **Totalmente en español** |
| Framework del host | **Ninguno**: el paquete funciona igual en Svelte, Astro o JavaScript sin framework |
| Assets | Configurables: **carpeta local o CDN**. El arte es **SVG** |
| Cinemáticas | Tres formas: **JSON**, **código** y **video pregrabado** |
| La casa | Nivel intermedio: solo aloja la intro y lleva al escenario principal |
| Animaciones | **Archivos SVG numerados** que se agrupan solos |
| Planos de cámara | Se crean con la **cámara libre del modo depuración**; no habrá editor aparte |
| Versión anterior | **Se reescribe todo.** Sin compatibilidad hacia atrás |

Principios de Pardalis que no cambian: nunca castigar, nada requiere leer, el motor no navega entre páginas
ni guarda por su cuenta, y lo que pasa la validación no falla al jugar.

## 2. Reescritura: qué se toma de la versión anterior

El código se escribe de nuevo. De la versión 2.0 se toman **ideas**, no archivos ni formatos:

| Idea que se mantiene | Por qué |
| --- | --- |
| Un nivel es **datos** (mapa + contenido), no código | Quien escribe niveles no programa. |
| Núcleo de lógica separado del dibujo, sin importar el motor gráfico | Permite validar niveles en CI sin navegador y probar la lógica sin WebGL. |
| Validación por fases con mensajes que apuntan a la ruta del problema | Un nivel roto se detecta antes de jugar. |
| Diálogos como lista de pasos con condiciones | Las cinemáticas usan ese mismo lenguaje. |
| El motor avisa con eventos y el host decide guardar y navegar | El paquete no impone dónde se guarda. |

Lo que **no** se arrastra: Phaser, el formato v1 sin mapa, los mapas en coordenadas de pantalla, el contrato de
minijuegos sobre escenas del motor gráfico, las migraciones de partidas viejas y las advertencias de deprecación.
El formato del contenido puede cambiar donde haga falta para quedar más simple.

### Estructura del código nuevo

```
src/
  dominio/       reglas puras: nivel, pasos, condiciones, estado, partida, geometría, validación, manifiesto de assets
  puertos/       interfaces de lo que la aplicación necesita del exterior
  aplicacion/    casos de uso: validar y cargar un nivel, ejecutar pasos, cinemáticas, minijuegos, guardar
  adaptadores/   una carpeta por tecnología: three/ dom/ audio/ red/ archivos/ tiled/ json/ memoria/
  crear.ts       crearEscenario(): la única puerta de entrada en el navegador
  validar.ts     entrada sin navegador, para validar niveles en CI
  cli.ts         validar y generar manifiestos
```

`dominio/` nunca importa `three` ni toca el DOM. La arquitectura (hexagonal) y sus reglas están en
[`AGENTS.md` §3](../AGENTS.md).

## 3. Uso mínimo

```js
import { crearEscenario } from '@pardalis/escenario-engine';

const juego = await crearEscenario(document.querySelector('#juego'), {
  niveles: {
    casa: '/niveles/casa/nivel.json',
    barrio: '/niveles/barrio/nivel.json',
  },
  nivel: 'casa',
  minijuegos: { Tortilleria },
  partida: JSON.parse(localStorage.getItem('pardalis:partida')),
});

juego.on('guardar', (partida) => localStorage.setItem('pardalis:partida', JSON.stringify(partida)));
```

Eso es todo lo necesario para: mostrar el botón de jugar, reproducir la intro de la casa, pasar al barrio
y avisar cada vez que conviene guardar.

## 4. `crearEscenario(elemento, opciones)`

Devuelve una promesa que **se resuelve cuando el nivel ya se puede jugar** y **rechaza** con `ErrorDeEscenario`
si no pudo arrancar. `error.problemas` es la lista de mensajes del validador (uno por problema, con su ruta).

`elemento` es un `HTMLElement`. El motor ocupa todo su tamaño y se adapta si cambia.

### Opciones

| Opción | Tipo | Por defecto | Qué es |
| --- | --- | --- | --- |
| `niveles` | `Record<string, string>` | — | Id de nivel → URL de su `nivel.json`. |
| `nivel` | `string` | — | Id del nivel inicial, o directamente una URL si solo hay un nivel. |
| `minijuegos` | `Record<string, Minijuego>` | `{}` | Ver §6. |
| `cinematicas` | `Record<string, Cinematica>` | `{}` | Cinemáticas escritas en código. Ver §7. |
| `partida` | `object \| null` | `null` | Partida a restaurar. Corrupta o de otra versión: se ignora con advertencia. Si nombra un nivel de `niveles`, el juego continúa en ese nivel y no en `nivel`. |
| `raizDeAssets` | `string` | junto a cada `nivel.json` | Carpeta o CDN donde están los assets. Ver §8. |
| `origenesPermitidos` | `string[]` | `[]` | Orígenes HTTPS externos permitidos (el CDN). |
| `idioma` | `'es' \| 'en'` | `'es'` | Idioma base de la interfaz. |
| `iniciarCon` | `'boton' \| 'host'` | `'boton'` | Quién da el primer toque que desbloquea el audio. Ver §7.5. |
| `proyeccion` | `boolean` | `false` | Modo salón de clases: todo más grande. |
| `alCargar` | `({ cargados, total }) => void` | — | Progreso de carga de las imágenes de cada nivel, para que el host dibuje su propia barra. Avisa una vez al empezar (0 de `total`) y otra por cada archivo. |
| `senal` | `AbortSignal` | — | Cancela la creación (por ejemplo, si el componente se desmonta mientras carga). |
| `depurar` | `boolean` | `false` | Dibuja piso, huellas y zonas, y activa la cámara libre (§9.3). |
| `semilla` | `number` | — | Hace reproducible el azar (pruebas). |

### El objeto `juego`

| Miembro | Qué hace |
| --- | --- |
| `on(evento, funcion)` | Escucha un evento. **Devuelve una función que cancela la suscripción.** |
| `guardar()` | Devuelve la partida actual como objeto plano. |
| `cargar(nivel)` | Cambia de nivel reutilizando el mismo lienzo. `nivel` es un id de `niveles` o la dirección de un `nivel.json`. Promesa que se resuelve cuando ya se puede jugar y rechaza con `ErrorDeEscenario` si el nivel tiene errores o no cargó alguna de sus imágenes (entonces sigue el nivel que estaba). |
| `reproducir(idDeCinematica)` | Lanza una cinemática del nivel actual, aunque ya se haya visto. Promesa que se resuelve al terminar. |
| `interrumpir()` | Salta la cinemática o cierra el diálogo en curso. |
| `pausar()` / `reanudar()` | Congela y reanuda juego, audio y video. |
| `proyeccion` | Propiedad booleana; se puede cambiar sin reiniciar. |
| `nivel` | Id del nivel actual (solo lectura). |
| `destruir()` | Libera todo: WebGL, audio, video, temporizadores y oyentes. Se puede llamar más de una vez. |

### Eventos

| Evento | Dato | Cuándo |
| --- | --- | --- |
| `guardar` | `partida` | Cada vez que conviene guardar: objetivo cumplido, fin de cinemática, cambio de nivel. |
| `objetivo` | `id` | Se cumplió un objetivo. |
| `palabra` | `{ en, es }` | Se mostró una tarjeta de vocabulario. |
| `nivel` | `{ id, anterior }` | Se terminó de cargar otro nivel. `anterior` es el id del que se dejó. |
| `cinematica` | `{ id, fase }` | `fase` es `'inicio'` o `'fin'`. Sirve para ocultar la interfaz del host. |
| `salida` | `destino` | El jugador salió hacia un destino que **no** es un nivel registrado: el host decide. |
| `error` | `ErrorDeEscenario` | Falla después de arrancar (por ejemplo, un nivel siguiente que no carga). |

Cuando `sale` o la salida del mapa nombran un nivel de `niveles`, el motor lo carga solo y emite `nivel`.
Cualquier otro destino (`"Selector"`, `"Creditos"`) llega al host por `salida`.

Si una función que escucha un evento lanza un error, el motor lo muestra en la consola y sigue:
un descuido del host no deja una cinemática o un diálogo a medias.

## 5. Niveles

### 5.1 Estructura de carpetas

```
niveles/
  comun/                 assets compartidos: personajes, sonidos de interfaz, música
    assets.json          (generado)
  casa/
    nivel.json
    mapa.tmj
    contenido.json
    assets.json          (generado)
    img/  voz/  video/
  barrio/
    ...
```

### 5.2 `nivel.json`

```json
{ "mapa": "mapa.tmj", "contenido": "contenido.json", "assets": [".", "../comun"] }
```

Todas las rutas son relativas al propio `nivel.json`.

### 5.3 La casa como nivel intermedio

`casa/contenido.json` no declara `jugador` con control libre: solo una cinemática `alEntrar` que termina con
`{ "sale": "barrio" }`. El motor carga `barrio` y ahí empieza el juego de verdad.

## 6. Minijuegos

Un minijuego ya no recibe una escena del motor gráfico: recibe **un elemento del DOM** a pantalla completa
encima del escenario. Puede llenarlo con lo que quiera: un componente, un `<canvas>` o HTML a mano.

```js
/** @type {import('@pardalis/escenario-engine').Minijuego} */
export function Tortilleria({ elemento, config, estado, audio, assets, senal }) {
  return new Promise((terminar) => {
    // ...dibujar dentro de `elemento`...
    // terminar({ exito: true, otorgar: { tortillas: true } });
  });
}
```

| Campo | Qué es |
| --- | --- |
| `elemento` | `HTMLElement` vacío. El motor lo crea antes y lo borra después. Está en el DOM normal, así que le aplican los estilos del host. |
| `config` | Lo que venga en el paso `{ "juego": ..., "config": ... }`. |
| `estado` | Solo lectura: `obtener(nombre)`, `cumple(condicion)`. Para cambiarlo se usa `otorgar` en el resultado. |
| `audio` | `tocar(clave)` y `decir(texto, idioma, clave?)`. |
| `assets` | `url(clave)` para usar imágenes del manifiesto. |
| `senal` | `AbortSignal`: se dispara si el host destruye el juego. El minijuego debe limpiar lo suyo. |

Resultado: `{ exito: boolean, otorgar?: Record<string, valor> }`. Si la función lanza un error se trata como
`{ exito: false }` y sigue el diálogo amable `siNo`.

El motor coloca `elemento` a pantalla completa con un marco propio, así que el minijuego puede ponerle cualquier
estilo sin perder su lugar. Un ejemplo completo está en [`ejemplo/tortilleria.ts`](../ejemplo/tortilleria.ts).

## 7. Cinemáticas

Una cinemática es una lista de **pasos**: el mismo lenguaje que ya usan los diálogos, con pasos nuevos.
Se declara en `contenido.json` y se escribe de una de tres formas.

### 7.1 Declaración

```jsonc
"cinematicas": {
  "intro": {
    "inicia": "alEntrar",        // alEntrar | { "zona": id } | { "objetivo": id } | "manual"
    "cuando": "no vista.intro",  // opcional; por defecto cada cinemática se ve una sola vez
    "saltable": true,
    "pasos": [ ... ]             // o bien  "codigo": "intro"
  }
}
```

Al terminar, el motor marca `vista.<id>` en el estado.

### 7.2 Pasos nuevos

| Paso JSON | En código | Qué hace |
| --- | --- | --- |
| `{ "juntos": [ ...pasos ] }` | `escena.juntos(a, b)` | Varios pasos a la vez; sigue cuando todos terminan. |
| `{ "espera": 2 }` | `escena.espera(2)` | Pausa en segundos. |
| `{ "camara": "plano", "duracion": 2 }` | `escena.camara('plano', { duracion })` | Mueve la cámara a un plano, a un personaje o a `"jugador"`. Sin `duracion`, corte directo. |
| `{ "mira": "tommy", "hacia": "mama" }` | `escena.mira('tommy', 'mama')` | Voltea a un personaje, con giro de papel. |
| `{ "anima": "tommy", "con": "clave", "repite": true }` | `escena.anima('tommy', 'clave', { repite })` | Reproduce una animación del manifiesto. |
| `{ "aparece": "mama", "en": "puerta" }` | `escena.aparece('mama', 'puerta')` | Mete un personaje en un punto del mapa. |
| `{ "desaparece": "mama" }` | `escena.desaparece('mama')` | Lo saca. |
| `{ "musica": "clave" }` / `{ "sonido": "clave" }` | `escena.musica()` / `escena.sonido()` | Audio. |
| `{ "fundido": "abrir", "duracion": 1 }` | `escena.fundido('abrir', { duracion })` | `abrir` o `cerrar` a negro. |
| `{ "video": "clave" }` | `escena.video('clave')` | Video a pantalla completa. Ver §7.4. |
| `{ "sale": "barrio" }` | `escena.sale('barrio')` | Termina el nivel hacia un destino. |

Los pasos que ya existían siguen igual: `dice`, `camina`, `efecto`, `pon`, `secuencia`, `cuando`.
Dentro de una cinemática **no** se permiten `elige` ni `juego` (el validador lo marca como error).

### 7.3 En código

```js
// cinematicas/intro.js
export async function intro(escena) {
  await escena.fundido('abrir', { duracion: 1 });
  escena.anima('tommy', 'tommy_viendo_tele', { repite: true });
  await escena.espera(2);
  await escena.juntos(escena.aparece('mama', 'puerta'), escena.sonido('puerta_abre'));
  await escena.camina('mama', 'junto_al_sillon');
  await escena.dice('mama', '¿Me traes tortillas, mijo?', { audio: 'vo_mama_tortillas' });
  escena.sale('barrio');
}
```

Se registra en `crearEscenario({ cinematicas: { intro } })` y en el JSON se declara `"codigo": "intro"`.
`escena` ofrece además `escena.efecto()`, `escena.secuencia()`, `escena.estado` (lectura y `pon`) y `escena.senal`.
El paso `cuando` no tiene método: en código se escribe un `if` con `escena.estado.cumple('...')`.

El validador no puede leer el código, así que cada método revisa al ejecutarse que exista lo que nombra
(personajes, puntos, planos, animaciones). Si algo no existe, lanza un error que dice qué llamada fue;
la cinemática termina ahí, el juego sigue y el host recibe el evento `error`.

**Regla para quien escribe código:** usar `escena.espera()` y no `setTimeout`, para que la cinemática se pueda saltar.

### 7.4 Video

```jsonc
{ "video": "intro_tele" }
{ "video": { "es": "intro_es", "en": "intro_en" } }   // si lleva voces
```

- El video es un asset del manifiesto: el validador sabe si existe.
- Formato: **MP4 (H.264 + AAC)**, que funciona en iPad y en Chrome.
- Mientras se reproduce, el nivel termina de cargar por detrás.
- Si el video no se puede reproducir, la cinemática continúa con el paso siguiente (nunca se queda trabada).

### 7.5 Reglas

- **Saltar** pone la cinemática en modo rápido: cada paso se resuelve al instante dejando su resultado final
  (personajes en su destino, `pon` aplicados; líneas y videos omitidos). Vale igual para JSON y para código.
- Durante una cinemática se bloquean toques y teclado y aparecen las franjas de cine.
- **Audio al inicio:** los navegadores no dejan sonar nada hasta el primer toque. Con `iniciarCon: 'boton'`
  el motor muestra un botón grande de jugar; con `'host'` el host garantiza que ya hubo un toque.
- Con «movimiento reducido» activo en el sistema, los movimientos de cámara se vuelven cortes.
- Si se guarda a media cinemática, al volver empieza de nuevo.

### 7.6 Detalles definidos al construir

El diseño no decía estos detalles; así quedaron. Si alguno debe cambiar, se cambia aquí primero.

- **`sale` no corta la escena.** El nivel termina cuando el diálogo o la cinemática acaba; lo que siga a `sale`
  todavía se ejecuta. Vale igual para `escena.sale()` en código.
- **Al terminar una escena,** si la cámara quedó en otro lado regresa sola al jugador (un viaje corto) y la
  pantalla se aclara. No pasa si la escena pidió salir: la pantalla puede quedar en negro mientras carga el
  nivel siguiente. Un nivel que empieza sin cinemática de entrada abre la pantalla de una vez.
- **`fundido`:** `abrir` siempre parte de negro; `cerrar` parte de lo oscura que ya esté la pantalla.
- **Entre un nivel y otro** la pantalla se cierra sola a negro (si una cinemática no la cerró ya) y el nivel
  nuevo la abre al empezar: con su cinemática de entrada o, si no tiene, con un fundido corto.
  `juego.cargar()` no cierra la pantalla: ahí el host decide su propia transición.
- **Una cinemática espera su turno:** nunca interrumpe un diálogo; varias en espera se reproducen en orden.
  La de un objetivo que ya venía cumplido en la partida, si no se había visto, empieza al entrar al nivel.
- **Al saltar** se omiten las líneas, los efectos, las esperas, los sonidos, los videos y las animaciones que
  pasan una sola vez; todo lo demás deja su resultado final. `juego.interrumpir()` salta también una
  cinemática con `saltable: false`: ese campo solo decide si el jugador ve el botón.
- **`anima`** sin `repite` regresa al personaje a su `sprite` al terminar; con `repite` lo deja con el dibujo nuevo.
  Un `sprite` o un objeto del decorado que sean animación se repiten solos todo el tiempo.
- **`aparece`** con alguien que ya está en el escenario solo lo cambia de lugar. Quien entra con `aparece`
  puede tener diálogo en `npcs` aunque no esté en el mapa. **`desaparece`** no acepta al personaje del jugador.
- **Con el botón de inicio** (`iniciarCon: 'boton'`) el tiempo no pasa hasta que lo tocan: la cinemática de
  entrada empieza con ese toque.
- **El id de un nivel** es su clave en `niveles`; si se cargó por su dirección, es el `meta.id` de su contenido.
- **Desde que un nivel sale hacia otro,** la partida ya dice que el jugador está en el nivel de destino
  (`partida.nivel`), aunque ese nivel todavía esté cargando. Así, si el juego se cierra en ese momento,
  continúa en el destino y no en un nivel intermedio (como la casa) que ya no tiene nada que hacer.
- **Si el nivel siguiente no logra empezar** (por ejemplo, no cargó una imagen), se vuelve a jugar el anterior
  con su estado guardado y el host recibe el evento `error`.
- **Cada nivel tiene su propio estado.** Un nivel no puede preguntar por las variables de otro.
- **Todavía no se hace:** que el nivel termine de cargar por detrás mientras se ve un video (§7.4).

## 8. Assets

### 8.1 Manifiesto generado

Cada carpeta de assets lleva un `assets.json` que **nadie escribe a mano**:

```bash
bunx escenario-engine assets niveles/casa
```

```jsonc
{
  "spr_mama":          { "tipo": "imagen", "archivo": "img/spr_mama.svg", "ancho": 110, "alto": 170 },
  "tommy_viendo_tele": { "tipo": "animacion", "cuadros": ["img/tommy_viendo_tele_1.svg", "img/tommy_viendo_tele_2.svg"], "fps": 4, "ancho": 90, "alto": 160 },
  "vo_mama_tortillas": { "tipo": "audio", "archivo": "voz/vo_mama_tortillas.mp3" },
  "intro_tele":        { "tipo": "video", "archivo": "video/intro_tele.mp4" }
}
```

- La **clave** es el nombre del archivo sin extensión.
- La duración de audios y videos no se guarda: el navegador la conoce al cargarlos.
- Si la misma clave está en dos carpetas de `assets` de un nivel, **gana la primera de la lista**
  (la del nivel antes que `comun`) y el validador lo advierte.
- **Animación:** archivos numerados `clave_1.svg`, `clave_2.svg`… se agrupan solos en una animación, en orden numérico.
  Todos los cuadros deben tener el mismo `viewBox`; si no, el generador da error.
  Los `fps` (por defecto 8) se ajustan en un archivo opcional `assets.config.json` que el generador respeta.
- El validador cruza cada clave del mapa y del contenido contra el manifiesto: imagen o video que falta es
  **error**; voz que falta es **advertencia** (se usa voz sintetizada, sin pedir el archivo).

### 8.2 SVG

- El motor convierte cada SVG en textura al tamaño que se verá en pantalla, así que se ve nítido en tablet y en proyector.
- El generador exige que cada SVG tenga `viewBox` (o `width` y `height`); de ahí salen `ancho` y `alto`.
- Advertencia si un SVG depende de archivos externos (fuentes o imágenes enlazadas): al usarse como textura no se cargan.
- También se aceptan `.webp` y `.png` para fondos pintados.

### 8.3 Carpeta o CDN

Por defecto los assets se buscan junto a cada `nivel.json`. Para servirlos desde otro lugar:

```js
crearEscenario(elemento, {
  raizDeAssets: 'https://assets.pardalis.mx/aventura/',
  origenesPermitidos: ['https://assets.pardalis.mx'],
  ...
});
```

La estructura de carpetas es la misma en ambos casos; solo cambia la raíz. Así en desarrollo se usa la carpeta
local y en producción el CDN, sin tocar los niveles.

La raíz ocupa el lugar de **la carpeta que contiene a las carpetas de los niveles**. Con el nivel en
`/niveles/barrio/nivel.json` y la raíz de arriba, la carpeta de assets `"."` es
`https://assets.pardalis.mx/aventura/barrio/` y `"../comun"` es `https://assets.pardalis.mx/aventura/comun/`.
Los manifiestos `assets.json` también se leen de ahí.

- **El CDN debe enviar cabeceras CORS** (`Access-Control-Allow-Origin`). Sin ellas el navegador no permite usar
  las imágenes como texturas.
- Seguridad (igual que hoy): claves relativas, sin `..`, sin URLs completas dentro de los niveles, y solo el
  mismo origen o los de `origenesPermitidos`.

### 8.4 Carga

1. **Antes de arrancar:** imágenes del escenario, personajes presentes y sonidos de interfaz.
2. **En segundo plano:** voces, en el orden en que pueden aparecer; videos, al acercarse su paso.
3. **Entre niveles:** se conserva lo que el nivel nuevo también usa (la carpeta `comun`) y se libera el resto.

## 9. Mapa y escenario 3D

### 9.1 Tiled visto desde arriba

El mapa es el **plano del lugar**. `x` es izquierda–derecha; `y` es profundidad (más abajo en Tiled = más cerca
de la cámara). La altura no se dibuja en el mapa: sale del tamaño de cada sprite.

| Capa | Tipo | Contenido |
| --- | --- | --- |
| `suelo` | Capa de imagen | La textura del piso, tal como se ve desde arriba. |
| `telones` | Capa de objetos | Líneas donde se levanta un fondo vertical (fachadas, cielo). Propiedades `asset` y `alto`. |
| `decorado` | Capa de objetos | Rectángulos: su forma es **la huella real** del objeto en el piso. Propiedad `asset` y clase del catálogo. |
| `npcs` | Capa de objetos | Un punto por personaje: `id`, `mira`. |
| `interaccion` | Capa de objetos | `inicioJugador`, `punto`, `salida`, `zona`. |
| `piso` | Capa de objetos | Polígonos por donde se puede caminar. |

Lo que se dibuja en el plano es exactamente lo que bloquea el paso: no hay ajustes de «huella» a mano.

El **catálogo de decorado** tiene tres clases, que dicen cómo se dibuja el objeto y sirven para cualquier lugar:
`parado` (papel vertical; bloquea el paso), `plano` (pintado sobre el piso; se puede pisar) y `colgado`
(papel vertical en lo alto; no bloquea).

Una **zona** se identifica por su nombre y puede llevar `grupo` (qué lista de `comentarios` del contenido se usa
al entrar) y `espera` (segundos antes de repetir, por defecto 20).

Un **NPC** del mapa debe ser un personaje de `meta.personajes`. Su diálogo en el contenido es opcional:
sin él, el personaje está en el escenario pero no se puede tocar.

El detalle de cada capa y propiedad está en [`NIVELES.md`](NIVELES.md).

### 9.2 Unidades

`mundo.pixelesPorMetro` (por defecto 100) convierte tanto los píxeles del mapa como los de los sprites.
Un personaje de 160 px de alto mide 1.6 m en el escenario.

### 9.3 Cámara y planos

- Cámara en perspectiva que sigue al jugador con un ángulo fijo configurable en `mundo.camara`, con los mismos
  campos que un plano: `{ "distancia": 8, "altura": 4, "giro": 0 }` (metros y grados; esos son los valores por defecto).
- Los **planos** para cinemáticas viven en `mundo.planos`:

```jsonc
"planos": { "plano_sala": { "mira": "sillon", "distancia": 6, "altura": 2.5, "giro": 20 } }
```

- Los planos se crean con la **cámara libre** del modo depuración (`depurar: true`). No hay editor aparte.

| Control | Acción |
| --- | --- |
| `C` | Entra o sale de la cámara libre (el juego se pausa mientras tanto) |
| Arrastrar | Gira alrededor del punto que se mira; hacia arriba o abajo, baja o sube la cámara |
| Rueda | Acerca o aleja |
| Clic en un personaje, en un objeto con `id` o cerca de un punto | Lo fija como `mira` del plano |
| `P` | Copia el plano actual como JSON, listo para pegar en `mundo.planos` |
| `1`–`9` | Salta a los planos ya definidos, para compararlos |

Es parte del motor, pero solo se carga con `depurar: true`: no pesa en producción.
En ese modo se dibujan también las guías del mapa (piso, huellas, zonas, salida y puntos, con su nombre).

### 9.4 Lo que se dibuja dónde

| Qué | Dónde |
| --- | --- |
| Piso, telones, decorado, personajes, sombras, efectos | Three.js (WebGL) |
| Globos de diálogo, opciones, tarjetas de vocabulario, botones, franjas de cine, video | DOM encima del lienzo |

La interfaz en DOM da texto nítido y accesible. Vive dentro de un *shadow root*, así los estilos del host
(Tailwind incluido) no la rompen. Se personaliza con variables CSS: `--escenario-fuente`, `--escenario-color-globo`…

### 9.5 Controles

El jugador se mueve de dos formas, que conviven:

- **Tocar o hacer clic** en un lugar del piso: su personaje camina hasta ahí. Tocar a un personaje o a un objeto
  interactivo lo lleva junto a él y empieza su diálogo.
- **Teclado:** mantener oprimida `W` `A` `S` `D` o una flecha lo hace caminar hacia ese lado. El teclado manda
  sobre el lugar tocado. Durante un diálogo o un minijuego no mueve al jugador.

En los diálogos, `Enter` o la barra espaciadora siguen la línea, y las teclas `1` a `9` eligen una opción.

## 10. Partida

La partida guarda el estado de cada nivel visitado:

```jsonc
{ "v": 1, "nivel": "barrio", "niveles": { "casa": { "estado": { ... } }, "barrio": { "estado": { ... }, "momento": { ... } } } }
```

Una partida corrupta o de otra versión se ignora con advertencia; nunca impide jugar.
No se leen partidas de la versión 2.0.

## 11. Paquete

- Se publica **JavaScript compilado** (ESM) con tipos `.d.ts`: funciona en cualquier empaquetador y da
  autocompletado aunque el host esté escrito en JavaScript.
- **Ningún framework como dependencia.** Dependencias: `three` y `zod`.
- **Importar el paquete no toca `window` ni `document`**: se puede importar en código que también corre en
  el servidor. Solo `crearEscenario()` necesita navegador.
- Entradas: `@pardalis/escenario-engine` (navegador) y `@pardalis/escenario-engine/validar` (sin navegador).
- CLI: `escenario-engine validar <nivel.json> [--minijuegos A,B]` y `escenario-engine assets <carpeta>`;
  corre en Bun y en Node.
- Se quita `private: true` y `typescript` deja de ser dependencia de quien lo usa.

## 12. Uso por framework

**Svelte 5 (JavaScript)**

```svelte
<script>
  import { crearEscenario } from '@pardalis/escenario-engine';
  let { opciones } = $props();
  let elemento;

  $effect(() => {
    const cancelar = new AbortController();
    let juego;
    crearEscenario(elemento, { ...opciones, senal: cancelar.signal })
      .then((creado) => { juego = creado; })
      .catch((error) => console.error(error.problemas ?? error));
    return () => { cancelar.abort(); juego?.destruir(); };
  });
</script>

<div bind:this={elemento} class="h-full w-full"></div>
```

**Astro**

```astro
<div id="juego" style="width:100%;height:100vh"></div>
<script>
  import { crearEscenario } from '@pardalis/escenario-engine';
  const juego = await crearEscenario(document.querySelector('#juego'), { nivel: '/niveles/casa/nivel.json' });
  addEventListener('pagehide', () => juego.destruir());
</script>
```

**JavaScript sin framework:** igual que el `<script>` de Astro, en un `<script type="module">`.

Un minijuego puede estar hecho con cualquier framework, porque solo recibe un elemento:

```js
import { mount, unmount } from 'svelte';
import Juego from './Tortilleria.svelte';

export const Tortilleria = ({ elemento, config, audio, senal }) =>
  new Promise((terminar) => {
    const componente = mount(Juego, { target: elemento, props: { config, audio, terminar } });
    senal.addEventListener('abort', () => unmount(componente), { once: true });
  });
```

## 13. Orden de construcción

Repositorio limpio: se parte de cero y la versión 2.0 queda en el historial de git.

1. **Paquete:** estructura, build a JavaScript con tipos, pruebas, CLI vacío. Se puede instalar desde otro proyecto.
2. **Núcleo:** esquema del contenido, pasos, condiciones, estado, partida, validación. Todo con pruebas, sin navegador.
3. **Assets:** generador de manifiesto, validación cruzada, `raizDeAssets`, carga de SVG como textura.
4. **Escenario:** lector de Tiled desde arriba, piso, telones, personajes de papel, cámara que sigue al jugador.
5. **Interfaz y audio:** globos, opciones, tarjetas de vocabulario, voces con respaldo de voz sintetizada.
6. **Minijuegos en DOM.**
7. **Cinemáticas:** pasos nuevos, `juntos`, saltar, video, modo código, cámara libre de depuración.
8. **Varios niveles:** la casa y el barrio de punta a punta, con partida.

Cada fase termina con tipos y pruebas en verde, el validador aceptando el nivel de ejemplo y la demo funcionando.

## 14. Pendiente

- Nombres finales de los eventos (§4): se ajustan al usarlos en el primer host real.
- Cargar el nivel por detrás de un video (§7.4).
- El campo `momento` de la partida (§10): hoy, al volver a un nivel, el jugador aparece en su inicio.

Resuelto: el motor se escribe en **TypeScript estricto** y se publica como JavaScript compilado con tipos
(ver `AGENTS.md` §4.5).

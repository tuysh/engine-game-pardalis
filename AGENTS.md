# AGENTS.md — contexto y reglas del proyecto

Este archivo es para **personas y agentes de IA** que van a leer o cambiar el código.
Léelo completo antes de tocar algo. El diseño acordado de la API está en [`docs/DISENO-3.0.md`](docs/DISENO-3.0.md).

> **La regla que manda sobre todas las demás:**
> el código se escribe para que **una persona lo entienda sin ayuda de IA**.
> **Entendible >>> rendimiento.** Entendible >>> corto. Entendible >>> ingenioso.

---

## 1. Qué es el proyecto

`escenario-engine` es el motor del **modo Aventura de Pardalis**: juegos educativos libres para que niñas y niños
de 1.º a 3.º de primaria aprendan inglés. Muchos **todavía no leen con soltura**.

- **Estilo «papel»:** personajes y objetos 2D parados dentro de un escenario 3D, con cámara en perspectiva.
- **Un nivel son datos, no código:** un mapa de Tiled visto desde arriba (el **dónde**) y un JSON de contenido
  (el **qué pasa**: personajes, diálogos, cinemáticas, minijuegos).
- **Es una librería sin framework:** recibe un elemento del DOM y funciona igual en Svelte, Astro o JavaScript a secas.
- **Lo mantienen voluntarias y voluntarios** que llegan sin contexto y, muchas veces, sin herramientas de IA.
  Por eso la legibilidad no es un gusto: es lo que permite que el proyecto siga vivo.

Esta versión (3.0) es una **reescritura completa**. No hay compatibilidad con versiones anteriores que cuidar.

| Tecnología | Para qué |
| --- | --- |
| TypeScript (estricto) | Todo el código del motor |
| Bun | Instalar, probar, revisar tipos y construir |
| Three.js | Dibujar el escenario 3D |
| Zod | Leer y revisar los JSON de los niveles |
| Licencia MPL-2.0 | Ver `LICENSE` |

## 2. Principios de Pardalis (no se negocian)

1. **Nunca castigar.** No hay vidas, derrotas ni mensajes de «incorrecto». Un minijuego que falla o lanza un error
   lleva a un diálogo amable.
2. **Nada requiere leer.** Todo aviso tiene audio **e** imagen. El texto acompaña; nunca es la única pista.
3. **El motor no decide por el host.** No navega entre páginas, no guarda en `localStorage`, no rastrea.
   Avisa con eventos y el host decide.
4. **Un nivel roto se detecta antes de jugar.** Lo que pasa la validación no falla durante el juego.
5. **Solo se piden archivos permitidos.** Assets por clave relativa, sin `..` ni URLs completas dentro de los niveles.

## 3. Arquitectura hexagonal

La idea en una frase: **las reglas del juego viven en el centro y no saben con qué se dibujan, suenan o cargan.**
Todo lo de afuera (Three.js, el DOM, el audio, la red, Tiled) se conecta por medio de **puertos**.

```
                 host (Svelte, Astro, JavaScript)          línea de comandos
                           │                                     │
                           ▼                                     ▼
                     src/crear.ts                           src/cli.ts
              (arma todo y lo conecta)                (arma solo lo necesario)
                           │
        ┌──────────────────┼────────────────────────────────────────┐
        │                  ▼                                        │
        │   adaptadores/   three/   dom/   audio/   red/   archivos/   tiled/   json/   memoria/
        │        │ implementan
        │        ▼
        │   puertos/       Escenario · Interfaz · Audio · Video · Controles · Cargador · LectorDeNiveles · LectorDeMapas · Reloj · Azar
        │                  (y los de la línea de comandos: Carpetas · EscritorDeManifiestos)
        │        ▲ usan
        │        │
        │   aplicacion/    cargar un nivel · ejecutar pasos · cinemáticas · minijuegos · guardar
        │        │ usa
        │        ▼
        │   dominio/       nivel · pasos · condiciones · estado · partida · geometría · validación
        └───────────────────────────────────────────────────────────┘
```

### Las carpetas

| Carpeta | Qué contiene | Puede importar de |
| --- | --- | --- |
| `src/dominio/` | Las reglas puras: qué es un nivel, un paso, una condición; cómo cambia el estado; qué es válido. Solo datos y funciones. | **Nada** fuera de `dominio/` |
| `src/puertos/` | Interfaces de TypeScript que describen lo que la aplicación **necesita** del exterior. No tienen código que se ejecute. | `dominio/` |
| `src/aplicacion/` | Los casos de uso: lo que el motor **hace**. Coordina dominio y puertos. | `dominio/`, `puertos/` |
| `src/adaptadores/` | Una carpeta por tecnología. Cada una implementa uno o más puertos. | `dominio/`, `puertos/` y **su** librería |
| `src/crear.ts` | La raíz de composición: el **único** lugar que crea adaptadores y se los entrega a la aplicación. | Todo |
| `src/validar.ts` | Entrada pública sin navegador (`@pardalis/escenario-engine/validar`): arma lo necesario para validar un nivel del disco. | Todo menos `three/` y `dom/` |
| `src/cli.ts` | La línea de comandos: valida niveles y genera manifiestos sin navegador. | Todo menos `three/` y `dom/` |

### Los adaptadores

| Carpeta | Tecnología | Implementa |
| --- | --- | --- |
| `adaptadores/three/` | Three.js | `Escenario`: piso, telones, personajes de papel, cámara, efectos |
| `adaptadores/dom/` | DOM y CSS | `Interfaz`: globos, opciones, tarjetas, botones, franjas de cine; `Video`; `Controles` del teclado; `Reloj` del navegador |
| `adaptadores/audio/` | Web Audio y voz del navegador | `Audio`: voces, sonidos, música |
| `adaptadores/red/` | `fetch` | `Cargador`: descarga niveles, manifiestos y assets |
| `adaptadores/archivos/` | Archivos del disco (`node:fs`) | `Cargador` y `Carpetas` para la línea de comandos |
| `adaptadores/json/` | Zod | `LectorDeNiveles`: convierte el JSON de `nivel.json`, del contenido y de `assets.json` en tipos del dominio. `EscritorDeManifiestos`: escribe `assets.json` |
| `adaptadores/tiled/` | Formato `.tmj` | `LectorDeMapas`: convierte el mapa de Tiled en el `Mundo` del dominio (sin Zod: revisa el JSON a mano) |
| `adaptadores/memoria/` | Ninguna | Versiones falsas de cada puerto, para las pruebas |

### Reglas de dependencia

1. **Las flechas apuntan hacia adentro.** `dominio/` no importa de nadie. `aplicacion/` nunca importa de `adaptadores/`.
2. **Cada librería externa vive en una sola carpeta.** `three` solo en `adaptadores/three/`; `zod` solo en
   `adaptadores/json/`; `document` y `window` solo en `adaptadores/dom/`, `adaptadores/audio/` y `adaptadores/red/`.
3. **Un adaptador no importa de otro adaptador.** Si dos necesitan hablarse, lo coordina `aplicacion/` con un puerto.
4. **Solo las entradas (`crear.ts`, `validar.ts` y `cli.ts`) escriben `new` de un adaptador.**
5. **Importar el paquete no ejecuta nada del navegador.** Ningún archivo toca `window` o `document` al cargarse;
   solo dentro de funciones.

Estas reglas las comprueba una prueba automática (`src/arquitectura.test.ts`) que lee los `import` de cada archivo.
Si la rompes, `bun test` falla y te dice qué archivo importó qué.

### Cómo decidir dónde va algo

| Si el código… | Va en |
| --- | --- |
| decide algo del juego y se puede probar sin pantalla ni red | `dominio/` |
| dice «primero esto, luego aquello» usando varias piezas | `aplicacion/` |
| describe algo que la aplicación necesita pedir afuera | `puertos/` |
| nombra una librería, el DOM, un formato de archivo o la red | `adaptadores/` |

### Por qué hexagonal aquí

- Los niveles se validan en CI **sin navegador**.
- Toda la lógica (diálogos, cinemáticas, guardado) se prueba con adaptadores falsos, en milisegundos.
- Si mañana se cambia Three.js por otra cosa, se reescribe **una carpeta**.
- Quien llega nuevo puede entender una carpeta sin leer las demás.

## 4. Reglas de código para que se entienda

### 4.1 Legibilidad antes que todo

- **No optimices sin medir.** Si un cambio hace el código más difícil de leer para ganar velocidad, solo se acepta
  con una medición que muestre el problema, y con un comentario que explique por qué quedó así.
- **Nada ingenioso.** Si una línea te hace sentir listo, reescríbela en tres líneas simples.
- **Lo explícito gana.** Un `for` con una variable bien nombrada gana a una cadena de `map().filter().reduce()`.
- **Menos piezas.** No agregues una abstracción (clase base, genérico, fábrica) hasta que haya **dos** usos reales.
- **Sin magia.** Prohibido `Proxy`, decoradores, modificar prototipos, `eval`, y propiedades armadas con texto
  para llamar funciones (`objeto['hacer' + nombre]()`).
- **Composición, no herencia.** `extends` solo cuando una librería lo exige (por ejemplo, una clase de Three.js).

### 4.2 Idioma y nombres

- **Todo en español:** identificadores, comentarios, mensajes de error, nombres de pruebas y la API pública.
  En inglés solo queda lo que viene de afuera (APIs de Three.js y del navegador, campos del formato de Tiled).
- **Solo ASCII en identificadores:** `tamanoDeLetra`, no `tamañoDeLetra`. Los acentos sí van en comentarios y textos.
- **Nombres completos que digan qué guardan.** Nada de una o dos letras, salvo `i` en un `for` corto y `x`, `y`, `z`
  de coordenadas. Sin abreviaturas: `personaje`, no `pers`; `cinematica`, no `cine`.

| Qué | Cómo | Ejemplos |
| --- | --- | --- |
| Booleanos | Pregunta o afirmación | `esCaminable`, `yaSeVio`, `hayVozGrabada` |
| Funciones | Verbo + objeto | `cargarNivel`, `ajustarAlPiso`, `leerPartida` |
| Funciones que avisan (callbacks) | `al` + evento | `alTerminar`, `alCargar`, `alElegir` |
| Constantes | `MAYUSCULAS_CON_GUION_BAJO` | `FPS_POR_DEFECTO`, `TOLERANCIA_DE_LLEGADA` |
| Unidades | En el nombre | `esperaEnSegundos`, `distanciaEnMetros`, `anchoEnPixeles` |
| Tipos e interfaces | `PascalCase`, sustantivo | `Nivel`, `PasoDeCamara`, `Partida` |
| Puertos | El papel que cumplen, sin prefijos | `Escenario`, `Audio` (no `IEscenario`) |
| Adaptadores | Puerto + tecnología | `EscenarioDeThree`, `AudioDelNavegador`, `EscenarioDeMemoria` |
| Archivos | `minusculas-con-guiones.ts` | `cargar-nivel.ts`, `paso-de-camara.ts` |

```ts
// ✗
const c = this.d.nivel.cont;
const it = this.items.find((i) => dentro(p, i.e.h));

// ✓
const contenido = this.datos.nivel.contenido;
const tocado = this.interactuables.find((interactuable) => puntoDentroDeForma(punto, interactuable.zonaDeToque));
```

### 4.3 Archivos

- **Una responsabilidad por archivo.** Si para describirlo necesitas un «y además», son dos archivos.
- **Cada archivo empieza con un comentario** que dice qué hace y, si no es obvio, cómo se usa.
  Es lo primero que lee quien llega.
- **Archivos de hasta ~250 líneas.** Uno más largo casi siempre esconde dos ideas.
- **Sin archivos «cajón»:** nada de `utils.ts`, `helpers.ts` ni `comun.ts`. Cada función vive en un archivo
  con el nombre de lo que hace (`geometria.ts`, `texto-con-variables.ts`).
- **Sin archivos `index.ts` que solo reexportan** dentro de `src/`. Se importa del archivo real, para que
  «ir a la definición» lleve al código. La única excepción es la entrada pública del paquete.

### 4.4 Funciones y control de flujo

- **Funciones cortas con nombre** (hasta ~40 líneas) antes que una función larga con comentarios de sección.
- **Hasta 3 parámetros.** Si hacen falta más, recibe un objeto con campos con nombre.
- **Sin parámetros booleanos sueltos:** `mostrar(globo, true)` no dice nada; usa `mostrar(globo, { conAnimacion: true })`.
- **Retornos tempranos** para descartar casos, en vez de `if` anidados. Máximo 3 niveles de sangría.
- **Un `if` claro antes que un ternario anidado.** Un ternario simple está bien; dos anidados, no.
- **`switch (paso.tipo)`** sobre uniones con campo `tipo`, con un caso por variante.
- **Una función hace una cosa o la coordina, no las dos.**
- **Pasos con nombre en los cálculos:**

```ts
// ✗
if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;

// ✓
const elBordeCruzaLaAlturaDelPunto = a.y > punto.y !== b.y > punto.y;
if (!elBordeCruzaLaAlturaDelPunto) continue;
const xDelCruce = a.x + ((punto.y - a.y) * (b.x - a.x)) / (b.y - a.y);
if (punto.x < xDelCruce) dentro = !dentro;
```

#### Trucos prohibidos

| No | Sí |
| --- | --- |
| `[a, b] = [x, y]` para asignar varias cosas | Una asignación por línea |
| `+(valor)`, `!!valor`, `~~numero` | `Number(valor)`, `Boolean(valor)`, `Math.trunc(numero)` |
| `reduce` para armar un texto o un objeto | Un `for` con una variable acumuladora |
| `condicion && hacerAlgo()` como si fuera un `if` | Un `if` |
| `a ??= b`, `a ||= b` encadenados | Un `if` |
| Encadenar más de 3 llamadas en una línea | Variables intermedias con nombre |
| Números mágicos (`0.92`, `140`, `9e5`) | Constantes con nombre y unidad |
| Operaciones de bits sin explicar | Una constante con nombre y un comentario |
| Expresiones regulares sin explicar | Una constante con nombre y un comentario con un ejemplo de lo que acepta |

Si un algoritmo es inevitablemente difícil (por ejemplo, un generador de números al azar), aíslalo en **una**
función con nombre claro y di en un comentario qué es y que no hace falta entenderlo para usarlo.

### 4.5 TypeScript: siempre tipado

El proyecto usa TypeScript en modo estricto. Los tipos son documentación que la computadora revisa.

- **Prohibido `any`**, `as any`, `as unknown as`, `@ts-ignore` y `@ts-expect-error` en el código del motor.
- **Lo que viene de afuera es `unknown`** (JSON, respuestas de red, datos del host) hasta que un adaptador lo revise
  y lo convierta en un tipo del dominio.
- **Tipo de retorno escrito en toda función exportada** y en todo método de un puerto. Dentro de un archivo,
  TypeScript puede deducir los tipos de las variables locales.
- **Uniones con campo `tipo`** en vez de adivinar la forma de un objeto por sus campos:

```ts
type Paso =
  | { tipo: 'linea'; hablante: string; texto: string }
  | { tipo: 'espera'; esperaEnSegundos: number }
  | { tipo: 'camara'; plano: string; duracionEnSegundos: number };
```

- **Texto literal en vez de `enum`:** `type Idioma = 'es' | 'en'`.
- **`interface` para objetos y puertos; `type` para uniones.**
- **`readonly`** en los datos que no deben cambiar después de crearse (un nivel ya validado, una partida leída).
- **`as` solo después de comprobar**, y con un comentario que diga qué lo garantiza.
  **`!` (no nulo) igual:** `puntos[destino]! // la validación garantiza que existe`.
- **Tipos fáciles de leer.** Evita tipos condicionales, tipos calculados y genéricos anidados. Si un tipo necesita
  más de un momento para entenderse, escribe los casos a mano aunque quede más largo. Un genérico (`<T>`) solo
  cuando de verdad hay varios tipos que lo usan.
- **`import type`** cuando algo solo se usa como tipo.
- **JSDoc en todo lo exportado** y en los campos no evidentes: unidades, valor por defecto, qué significa `undefined`.

```ts
/** Un plano de cámara para cinemáticas. Las distancias están en metros del escenario. */
export interface Plano {
  /** Id de un personaje, objeto o punto del mapa al que apunta la cámara. */
  readonly mira: string;
  readonly distanciaEnMetros: number;
  readonly alturaEnMetros: number;
  /** Giro alrededor de lo que mira, en grados. 0 = de frente. */
  readonly giroEnGrados: number;
}
```

### 4.6 Datos externos

Todo lo que viene de archivos (mapa, contenido, manifiesto, partida) es **no confiable**:

- **Diccionarios con `Object.hasOwn`**, nunca `dic[clave]` ni `clave in dic` para saber si algo existe.
  Un id como `"constructor"` existe en todo objeto de JavaScript.
- Ignora la clave `__proto__` al copiar datos externos.
- Una partida corrupta se ignora con una advertencia; **nunca impide jugar**.

### 4.7 Errores y mensajes

- **En español, con ubicación y con qué hacer.** Usa la ruta del JSON o el objeto del mapa:

```
✗ error en el diálogo
✓ secuencia "aun_no_item" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"
```

- **Error** = el nivel no puede arrancar. **Advertencia** = funciona, pero hay algo que revisar.
- **No tragues errores.** Un `catch` vacío está prohibido: o se maneja, o se convierte en un aviso con contexto.
- Los avisos a consola llevan el prefijo `[escenario-engine]`.
- Lo que la validación ya garantiza no se revisa otra vez al jugar; lo que no garantiza, no se asume.

### 4.8 Asincronía y limpieza

- Cada acción larga (una línea, una caminata, un video) es una **promesa que termina cuando la acción terminó**
  y recibe una **`AbortSignal`** para cancelarse.
- **`async`/`await`**, no cadenas de `.then()`.
- **Ninguna promesa queda colgada:** si la acción se cancela, la promesa termina.
- **Todo se limpia:** cada oyente se quita, cada temporizador se cancela, cada textura y sonido se libera.
  Usa `try`/`finally` cuando haya varios caminos de salida.
- **El tiempo pasa por el puerto `Reloj`**, no por `setTimeout` directo. Así las pruebas no esperan de verdad
  y las cinemáticas se pueden saltar.

### 4.9 Comentarios

- Explican **por qué**, no **qué**. El qué lo dicen los nombres.

```ts
// ✗ suma 1 al contador
cuadroActual++;

// ✓ El navegador no deja sonar nada antes del primer toque,
//   por eso la música empieza aquí y no al cargar el nivel.
```

- **Limitaciones conocidas en prosa, con su salida:**
  `Limitación conocida: no rodea obstáculos grandes. Si hace falta, usar búsqueda de caminos sobre el piso.`
- No dejes código comentado ni `TODO` sin explicación.

### 4.10 Formato

- 2 espacios, comillas simples, punto y coma, coma final en listas de varias líneas.
- Líneas de hasta ~120 columnas.
- Números grandes con separador: `10_000`.

### 4.11 Dependencias

- **No agregues una dependencia sin acordarlo antes.** Cada una es código que alguien tendrá que entender y actualizar.
- Si hace falta algo pequeño, se escribe en el proyecto, con su prueba.

## 5. Pruebas

- **`bun test`.** Cada archivo de prueba vive junto a lo que prueba: `condiciones.ts` → `condiciones.test.ts`.
- **El nombre de cada prueba es una frase en español que describe el comportamiento:**
  `'al saltar una cinemática, cada personaje queda en su posición final'`.
- **`dominio/` y `aplicacion/` se prueban siempre**, con los adaptadores de `adaptadores/memoria/`.
- **Los mensajes de validación se comprueban con su texto exacto:** son parte del contrato con quien escribe niveles.
- **Lo que se ve y se oye** (`three/`, `dom/`, `audio/`) se verifica a mano en la demo; dilo en la descripción del cambio.
- Una prueba debe poder leerse sola: prepara, actúa, comprueba. Sin ayudantes escondidos en otros archivos.

## 6. Comandos y verificación

```bash
bun install
bun check        # tipos: debe decir "No type errors"
bun test         # pruebas, incluida la de arquitectura
bun run construir   # genera dist/: JavaScript (ESM) y tipos .d.ts
```

`bun run construir` y no `bun build`: ese último es el empaquetador de Bun y aquí no se usa.
`dist/` lleva un archivo por cada archivo de `src/`, sin empaquetar, para que se pueda leer.

Para validar un nivel y regenerar un manifiesto de assets (el formato está en [`docs/NIVELES.md`](docs/NIVELES.md)):

```bash
bun src/cli.ts validar ejemplo/niveles/barrio/nivel.json --minijuegos Tortilleria
bun src/cli.ts assets ejemplo/niveles/barrio
```

Si agregas, quitas o renombras un archivo de `ejemplo/niveles/`, regenera su `assets.json` en el mismo cambio.

Para ver el motor funcionando en el navegador:

```bash
bun ejemplo/servidor.ts     # la demo, en http://localhost:3000
```

Los comandos de demo se documentan aquí conforme se agreguen.
Usa Bun para todo; no Node, npm ni vitest. Ver `CLAUDE.md`.

**Antes de dar un cambio por terminado:**

1. `bun check` y `bun test` en verde.
2. Si tocaste un adaptador visual, recorriste la demo.
3. Si cambiaste el formato de un nivel o la API pública, actualizaste `docs/` en el mismo cambio.
4. Releíste tu cambio preguntándote: **¿alguien que llega hoy lo entiende sin preguntarle a nadie?**

## 7. Recetas

### Agregar un tipo de paso (por ejemplo, para cinemáticas)
1. `dominio/`: agrega la variante a la unión `Paso` con su campo `tipo`.
2. `adaptadores/json/`: acepta su forma en el JSON y conviértela al tipo del dominio.
3. `dominio/` (validación): revisa todo lo que el paso nombra (personajes, puntos, planos, assets).
4. `puertos/`: si el paso necesita algo nuevo del exterior, agrega un método al puerto que corresponda.
5. `aplicacion/`: agrega el caso al ejecutor de pasos. Define también qué hace **al saltar** (su resultado final).
6. `adaptadores/`: implementa el método nuevo, también en `adaptadores/memoria/`.
7. Pruebas del paso y documentación en `docs/`.

### Agregar un adaptador
Crea su carpeta en `adaptadores/`, implementa el puerto completo y conéctalo en `crear.ts`.
Si la aplicación necesita cambiar para usarlo, el puerto está mal diseñado: revisa el puerto primero.

### Agregar una regla de validación
Va en `dominio/`. El mensaje incluye la ubicación y qué hacer. Agrega una prueba con el texto exacto.

### Agregar un evento u opción pública
Tipos en la entrada pública, documentación en `docs/DISENO-3.0.md` y `README.md`, todo en español.

## 8. Para agentes de IA

- **Escribe para quien no tiene IA.** No generes código que solo otro modelo pueda mantener.
- **Cambios pequeños.** Un cambio hace una cosa; no mezcles un arreglo con una reorganización.
- **No inventes.** Si el diseño no dice cómo hacer algo, pregunta en vez de suponer. No cambies una decisión de
  `docs/DISENO-3.0.md` sin que alguien del equipo lo apruebe.
- **Respeta las capas.** Si te resulta cómodo importar un adaptador desde `aplicacion/`, detente: falta un puerto.
- **No agregues dependencias, configuración ni herramientas** que nadie pidió.
- **No borres ni debilites pruebas** para que pasen.
- **Di lo que no verificaste.** Si no pudiste abrir la demo, dilo.
- **Commits en español** con prefijo: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`. Un commit = un cambio con sentido propio.

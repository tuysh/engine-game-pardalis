# Cómo se escribe un nivel

Referencia para quien dibuja mapas y escribe diálogos. El ejemplo completo está en
[`ejemplo/niveles/barrio/`](../ejemplo/niveles/barrio).

> **Estado:** este documento describe lo que el motor **ya lee y valida**: `nivel.json`, el contenido y los assets.
> El mapa de Tiled y las cinemáticas se documentan aquí cuando se construya su fase
> ([`DISENO-3.0.md` §13](DISENO-3.0.md)). Mientras tanto, su diseño está en `DISENO-3.0.md` §7 y §9.

Un nivel es **una carpeta** con estos archivos, que se unen por `id` y por clave:

| Archivo | Responde | Lo edita |
| --- | --- | --- |
| `nivel.json` | **De qué archivos** se compone el nivel | quien arma el nivel |
| Mapa de Tiled (`mapa.tmj`) | **DÓNDE**: piso, decorado, personajes, puntos, salida, zonas | quien dibuja, en [Tiled](https://www.mapeditor.org) |
| Contenido (`contenido.json`) | **QUÉ PASA**: personajes, diálogos, estado, minijuegos, salida | quien escribe la historia |
| Assets (`img/`, `voz/`, `video/`) y su `assets.json` | **CON QUÉ**: imágenes, voces, sonidos y videos | quien dibuja y graba; `assets.json` lo genera un comando |

Mover algo en Tiled nunca rompe un diálogo, y cambiar un diálogo nunca rompe una posición.

> **Principios de Pardalis que todo nivel respeta:** nada requiere leer (todo texto lleva `audio` o se dice con voz
> sintetizada, y las opciones llevan `imagen`); nunca castigar (un minijuego sin éxito lleva a un diálogo amable, `siNo`);
> en pantalla solo aparecen palabras que la niña o el niño ya vio.

---

## 1. `nivel.json`

```json
{ "mapa": "mapa.tmj", "contenido": "contenido.json", "assets": [".", "../comun"] }
```

Todas las rutas son relativas al propio `nivel.json`. `assets` es la lista de carpetas donde están las imágenes
y sonidos del nivel; si se omite, es la carpeta del nivel (`["."]`).

## 2. El contenido

### Estructura

```jsonc
{
  "meta": { "id": "barrio", "titulo": "El barrio", "personajes": { ... } },
  "jugador": { "personaje": "tommy" },    // opcional: un nivel sin jugador no tiene control libre
  "estado": { "objetivos": [...], "variables": [...], "lista": { ... }, "dinero": 100 },
  "secuencias": { "nombre": [ ...pasos ] },
  "npcs": { "tortu": { "dialogo": [...], "alVolver": { ... } } },
  "interactivos": { "comal": { "dialogo": [...] } },
  "comentarios": { "general": [ ...líneas ] },
  "salida": { ... }
}
```

Solo `meta` es obligatoria. **Una clave que el motor no conoce es un error**: así un error de dedo
(`"audioo"`, `"salidas"`) se detecta al validar y no pasa inadvertido.

### `meta.personajes`

```json
"personajes": {
  "tommy": { "idioma": "en", "sprite": "spr_tommy" },
  "tortu": { "idioma": "es", "sprite": "spr_tortu" }
}
```

- `idioma`: `es` o `en`. Si es distinto del idioma base del sitio, sus líneas pueden traer `trad`.
- `sprite`: clave de su imagen.
- Un NPC del mapa con `id: "tortu"` se dibuja con el personaje `tortu`.

### `estado`

```json
"estado": {
  "objetivos": ["tortillas", "aguacates"],
  "variables": ["globo"],
  "lista": { "tortillas": "las tortillas", "aguacates": "los aguacates" },
  "dinero": 100
}
```

- **Toda condición y todo `pon` debe usar un nombre declarado**; si no, es error. Están declarados:
  - los `objetivos` y las `variables`;
  - `dinero`, si el nivel lo trae;
  - `charlas.<id>` por cada NPC e interactivo: el motor la marca sola al hablar con él. No hace falta escribirla.
- `lista` da el nombre con artículo para `{faltan}` → «Te faltan las tortillas y los aguacates».

### Diálogo de un NPC o interactivo: ramas

```json
"dialogo": [
  { "cuando": "tengo tortillas", "dice": [ ...pasos de revisita... ] },
  { "dice": [ ...pasos de primera visita... ] }
]
```

Gana **la primera rama cuya condición se cumple**. Una rama sin `cuando` siempre se cumple: debe ir al final
(si no, las siguientes son inalcanzables y hay advertencia).

### Pasos

| Paso | Ejemplo | Qué hace |
| --- | --- | --- |
| Línea | `{ "dice": "tortu", "texto": "¡Hola!", "audio": "vo_hola" }` | Globo sobre quien habla. Termina con un toque o al acabar el audio. Opcional: `trad`, y `en` + `es` (siempre juntos) para una **tarjeta de vocabulario**. |
| Opción | `{ "elige": "¿Cuál quieres?", "opciones": [ { "imagen": "img_rosa", "audio": "vo_rosa", "secuencia": [...] } ] }` | Espera la elección. Cada opción: `texto`, `trad`, `imagen`, `audio`, `cuando`, y `secuencia` (pasos o nombre de secuencia). Una opción sin `imagen` da advertencia. |
| Efecto | `{ "efecto": "magia" }` | Partículas y sonido. Disponibles: `magia`, `confeti`. |
| Estado | `{ "pon": { "globo": "rosa" } }` | Asigna objetivos o variables. |
| Minijuego | `{ "juego": "Tortilleria", "config": { "palabras": ["hot"] } }` | Abre el minijuego que registró el host y, al volver, ejecuta `alVolver`. |
| Caminar | `{ "camina": "frente_tortilleria", "quien": "tortu" }` | Camina hasta un `punto` del mapa. Sin `quien`, camina el jugador. |
| Secuencia | `{ "secuencia": "aun_no_item" }` | Ejecuta una secuencia de `secuencias`. Los ciclos entre secuencias son error. |
| Condicional | `{ "cuando": "globo", "dice": [ ...pasos ] }` | Ejecuta sus pasos solo si se cumple la condición. |

Los textos admiten `{faltan}` (objetivos pendientes, en español) y `{dinero}`. Otro nombre entre llaves es error.

### Condiciones

| Expresión | Se cumple cuando |
| --- | --- |
| `"tengo tortillas"` | `tortillas` tiene un valor verdadero |
| `"globo"` | lo mismo: `tengo` es opcional y solo ayuda a leer |
| `"no tengo limones"` | negación; `no` va delante de cualquier condición |
| `"objetivosCompletos"` | todos los objetivos están cumplidos |
| `"charlas.tortu"` | ya se habló con `tortu` |
| `["a", "b"]` | se cumplen `a` **y** `b` |
| `{ "alguno": ["a", "b"] }` | se cumple `a` **o** `b` |

### `alVolver` (después de un minijuego)

```json
"alVolver": { "siLogrado": [ ...pasos ], "siNo": "aun_no_item" }
```

Si el minijuego terminó con éxito → `siLogrado`; si no (o si falló con un error) → `siNo`.
`siNo` debe ser amable («¡Otro día lo intentamos!»), nunca un «perdiste».
Lo que el minijuego concede (`otorgar`) se aplica al estado antes de ejecutar cualquiera de los dos.

### `comentarios`

Frases que el jugador dice al entrar a una zona del mapa; se elige una al azar del grupo de la zona.

```json
"comentarios": { "general": [ { "dice": "tommy", "texto": "Wow!", "trad": "¡Qué colorido!", "audio": "vo_wow" } ] }
```

### `salida`

```json
"salida": {
  "destino": "Selector",
  "requiere": "objetivosCompletos",
  "siBloqueada": "bloquea_salida",
  "flecha": { "visibleCuando": "objetivosCompletos", "texto": "¡A casa!" }
}
```

Si `requiere` no se cumple, se ejecuta `siBloqueada`. Si se cumple y `destino` es otro nivel registrado, el motor
lo carga; cualquier otro destino llega al host con el evento `salida`.
`flecha.texto` es opcional y solo debe usar palabras que la niña o el niño ya vio.

## 3. Assets (imágenes, voces y videos)

Todo se nombra por **clave**: el nombre del archivo sin carpeta ni extensión. `img/spr_tortu.svg` es `spr_tortu`.

```
niveles/
  comun/                 lo que comparten varios niveles
    assets.json          (generado)
    img/spr_tommy.svg
  barrio/
    nivel.json           "assets": [".", "../comun"]
    assets.json          (generado)
    img/spr_tortu.svg
    voz/vo_tortu_provecho.mp3
```

| Tipo | Archivos | Notas |
| --- | --- | --- |
| Imagen | `.svg` (preferido), `.png`, `.webp` | Un SVG debe traer `viewBox` (o `width` y `height`): de ahí sale su tamaño. |
| Animación | `clave_1.svg`, `clave_2.svg`… | Dos o más imágenes numeradas se agrupan solas en la animación `clave`, en orden numérico. Todos los cuadros deben medir lo mismo. |
| Audio | `.mp3`, `.ogg`, `.wav`, `.m4a` | Voces, sonidos y música. |
| Video | `.mp4` | H.264 + AAC, que funciona en iPad y en Chrome. |

Las subcarpetas (`img/`, `voz/`…) son para ordenar: no cambian la clave. Por eso **dos archivos de una carpeta
de assets no pueden llamarse igual**, aunque estén en subcarpetas distintas o tengan otra extensión.

### Generar el manifiesto

Cada carpeta de assets lleva un `assets.json` que **nadie escribe a mano**. Se genera, y se vuelve a generar
cada vez que se agrega, quita o renombra un archivo:

```bash
bunx escenario-engine assets niveles/barrio
bunx escenario-engine assets niveles/comun
```

Por defecto una animación va a 8 cuadros por segundo. Para cambiarlo, crea junto a los assets un archivo
`assets.config.json`:

```json
{ "fps": { "tommy_viendo_tele": 4 } }
```

El generador avisa si un SVG enlaza archivos externos (una foto, una fuente): al usarse en el juego no se cargan.

### Qué revisa el validador

- Una **imagen** que el contenido nombra y no existe es **error**: el nivel no puede dibujarse.
- Una **voz** que no existe es **advertencia**: se usa voz sintetizada, así que se puede escribir el nivel antes de grabar.
- Usar una clave del tipo equivocado (una imagen donde va un audio) es error.
- Si la misma clave está en dos carpetas de `assets`, **gana la primera de la lista** y hay advertencia.
  Así un nivel puede reemplazar a propósito un asset común.

## 4. Validar

```bash
bunx escenario-engine validar ruta/al/nivel.json --minijuegos Tortilleria,Fruteria
```

Corrige hasta tener **cero errores**; el comando termina con código 1 si queda alguno. Las advertencias se revisan,
pero no bloquean. Cada mensaje dice dónde está el problema, con la ruta dentro del contenido:

```
✗ secuencia "aun_no_item" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"
✗ npcs.tortu.dialogo[1].dice[0]: el hablante "tortuga" no existe en meta.personajes
✗ meta.personajes.tortu.sprite: no existe la imagen "spr_tortu" en los assets del nivel
⚠ npcs.tortu.dialogo[0].dice[0].audio: no existe la voz "vo_tortu_provecho"; se usará voz sintetizada
```

Todavía **no revisa el mapa** de Tiled; el comando lo recuerda al terminar.

`--minijuegos` es opcional: sin él, los pasos `juego` no se revisan.

Desde código (por ejemplo, en una prueba del host):

```js
import { validarNivel } from '@pardalis/escenario-engine/validar';

const resultado = await validarNivel('niveles/barrio/nivel.json', { minijuegos: ['Tortilleria'] });
// resultado.errores, resultado.advertencias
```

Después, pruébalo como lo usarán: en una tablet con el dedo, con teclado y en modo proyección.
Revisa que nada requiera leer.

## 5. Qué cambió respecto a la versión 2.0

Para quien trae niveles de la versión anterior (no hay conversión automática):

| En la 2.0 | En la 3.0 |
| --- | --- |
| Formato v1 sin mapa (`layout`, coordenadas en el JSON) | Se quitó: todo nivel lleva mapa de Tiled. |
| `{ "camina": { "x": 900, "y": 470 } }` y `{ "camina": 300 }` | Solo `{ "camina": "nombre_de_un_punto" }`. |
| `"variables": ["charlas.*"]` | No hace falta: `charlas.<id>` ya está declarada. Los comodines `.*` se quitaron. |
| `alVolver.conItem` | Se quitó: `siLogrado` o `siNo` se elige por el `exito` del minijuego. |
| Claves desconocidas se ignoraban | Son error. |
| La clave llevaba subcarpeta y se le agregaba `.webp` o `.mp3` | La clave es solo el nombre; el archivo real lo dice `assets.json`. |
| Animaciones como atlas (`.webp` + `.json`) | Imágenes numeradas `clave_1.svg`, `clave_2.svg`… |
| `jugador.animaciones`, `velocidadX`, `mundo.logico`, `mundo.camara`… | Todavía no existen en la 3.0; se definen con el escenario 3D. |

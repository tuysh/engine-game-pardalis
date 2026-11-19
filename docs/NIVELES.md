# Cómo se escribe un nivel

Referencia para quien dibuja mapas y escribe diálogos. El ejemplo completo está en
[`ejemplo/niveles/barrio/`](../ejemplo/niveles/barrio).

> **Estado:** todo lo que este documento describe ya se lee, se valida y se puede jugar: caminar, hablar con
> personajes y objetos, elegir opciones, minijuegos, efectos, comentarios de las zonas, música, cinemáticas,
> y pasar de un nivel a otro.

Un nivel es **una carpeta** con estos archivos, que se unen por `id` y por clave:

| Archivo | Responde | Lo edita |
| --- | --- | --- |
| `nivel.json` | **De qué archivos** se compone el nivel | quien arma el nivel |
| Mapa de Tiled (`mapa.tmj`) | **DÓNDE**: piso, decorado, personajes, puntos, salida, zonas | quien dibuja, en [Tiled](https://www.mapeditor.org) |
| Contenido (`contenido.json`) | **QUÉ PASA**: personajes, diálogos, estado, minijuegos, salida | quien escribe la historia |
| Assets (`img/`, `voz/`, `video/`) y su `assets.json` | **CON QUÉ**: imágenes, voces, sonidos y videos | quien dibuja y graba; `assets.json` lo genera un comando |

Mover algo en Tiled nunca rompe un diálogo, y cambiar un diálogo nunca rompe una posición.

Los dos ejemplos del repositorio se juegan uno tras otro: [`casa`](../ejemplo/niveles/casa) (un nivel sin jugador:
solo una cinemática de entrada que termina saliendo al barrio) y [`barrio`](../ejemplo/niveles/barrio).

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

## 2. El mapa de Tiled

El mapa es el **plano del lugar visto desde arriba**, hecho en [Tiled](https://www.mapeditor.org) y guardado como
JSON (`.tmj`). `x` es izquierda–derecha; `y` es profundidad: más abajo en Tiled = más cerca de la cámara.
La altura no se dibuja en el mapa: sale del tamaño de cada imagen.

**Medidas:** todo en el mapa está en píxeles, y `mundo.pixelesPorMetro` del contenido (por defecto 100) los convierte
a metros del escenario, igual que a las imágenes. Un personaje dibujado de 160 px de alto mide 1.6 m.

### Capas (nombres exactos, en minúsculas)

| Capa | Tipo en Tiled | Contenido |
| --- | --- | --- |
| `suelo` | Capa de imagen | La imagen del piso, tal como se ve desde arriba. Propiedad `asset` (clave). Se coloca según el desplazamiento de la capa y mide lo que mide la imagen. |
| `telones` | Capa de objetos | Una **línea de dos puntos** por cada fondo vertical (fachadas, cielo). Propiedades `asset` y `alto` (en píxeles). |
| `decorado` | Capa de objetos | Un **rectángulo** por objeto: su forma es **la huella real** del objeto en el piso. Clase del catálogo y propiedad `asset`. |
| `npcs` | Capa de objetos | Un objeto por personaje (un punto es lo más cómodo). Propiedades `id` y, opcional, `mira`. |
| `interaccion` | Capa de objetos | Objetos de clase `inicioJugador`, `punto`, `salida` o `zona`. |
| `piso` | Capa de objetos | Polígonos (o rectángulos) por donde se puede caminar. |

Solo `piso` es obligatoria. Otra capa da advertencia, salvo que lleve la propiedad booleana `ignorar` marcada
(por ejemplo, notas del equipo).

### Catálogo de decorado

La clase de un objeto de `decorado` dice cómo se dibuja:

| Clase | Cómo se dibuja | ¿Bloquea el paso? |
| --- | --- | --- |
| `parado` | Papel vertical, parado en el centro de su huella. | Sí: exactamente su huella. |
| `plano` | Pintado sobre el piso, estirado a su huella (un tapete, una flecha). | No. |
| `colgado` | Papel vertical en lo alto. Propiedad `altura` (píxeles del piso a su borde inferior; por defecto 2.2 m). | No. |

Con la propiedad `id`, el objeto se puede tocar: su diálogo está en `interactivos` del contenido.
Lo que se dibuja en el plano es exactamente lo que bloquea: no hay ajustes de «huella» a mano.

Si el `asset` de un objeto es una **animación** (archivos numerados, ver §4), se repite sola todo el tiempo:
sirve para una tele encendida, una bandera o un foco que parpadea.

> **Para que el lugar se vea completo:** la cámara de una cinemática puede girar y acercarse, y entonces deja ver
> lo que hay más allá del fondo. Cierra el lugar con telones también a los lados (como las paredes de la casa
> de ejemplo) y haz el suelo un poco más grande que el piso por donde se camina.

### Clases de la capa `interaccion`

| Clase | Forma | Propiedades |
| --- | --- | --- |
| `inicioJugador` | punto | `mira` (`izquierda`/`derecha`, por defecto `derecha`). Exactamente uno si el nivel tiene jugador, dentro del piso. |
| `punto` | punto | Su **nombre** es su identificador (p. ej. `frente_tortilleria`); lo usan los pasos `camina`. No se repite. |
| `salida` | rectángulo o polígono | Máximo una. |
| `zona` | rectángulo o polígono | Su **nombre** es su identificador. Opcionales: `grupo` (qué lista de `comentarios` usar al entrar) y `espera` (segundos antes de repetir; por defecto 20). |

### Cómo se une el mapa con el contenido

- Un objeto de `npcs` con `id: "tortu"` es el personaje `tortu` de `meta.personajes`: de ahí sale su dibujo.
  **Su diálogo es opcional:** sin entrada en `npcs` del contenido, el personaje está en el escenario pero no se puede tocar.
- Cada entrada de `npcs` del contenido es de alguien que está en el mapa **o que entra después** con un paso
  `aparece`. Cada entrada de `interactivos` necesita su objeto en el mapa.
- Cada `punto` que nombran los pasos `camina`, `aparece` y `mira` debe existir, y a quien se mueve, voltea o anima
  debe estar alguna vez en el escenario (ser el jugador, un NPC del mapa o alguien que entra con `aparece`).
- El `grupo` de una zona debe existir en `comentarios`, y la sección `salida` del contenido necesita un objeto `salida`.
- Un plano de cámara apunta a un personaje, a un `punto` o a un objeto del decorado con `id`; y la zona que hace
  empezar una cinemática debe existir en el mapa.

La clase de un objeto se escribe en el campo **Clase** de Tiled. No se usan tilesets ni objetos de imagen.

## 3. El contenido

### Estructura

```jsonc
{
  "meta": { "id": "barrio", "titulo": "El barrio", "personajes": { ... } },
  "jugador": { "personaje": "tommy" },    // opcional: un nivel sin jugador no tiene control libre
  "mundo": {
    "pixelesPorMetro": 100,
    "camara": { "distancia": 8, "altura": 4, "giro": 0 },
    "sonidos": { "musica": "mus_barrio" },
    "planos": { "plano_puesto": { "mira": "tortu", "distancia": 5, "altura": 2.5, "giro": 20 } }
  },
  "estado": { "objetivos": [...], "variables": [...], "lista": { ... }, "dinero": 100 },
  "secuencias": { "nombre": [ ...pasos ] },
  "npcs": { "tortu": { "dialogo": [...], "alVolver": { ... } } },
  "interactivos": { "comal": { "dialogo": [...] } },
  "comentarios": { "general": [ ...líneas ] },
  "cinematicas": { "intro": { "inicia": "alEntrar", "pasos": [...] } },
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
- `sprite`: clave de su imagen. Si la clave es una **animación**, el personaje la repite todo el tiempo
  (así respira o parpadea mientras está quieto).
- Un NPC del mapa con `id: "tortu"` se dibuja con el personaje `tortu`.
- Los dibujos miran **a la derecha**: para mirar a la izquierda, el motor voltea la figura como un papel.

### `jugador` y `mundo`

| Campo | Por defecto | Qué es |
| --- | --- | --- |
| `jugador.personaje` | — | Id en `meta.personajes` (obligatorio si hay `jugador`). |
| `jugador.velocidad` | 2.4 | Metros por segundo al caminar. |
| `mundo.pixelesPorMetro` | 100 | Cuántos píxeles del mapa y de las imágenes son un metro del escenario. |
| `mundo.camara.distancia` | 8 | Metros entre la cámara y lo que sigue. |
| `mundo.camara.altura` | 4 | Metros de la cámara sobre el piso. |
| `mundo.camara.giro` | 0 | Grados que la cámara gira alrededor de lo que sigue. 0 = de frente. |
| `mundo.sonidos.musica` | — | Clave de la música de fondo, que se repite mientras se juega. Si falta el archivo, hay advertencia y el nivel se juega sin música. |

| `mundo.planos` | — | Planos de cámara con nombre, para los pasos `camara`. Ver abajo. |

La cámara sigue al jugador; en un nivel sin jugador mira al centro del lugar.

#### Planos de cámara

Un plano dice **a qué** mira la cámara y **desde dónde**:

```json
"planos": {
  "plano_puesto": { "mira": "tortu", "distancia": 5, "altura": 2.5, "giro": 20 },
  "plano_sala":   { "mira": "centro_sala", "distancia": 8, "altura": 3.2 }
}
```

- `mira` (obligatorio): el id de un personaje (y entonces la cámara lo sigue si camina), el nombre de un `punto`
  del mapa, o el `id` de un objeto del decorado.
- `distancia`, `altura` y `giro` son los mismos de `mundo.camara`, con sus mismos valores por defecto.
  Un `giro` positivo lleva la cámara hacia la derecha de lo que mira.
- Para ir de un giro a otro la cámara toma el camino recto entre los dos números: de `350` a `10` daría la vuelta
  larga. Escribe giros cercanos (por ejemplo `-10` y `10`).

Los números de un plano no se adivinan: se encuadra a mano con la **cámara libre** y se copia el resultado
(ver [«Crear planos con la cámara libre»](#crear-planos-con-la-cámara-libre)).

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
  - `vista.<id>` por cada cinemática: el motor la marca sola cuando la cinemática termina.
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

### Pasos de escena

Mueven la cámara y a los personajes. Nacieron para las cinemáticas, pero sirven igual dentro de cualquier diálogo.

| Paso | Ejemplo | Qué hace |
| --- | --- | --- |
| A la vez | `{ "juntos": [ ...pasos ] }` | Empieza todos sus pasos al mismo tiempo y sigue cuando el último terminó. |
| Espera | `{ "espera": 2 }` | Una pausa, en segundos. |
| Cámara | `{ "camara": "plano_puesto", "duracion": 2 }` | Lleva la cámara a un plano de `mundo.planos`, a un personaje (por su id) o a `"jugador"`. Con `duracion` viaja con suavidad; sin ella es un corte. |
| Voltear | `{ "mira": "tommy", "hacia": "mama" }` | Voltea a un personaje hacia otro personaje o hacia un `punto` del mapa, con giro de papel. |
| Animar | `{ "anima": "tommy", "con": "tommy_saluda" }` | Cambia el dibujo de un personaje por una animación (o una imagen) de los assets. Ver abajo. |
| Aparecer | `{ "aparece": "mama", "en": "puerta" }` | Mete a un personaje al escenario, parado en un `punto`. Si ya estaba, solo lo cambia de lugar. |
| Desaparecer | `{ "desaparece": "mama" }` | Lo saca del escenario. No se puede sacar al personaje del jugador. |
| Música | `{ "musica": "mus_fiesta" }` | Cambia la música de fondo. |
| Sonido | `{ "sonido": "puerta_abre" }` | Toca un sonido corto, sin esperar a que termine. |
| Fundido | `{ "fundido": "cerrar", "duracion": 1 }` | `cerrar` oscurece la pantalla hasta negro; `abrir` la aclara partiendo de negro. Sin `duracion` es de golpe. |
| Video | `{ "video": "intro_tele" }` | Reproduce un video a pantalla completa. Con voces, uno por idioma: `{ "video": { "es": "intro_es", "en": "intro_en" } }`. |
| Salir | `{ "sale": "barrio" }` | Pide terminar el nivel hacia un destino. Ver abajo. |

**Animar.** Hay dos formas:

- Sin `repite`, la animación pasa **una vez**, el paso espera a que termine y el personaje regresa a su dibujo
  normal (su `sprite`). Sirve para un gesto: saludar, brincar.
- Con `"repite": true`, el personaje **se queda** con el dibujo nuevo y el paso sigue de inmediato. Sirve para
  dejarlo en una pose («sentado viendo la tele»); para volver al dibujo normal se anima con su propio `sprite`:
  `{ "anima": "tommy", "con": "spr_tommy", "repite": true }`. Una imagen fija necesita `repite`
  (sin él no se alcanzaría a ver, y el validador lo advierte).

El dibujo nuevo puede medir distinto que el `sprite`. Como este, debe mirar a la derecha.

**Salir.** `sale` no corta la escena: el nivel termina cuando el diálogo o la cinemática **acaba**, así que lo
normal es escribirlo al final. Si el destino es otro nivel que el sitio registró, el motor lo carga solo;
cualquier otro destino (`"Selector"`, `"Creditos"`) se le avisa al sitio, que decide qué hacer.

**Al terminar una escena** (un diálogo o una cinemática), si la cámara quedó en otro lado regresa sola al jugador
y, si la pantalla quedó oscura, se aclara: el jugador nunca se queda sin ver. La excepción es una escena que
termina con `sale`: ahí la pantalla puede quedarse en negro mientras carga el nivel siguiente.

### Condiciones

| Expresión | Se cumple cuando |
| --- | --- |
| `"tengo tortillas"` | `tortillas` tiene un valor verdadero |
| `"globo"` | lo mismo: `tengo` es opcional y solo ayuda a leer |
| `"no tengo limones"` | negación; `no` va delante de cualquier condición |
| `"objetivosCompletos"` | todos los objetivos están cumplidos |
| `"charlas.tortu"` | ya se habló con `tortu` |
| `"vista.intro"` | ya se vio la cinemática `intro` |
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

Frases que el jugador dice al **entrar** a una zona del mapa que lleva la propiedad `grupo`; se elige una al azar
de ese grupo. Cada zona espera su `espera` (20 segundos por defecto) antes de repetir, un comentario nunca
interrumpe un diálogo, y su globo no detiene al jugador: puede seguir caminando mientras lo oye.

```json
"comentarios": { "general": [ { "dice": "tommy", "texto": "Wow!", "trad": "¡Qué colorido!", "audio": "vo_wow" } ] }
```

### `cinematicas`

Una cinemática es una escena que se reproduce sola: mientras dura, el jugador no controla nada y se ven las
franjas negras de cine. Es una lista de pasos, los mismos de los diálogos.

```jsonc
"cinematicas": {
  "intro": {
    "inicia": "alEntrar",
    "cuando": "no vista.intro",   // opcional
    "saltable": true,             // opcional
    "pasos": [
      { "fundido": "abrir", "duracion": 1 },
      { "juntos": [ { "aparece": "mama", "en": "puerta" }, { "sonido": "puerta_abre" } ] },
      { "camina": "junto_al_sillon", "quien": "mama" },
      { "dice": "mama", "texto": "¿Me traes tortillas, mijo?", "audio": "vo_mama_tortillas" },
      { "sale": "barrio" }
    ]
  }
}
```

| Campo | Por defecto | Qué es |
| --- | --- | --- |
| `inicia` | — (obligatorio) | Qué la hace empezar: `"alEntrar"` (al entrar al nivel), `{ "zona": "nombre" }` (cuando el jugador entra a esa zona del mapa), `{ "objetivo": "nombre" }` (cuando se cumple ese objetivo) o `"manual"` (solo cuando el sitio la pide). |
| `cuando` | `"no vista.<id>"` | Solo empieza si se cumple. Sin `cuando`, **se ve una sola vez**. |
| `saltable` | `true` | Si aparece el botón de saltar. |
| `pasos` | — | Los pasos de la escena. En vez de `pasos` puede llevar `"codigo": "nombre"`: una cinemática que el sitio escribió en código. |

- **No puede llevar** `elige` ni `juego` (ni directo, ni dentro de `juntos` o de una secuencia): necesitan al jugador.
- **Nunca interrumpe un diálogo:** si le toca empezar a media conversación, espera a que acabe. Varias en espera
  se reproducen en orden.
- **Saltar** no la corta: la pasa en modo rápido. Cada paso que falta deja su resultado final al instante
  (los personajes en su destino, lo que hagan `pon`, `aparece`, `musica` y `sale`); las líneas, los sonidos,
  los efectos y los videos se omiten. Así el nivel queda igual que si se hubiera visto completa.
- Al terminar, el motor marca `vista.<id>`. Si la partida se guarda a media cinemática, al volver empieza de nuevo.
- Las líneas (`dice`) se cierran solas al acabar la voz, o con un toque.
- Con «movimiento reducido» activo en el dispositivo, los viajes de cámara se vuelven cortes.

La **casa de ejemplo** es un nivel hecho solo de una cinemática: no tiene `jugador`, su `intro` empieza
`alEntrar` y termina con `{ "sale": "barrio" }`.

### `salida`

```json
"salida": {
  "destino": "Selector",
  "requiere": "objetivosCompletos",
  "siBloqueada": "bloquea_salida",
  "flecha": { "visibleCuando": "objetivosCompletos", "texto": "¡A casa!" }
}
```

El jugador intenta salir al entrar al área de la salida (caminando o tocándola). Si `requiere` no se cumple,
se ejecuta `siBloqueada`. Si se cumple, el nivel termina hacia `destino`: si es otro nivel que el sitio registró,
el motor lo carga solo; si no, el destino le llega al sitio con el evento `salida`.

Cada nivel guarda su propio estado. Al volver a un nivel ya visitado se restauran sus variables
(objetivos cumplidos, charlas, cinemáticas vistas) y el jugador aparece en su inicio.

Una flecha que sube y baja señala la salida. Aparece cuando se cumple `flecha.visibleCuando`, o siempre si la
salida no lo dice. `flecha.texto` es opcional y solo debe usar palabras que la niña o el niño ya vio.

## 4. Assets (imágenes, voces y videos)

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
| Video | `.mp4` | H.264 + AAC, que funciona en iPad y en Chrome. Suena junto con la música que esté puesta: si el video trae su propio sonido, conviene que el nivel no tenga música en ese momento. |

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

- Una **imagen** que el contenido o el mapa nombran y no existe es **error**: el nivel no puede dibujarse.
- Una **voz** que no existe es **advertencia**: se usa voz sintetizada, así que se puede escribir el nivel antes de grabar.
- La animación de un paso `anima` y un **video** que no existen son **error**; un **sonido** o una **música**
  que faltan son **advertencia**: solo no suenan.
- Usar una clave del tipo equivocado (una imagen donde va un audio) es error.
- Si la misma clave está en dos carpetas de `assets`, **gana la primera de la lista** y hay advertencia.
  Así un nivel puede reemplazar a propósito un asset común.

## 5. Validar

```bash
bunx escenario-engine validar ruta/al/nivel.json --minijuegos Tortilleria,Fruteria --cinematicas intro
```

`--minijuegos` y `--cinematicas` son los nombres que el sitio registró; sin ellos, los pasos `juego` y las
cinemáticas con `codigo` no se revisan.

Corrige hasta tener **cero errores**; el comando termina con código 1 si queda alguno. Las advertencias se revisan,
pero no bloquean. Cada mensaje dice dónde está el problema, con la ruta dentro del contenido:

```
✗ secuencia "aun_no_item" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"
✗ npcs.tortu.dialogo[1].dice[0]: el hablante "tortuga" no existe en meta.personajes
✗ meta.personajes.tortu.sprite: no existe la imagen "spr_tortu" en los assets del nivel
⚠ npcs.tortu.dialogo[0].dice[0].audio: no existe la voz "vo_tortu_provecho"; se usará voz sintetizada
```

Los problemas del mapa nombran el objeto de Tiled por su número y su nombre:

```
✗ mapa: objeto #12 "Doña Tortu" (npc) tiene id "tortu2", que no existe en meta.personajes
✗ mapa: objeto #7 de la capa "decorado": la clase "puesto" no existe; las clases de decorado son: parado, plano, colgado
✗ camina "frente_tortileria" en npcs.tortu.dialogo[1].dice[0]: no hay un punto con ese nombre en el mapa
```

Y los de las cinemáticas y los pasos de escena:

```
✗ cinematicas.intro.pasos[2]: una cinemática no puede llevar "elige", que necesita al jugador
✗ cinematicas.intro.pasos[0]: "camara": "plano_sla" no es un plano de mundo.planos, ni un personaje, ni "jugador"
✗ cinematicas.intro.pasos[3]: "desaparece": "tommy" no se puede usar: es el personaje del jugador y debe seguir en el escenario
✗ mundo.planos.plano_sala.mira: "sillon" no es un personaje, ni un punto del mapa, ni un objeto del decorado con id
⚠ cinematicas.intro.pasos[1]: "tommy_sentado" es una imagen fija y el paso no lleva "repite": no se alcanzará a ver; agrega "repite": true para dejar al personaje con ese dibujo
```

### Cómo se juega

| Para… | Con dedo o ratón | Con teclado |
| --- | --- | --- |
| Caminar | Tocar un lugar del piso | Mantener oprimida `W` `A` `S` `D` o una flecha |
| Hablar con alguien o usar un objeto | Tocarlo: el jugador camina hasta ahí | — |
| Hablar con quien se tiene a la mano | — | `E`, `Enter` o la barra espaciadora |
| Seguir un diálogo | Tocar la pantalla | `Enter` o la barra espaciadora |
| Elegir una opción | Tocar su tarjeta | Las teclas `1` a `9` |
| Saltar una cinemática | Tocar el botón de saltar | — |

### Verlo en la demo

```bash
bun ejemplo/servidor.ts     # y abrir http://localhost:3000
```

La demo empieza en `ejemplo/niveles/casa` y sigue en `ejemplo/niveles/barrio`. Para entrar directo a un nivel,
nómbralo en la dirección: `http://localhost:3000/?nivel=barrio`. Para agregar un nivel, regístralo en
`ejemplo/demo.ts`.

Desde código (por ejemplo, en una prueba del host):

```js
import { validarNivel } from '@pardalis/escenario-engine/validar';

const resultado = await validarNivel('niveles/barrio/nivel.json', { minijuegos: ['Tortilleria'] });
// resultado.errores, resultado.advertencias
```

Después, pruébalo como lo usarán: en una tablet con el dedo, con teclado y en modo proyección.
Revisa que nada requiera leer.

### Crear planos con la cámara libre

Abre el nivel en modo depuración: en la demo, agrega `depurar` a la dirección
(`http://localhost:3000/?nivel=barrio&depurar`); en un sitio, crea el juego con `depurar: true`.

En ese modo se ven **las guías del mapa** sobre el piso, cada una con su nombre: el piso (verde), las huellas
que bloquean el paso (rojo), lo que no bloquea (naranja), las zonas (azul), la salida (morado) y los puntos.
Sirven para comprobar que el mapa dice lo que quisiste decir.

Con la tecla `C` entras a la cámara libre (el juego se pausa mientras tanto):

| Control | Acción |
| --- | --- |
| `C` | Entra o sale de la cámara libre |
| Arrastrar | Gira alrededor de lo que se mira; hacia arriba o abajo, baja o sube la cámara |
| Rueda | Acerca o aleja |
| Clic en un personaje, en un objeto con `id` o cerca de un punto | Lo fija como `mira` del plano |
| `1`–`9` | Salta a los planos que el nivel ya tiene, para compararlos o ajustarlos |
| `P` | Copia el plano actual |

Arriba del juego se ve siempre el plano que llevas, ya escrito como va en el contenido:

```
"plano_nuevo": { "mira": "tortu", "distancia": 5.5, "altura": 2.4, "giro": -14 }
```

Pégalo dentro de `mundo.planos`, cámbiale el nombre y úsalo en un paso `camara`.
Un plano solo puede mirar a algo con nombre: si quieres mirar a un lugar vacío, agrégale un `punto` al mapa.

## 6. Qué cambió respecto a la versión 2.0

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
| Mapa en coordenadas de pantalla, con capas `capas` y parallax | Mapa visto desde arriba, con capas `suelo` y `telones`. |
| Decorado como objetos de imagen con catálogo de mercado (`puesto`, `cajas`…) y `huella` a mano | Rectángulos que son la huella, con tres clases: `parado`, `plano`, `colgado`. |
| `zonaComentario` con `cooldown`; `enfoqueCamara`; `puntoInteraccion` | `zona` con `grupo` y `espera`; los otros dos no existen. |
| Todo NPC del mapa necesitaba diálogo | El diálogo es opcional. |
| `velocidadX`/`velocidadY` en píxeles; cámara `follow`/`rails`/`pan` | `jugador.velocidad` en metros por segundo; `mundo.camara` con `distancia`, `altura` y `giro`. |
| `jugador.animaciones`, `radioAviso`, `mundo.fondo`… | No existen en la 3.0. Un personaje se anima con un `sprite` que sea animación y con el paso `anima`. |

// Lo que comparten las acciones que hacen que un paso de diálogo se vea y se oiga
// (decir una línea, elegir una opción, caminar): los puertos y los datos del nivel que necesitan.

import type { Contenido } from '../dominio/contenido.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { Decorado } from '../dominio/mundo.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import type { MapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import type { Audio } from '../puertos/audio.ts';
import type { Azar } from '../puertos/azar.ts';
import type { Escenario, ImagenDeEscena } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { Minijuego } from '../puertos/minijuego.ts';
import type { Reloj } from '../puertos/reloj.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';
import type { Reparto } from './reparto.ts';

export interface PiezasDeEscena {
  readonly contenido: Contenido;
  /** Los puntos con nombre del mapa: los destinos de los pasos `camina`. */
  readonly puntos: Readonly<Record<string, Punto>>;
  /**
   * El decorado del mapa, en el orden en que se montó: un paso `anima` puede cambiarle el dibujo a un objeto con id.
   * `undefined` = el nivel no tiene decorado.
   */
  readonly decorado?: readonly Decorado[];
  /** El terreno del nivel y su rejilla: con ellos las caminatas de un paso `camina` rodean lo que estorba. */
  readonly caminos: MapaDeCaminos;
  /** El centro del mapa: donde aparecen los efectos en un nivel sin jugador. */
  readonly centroDelLugar: Punto;
  /** El idioma del sitio. Las líneas de un personaje que habla otro idioma muestran y dicen su traducción. */
  readonly idiomaBase: Idioma;
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
  readonly audio: Audio;
  readonly reloj: Reloj;
  /** El azar del juego. Lo reciben los minijuegos, para que una `semilla` los haga repetibles también a ellos. */
  readonly azar: Azar;
  readonly reparto: Reparto;
  /** El estado del nivel. Los minijuegos lo leen; solo el ejecutor de pasos lo cambia. */
  readonly estado: EstadoEnJuego;
  /** Los minijuegos que registró el host, por nombre. */
  readonly minijuegos: Readonly<Record<string, Minijuego>>;
  /** La dirección completa de un asset por su clave, o `undefined` si el nivel no lo tiene (una voz sin grabar). */
  readonly direccionDeAsset: (clave: string) => string | undefined;
  /** La imagen (o la animación) de una clave de assets, lista para dibujarse. La validación garantiza que existe. */
  readonly imagenDeAsset: (clave: string) => ImagenDeEscena;
  /** Se llama cada vez que una línea muestra una tarjeta de vocabulario. */
  readonly alVerPalabra: (palabra: PalabraDeVocabulario) => void;
  /** Se llaman al abrirse y al cerrarse el espacio de un minijuego, con el nombre del minijuego. */
  readonly alEmpezarMinijuego: (nombre: string) => void;
  readonly alTerminarMinijuego: (nombre: string) => void;
}

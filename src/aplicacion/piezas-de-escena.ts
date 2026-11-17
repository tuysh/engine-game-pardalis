// Lo que comparten las acciones que hacen que un paso de diálogo se vea y se oiga
// (decir una línea, elegir una opción, caminar): los puertos y los datos del nivel que necesitan.

import type { Contenido } from '../dominio/contenido.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import type { Audio } from '../puertos/audio.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { Reloj } from '../puertos/reloj.ts';
import type { Reparto } from './reparto.ts';

export interface PiezasDeEscena {
  readonly contenido: Contenido;
  /** Los puntos con nombre del mapa: los destinos de los pasos `camina`. */
  readonly puntos: Readonly<Record<string, Punto>>;
  /** El idioma del sitio. Las líneas de un personaje que habla otro idioma muestran y dicen su traducción. */
  readonly idiomaBase: Idioma;
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
  readonly audio: Audio;
  readonly reloj: Reloj;
  readonly reparto: Reparto;
  /** La dirección completa de un asset por su clave, o `undefined` si el nivel no lo tiene (una voz sin grabar). */
  readonly direccionDeAsset: (clave: string) => string | undefined;
  /** Se llama cada vez que una línea muestra una tarjeta de vocabulario. */
  readonly alVerPalabra: (palabra: PalabraDeVocabulario) => void;
}

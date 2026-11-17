// El puerto de la interfaz: lo que se muestra encima del escenario para conversar
// (globos, opciones, tarjetas de vocabulario) y los toques que eso recibe.
// La aplicación decide qué se muestra y cuándo; el adaptador decide cómo se ve.

import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import type { LugarEnPantalla } from './escenario.ts';

/** Lo que lleva un globo de diálogo. */
export interface GloboPorMostrar {
  readonly texto: string;
  /** Se muestra debajo del texto, más pequeña. */
  readonly traduccion?: string;
  /** Si existe, el globo lleva una tarjeta de vocabulario con la palabra en los dos idiomas. */
  readonly palabra?: PalabraDeVocabulario;
}

/** Una de las tarjetas entre las que el jugador elige. */
export interface OpcionPorMostrar {
  readonly texto?: string;
  readonly traduccion?: string;
  /** Dirección completa de su imagen. Es lo que permite elegir a quien todavía no lee. */
  readonly direccionDeLaImagen?: string;
}

export interface Interfaz {
  /** Muestra un globo de diálogo. Si ya había uno, lo reemplaza. */
  mostrarGlobo(globo: GloboPorMostrar): void;
  /**
   * Pone el piquito del globo en un lugar de la pantalla: encima de la cabeza de quien habla.
   * Con `undefined` (quien habla no está en el escenario), el globo va arriba y al centro.
   */
  apuntarGlobo(lugar: LugarEnPantalla | undefined): void;
  ocultarGlobo(): void;

  /**
   * Mientras alguien escucha, un toque en cualquier parte de la pantalla llama a `funcion`
   * y no llega al escenario (no hace caminar al jugador). Devuelve una función que deja de escuchar.
   */
  alTocarParaSeguir(funcion: () => void): () => void;

  /** Muestra la pregunta y sus opciones como tarjetas grandes. */
  mostrarOpciones(pregunta: string, opciones: readonly OpcionPorMostrar[]): void;
  /** Resalta una tarjeta, por ejemplo mientras se lee en voz alta. `undefined` = ninguna. */
  resaltarOpcion(posicion: number | undefined): void;
  ocultarOpciones(): void;
  /** Avisa de la posición de la tarjeta que el jugador eligió. Devuelve una función que deja de escuchar. */
  alElegirOpcion(funcion: (posicion: number) => void): () => void;

  /** Quita todo lo que la interfaz puso en la página. Se puede llamar más de una vez. */
  destruir(): void;
}

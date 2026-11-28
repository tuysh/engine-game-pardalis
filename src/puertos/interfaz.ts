// El puerto de la interfaz: lo que se muestra encima del escenario para conversar
// (globos, opciones, tarjetas de vocabulario) y los toques que eso recibe.
// La aplicación decide qué se muestra y cuándo; el adaptador decide cómo se ve.

import type { GrosorDeFranjas } from '../dominio/contenido.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import type { LugarEnPantalla } from './escenario.ts';

/** Lo que lleva un globo de diálogo. */
export interface GloboPorMostrar {
  readonly texto: string;
  /** Se muestra debajo del texto, más pequeña. */
  readonly traduccion?: string;
  /** Si existe, el globo lleva una tarjeta de vocabulario con la palabra en los dos idiomas. */
  readonly palabra?: PalabraDeVocabulario;
  /**
   * `true` = el personaje lo piensa y no lo dice: el globo es una nube con burbujitas, para que se entienda
   * sin leer. `undefined` = es un globo de diálogo normal.
   */
  readonly esPensamiento?: boolean;
}

/** Una de las tarjetas entre las que el jugador elige. */
export interface OpcionPorMostrar {
  readonly texto?: string;
  readonly traduccion?: string;
  /** Dirección completa de su imagen. Es lo que permite elegir a quien todavía no lee. */
  readonly direccionDeLaImagen?: string;
}

export interface Interfaz {
  /**
   * Muestra un globo de diálogo. Si ya había uno, lo reemplaza.
   * Devuelve la función que quita ESE globo: si para entonces ya lo reemplazó otro, no hace nada.
   * Así quien termina tarde (un comentario que se interrumpe) no borra el globo de quien llegó después.
   */
  mostrarGlobo(globo: GloboPorMostrar): () => void;
  /**
   * Pone el piquito del globo en un lugar de la pantalla: encima de la cabeza de quien habla.
   * Con `undefined` (quien habla no está en el escenario), el globo va arriba y al centro.
   */
  apuntarGlobo(lugar: LugarEnPantalla | undefined): void;

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

  /**
   * Muestra la flecha que señala la salida del nivel. Se entiende por su dibujo y su movimiento;
   * `texto` es una leyenda opcional. Si ya estaba, solo cambia su leyenda.
   */
  mostrarFlecha(texto: string | undefined): void;
  /** Pone la punta de la flecha en un lugar de la pantalla. */
  apuntarFlecha(lugar: LugarEnPantalla): void;
  ocultarFlecha(): void;

  /**
   * Muestra una señal pequeña sobre el personaje u objeto que el jugador tiene a la mano,
   * para que sepa que puede hablarle o usarlo. Si ya estaba, no cambia nada.
   */
  mostrarAviso(): void;
  /** Pone la señal en un lugar de la pantalla: encima de lo que se puede tocar. */
  apuntarAviso(lugar: LugarEnPantalla): void;
  ocultarAviso(): void;

  /**
   * Oscurece toda la pantalla del juego. `opacidad` va de 0 (no se oscurece nada) a 1 (todo negro).
   * Los globos de diálogo se siguen viendo encima.
   */
  ponerFundido(opacidad: number): void;

  /**
   * Cubre toda la pantalla de blanco, como el flash de una cámara (el efecto `destello`).
   * `opacidad` va de 0 (no se ve) a 1 (todo blanco). Los globos de diálogo se siguen viendo encima.
   */
  ponerDestello(opacidad: number): void;

  /**
   * Muestra las franjas negras de arriba y abajo que dicen «esto es una cinemática», y no deja que
   * los toques lleguen al escenario. Si se da `alSaltar`, aparece un botón que lo llama al tocarlo.
   * `grosor` es el de `mundo.franjas` del nivel. Mientras se ven, los globos se acomodan entre las dos franjas.
   */
  mostrarFranjasDeCine(alSaltar: (() => void) | undefined, grosor: GrosorDeFranjas): void;
  ocultarFranjasDeCine(): void;

  /**
   * Crea un elemento vacío a pantalla completa, encima de todo, para que un minijuego del host dibuje dentro.
   * Está en la página normal (no aislado), así que le aplican los estilos del host.
   */
  abrirEspacioDeMinijuego(): HTMLElement;
  /** Quita el espacio del minijuego con todo lo que tenga dentro. Si no hay ninguno, no hace nada. */
  cerrarEspacioDeMinijuego(): void;

  /** Quita todo lo que la interfaz puso en la página. Se puede llamar más de una vez. */
  destruir(): void;
}

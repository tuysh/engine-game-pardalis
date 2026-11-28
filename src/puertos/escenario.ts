// El puerto del escenario: lo que la aplicación necesita que se dibuje y que se pueda tocar.
// La aplicación decide dónde está cada cosa (en metros, sobre el plano visto desde arriba);
// el adaptador decide cómo se ve.

import type { AjustesDeCamara } from '../dominio/contenido.ts';
import type { Punto, Rectangulo } from '../dominio/geometria.ts';
import type { GuiaDeDepuracion } from '../dominio/guias-de-depuracion.ts';
import type { ClaseDeDecorado, Mira } from '../dominio/mundo.ts';

/** Una imagen lista para dibujarse: de dónde se descarga y cuánto mide. */
export interface ImagenDeEscena {
  /** Dirección completa de cada cuadro. Una imagen fija tiene un solo cuadro. */
  readonly direcciones: readonly string[];
  /** Velocidad de la animación. No cuenta si hay un solo cuadro. */
  readonly cuadrosPorSegundo: number;
  /** Tamaño del dibujo original; sirve para decidir con cuánto detalle se convierte en textura. */
  readonly anchoEnPixeles: number;
  readonly altoEnPixeles: number;
  /** Tamaño con el que aparece en el escenario. */
  readonly anchoEnMetros: number;
  readonly altoEnMetros: number;
}

export interface SueloDeEscena {
  readonly imagen: ImagenDeEscena;
  /** Dónde va la esquina de menor `x` y menor `y` de la imagen. */
  readonly esquina: Punto;
}

export interface TelonDeEscena {
  readonly imagen: ImagenDeEscena;
  readonly desde: Punto;
  readonly hasta: Punto;
  readonly altoEnMetros: number;
}

export interface DecoradoDeEscena {
  readonly clase: ClaseDeDecorado;
  readonly imagen: ImagenDeEscena;
  readonly huella: Rectangulo;
  /** Del piso al borde inferior del dibujo. Solo cuenta para la clase `colgado`. */
  readonly alturaEnMetros: number;
  /** Si existe, el objeto se puede tocar y el toque lleva este id. */
  readonly id?: string;
}

/** Lo que no se mueve durante el nivel. */
export interface Escenografia {
  /** Color de lo que queda vacío, como `'#bfe6f5'`. */
  readonly colorDeFondo: string;
  readonly suelo?: SueloDeEscena;
  readonly telones: readonly TelonDeEscena[];
  readonly decorado: readonly DecoradoDeEscena[];
}

export interface PersonajeDeEscena {
  readonly id: string;
  readonly imagen: ImagenDeEscena;
  /** Dónde pisa. */
  readonly posicion: Punto;
  readonly mira: Mira;
  /** `true` si tocarlo debe avisarse con un toque de tipo `personaje`. */
  readonly sePuedeTocar: boolean;
}

/** Un lugar de la pantalla, en puntos de CSS desde la esquina superior izquierda del juego. */
export interface LugarEnPantalla {
  readonly x: number;
  readonly y: number;
}

/** Un personaje o un objeto del decorado que se puede tocar (lo que no es el piso). */
export type ToqueAAlgo =
  | { readonly tipo: 'personaje'; readonly id: string }
  | { readonly tipo: 'decorado'; readonly id: string };

/** Lo que el jugador tocó. */
export type Toque =
  | { readonly tipo: 'piso'; readonly punto: Punto }
  | {
      readonly tipo: 'personaje';
      readonly id: string;
      /**
       * El personaje u objeto tocable que estaba justo detrás, tapado por este (el piso no cuenta).
       * Sirve para que el acompañante no le gane el toque a lo que el jugador quería tocar.
       */
      readonly detras?: ToqueAAlgo;
    }
  | { readonly tipo: 'decorado'; readonly id: string };

export interface Escenario {
  /**
   * Arma la escenografía. Termina cuando sus imágenes ya cargaron.
   * Reemplaza la que hubiera y saca a los personajes que estaban: es un lugar nuevo.
   */
  montar(escenografia: Escenografia): Promise<void>;

  /**
   * Pone un personaje de papel en el escenario. Termina cuando su imagen ya cargó.
   * Si su imagen es una animación, se repite sin parar (sirve para que alguien respire o parpadee).
   */
  agregarPersonaje(personaje: PersonajeDeEscena): Promise<void>;
  /** Saca a un personaje del escenario. Si no está, no hace nada. */
  quitarPersonaje(id: string): void;
  moverPersonaje(id: string, posicion: Punto): void;
  voltearPersonaje(id: string, mira: Mira): void;

  /**
   * Cambia el dibujo de un personaje por otra imagen o animación. Termina cuando el dibujo nuevo ya se ve.
   * Una animación empieza en su primer cuadro; con `repite` vuelve a empezar al terminar y, sin él,
   * se queda en su último cuadro. Si el personaje no está en el escenario, no hace nada.
   */
  ponerDibujoDePersonaje(id: string, imagen: ImagenDeEscena, opciones: { readonly repite: boolean }): Promise<void>;

  /**
   * Descarga por adelantado imágenes que se usarán más tarde (las animaciones de una cinemática,
   * un personaje que todavía no entra), para que aparezcan sin demora cuando les toque.
   * Se llama una vez por lugar, cuando ya tiene su escenografía y sus personajes: lo que el escenario
   * había descargado para el lugar anterior y este no usa, se libera aquí.
   */
  precargar(imagenes: readonly ImagenDeEscena[]): Promise<void>;

  /**
   * Dónde se ve en la pantalla el punto justo encima de la cabeza de un personaje: ahí apunta su globo.
   * `undefined` si el personaje no está en el escenario.
   */
  lugarEnPantallaDe(id: string): LugarEnPantalla | undefined;

  /**
   * Avisa cada vez que termina de cargar un archivo de imagen pedido con `montar`, `agregarPersonaje`
   * o `precargar` (también si ya estaba cargado de antes). Sirve para mostrar el avance de la carga.
   * Devuelve una función que deja de avisar.
   */
  alCargarImagen(funcion: () => void): () => void;

  /** Dónde se ve en la pantalla un punto del lugar que está a cierta altura sobre el piso. */
  lugarEnPantallaDelPunto(punto: Punto, alturaEnMetros: number): LugarEnPantalla;

  /**
   * Empieza un efecto visual (`magia`, `confeti`) alrededor de un punto del lugar.
   * No espera a que termine: el efecto se anima solo en los cuadros siguientes y luego se quita.
   */
  reproducirEfecto(nombre: string, punto: Punto): void;

  /**
   * Dice qué personaje es el jugador (`undefined` = el nivel no tiene). Lo `parado` del decorado que quede
   * entre la cámara y él (un árbol, alguien parado cerca de la cámara) se vuelve transparente mientras lo tapa.
   * Sigue valiendo al montar otra escenografía, hasta que se llame otra vez.
   */
  marcarJugador(id: string | undefined): void;

  /**
   * Coloca la cámara: apunta a un punto del piso desde donde dicen los ajustes. La cámara salta ahí;
   * quien quiera un movimiento suave llama en cada cuadro con un encuadre un poco más cerca del final.
   */
  enfocar(punto: Punto, camara: AjustesDeCamara): void;

  /** Dibuja un cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  dibujar(segundos: number): void;

  /**
   * Dibuja sobre el piso las guías del modo depuración (contornos y marcas con su etiqueta).
   * Reemplaza las que hubiera; con una lista vacía, las quita. Termina cuando ya se ven.
   */
  mostrarGuias(guias: readonly GuiaDeDepuracion[]): Promise<void>;

  /** Avisa de cada toque. Devuelve una función que cancela el aviso. */
  alTocar(funcion: (toque: Toque) => void): () => void;

  /** Libera todo lo que el escenario creó. Se puede llamar más de una vez. */
  destruir(): void;
}

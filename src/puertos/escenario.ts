// El puerto del escenario: lo que la aplicación necesita que se dibuje y que se pueda tocar.
// La aplicación decide dónde está cada cosa (en metros, sobre el plano visto desde arriba);
// el adaptador decide cómo se ve.

import type { AjustesDeCamara } from '../dominio/contenido.ts';
import type { Punto, Rectangulo } from '../dominio/geometria.ts';
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

/** Lo que el jugador tocó. */
export type Toque =
  | { readonly tipo: 'piso'; readonly punto: Punto }
  | { readonly tipo: 'personaje'; readonly id: string }
  | { readonly tipo: 'decorado'; readonly id: string };

export interface Escenario {
  /** Arma la escenografía. Termina cuando sus imágenes ya cargaron. Reemplaza la que hubiera. */
  montar(escenografia: Escenografia): Promise<void>;

  /** Pone un personaje de papel en el escenario. Termina cuando su imagen ya cargó. */
  agregarPersonaje(personaje: PersonajeDeEscena): Promise<void>;
  moverPersonaje(id: string, posicion: Punto): void;
  voltearPersonaje(id: string, mira: Mira): void;

  /**
   * Apunta la cámara a un punto del piso. Con `deInmediato` la cámara salta ahí;
   * sin él, se acerca con suavidad en los cuadros siguientes.
   */
  enfocar(punto: Punto, camara: AjustesDeCamara, opciones: { readonly deInmediato: boolean }): void;

  /** Dibuja un cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  dibujar(segundos: number): void;

  /** Avisa de cada toque. Devuelve una función que cancela el aviso. */
  alTocar(funcion: (toque: Toque) => void): () => void;

  /** Libera todo lo que el escenario creó. Se puede llamar más de una vez. */
  destruir(): void;
}

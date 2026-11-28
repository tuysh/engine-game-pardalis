// Lo que el ejecutor de pasos pide que ocurra en pantalla. El ejecutor (ejecutar-pasos.ts) decide
// QUÉ paso sigue; estas acciones hacen que el paso SE VEA Y SE OIGA.
//
// Las acciones que tardan (reciben `senal`) son promesas que terminan cuando la acción terminó
// (el jugador tocó para seguir, el personaje llegó, el minijuego acabó) y que deben terminar también
// en cuanto `senal` se dispara. Las que no reciben `senal` ocurren de una vez.
//
// Están en dos grupos: las de un diálogo (hablar, elegir, caminar, jugar) y las que dirigen la escena
// (cámara, personajes, sonido, fundidos, video). Quien las crea con las piezas de un nivel es
// crear-acciones-de-paso.ts.

import type { Idioma } from '../dominio/idioma.ts';
import type {
  Opcion,
  PasoDeAnimacion,
  PasoDeAparicion,
  PasoDeCamara,
  PasoDeFundido,
  PasoDeLinea,
  PasoDeMirada,
} from '../dominio/paso.ts';
import type { ResultadoDeMinijuego } from '../puertos/minijuego.ts';

/** Las acciones de un diálogo: lo que pasa entre el jugador y quien le habla. */
export interface AccionesDeDialogo {
  /** Muestra y dice una línea. `textoCompleto` ya trae sus variables entre llaves reemplazadas. */
  decirLinea(linea: PasoDeLinea, textoCompleto: string, senal: AbortSignal): Promise<void>;

  /** Muestra la pregunta con esas opciones y devuelve la posición en la lista de la que eligió el jugador. */
  elegirOpcion(pregunta: string, opciones: readonly Opcion[], senal: AbortSignal): Promise<number>;

  reproducirEfecto(nombre: string, senal: AbortSignal): Promise<void>;

  /** Lleva al personaje caminando hasta un punto del mapa. */
  caminar(personaje: string, punto: string, senal: AbortSignal): Promise<void>;
  /** Deja al personaje ya parado en un punto del mapa, sin caminata: es como queda al terminar `caminar`. */
  colocar(personaje: string, punto: string): void;

  /**
   * Abre un minijuego del host y espera su resultado. Si el minijuego falla con un error,
   * debe entregar `{ exito: false }` en vez de rechazar: un error del host nunca castiga al jugador.
   */
  jugarMinijuego(nombre: string, config: unknown, senal: AbortSignal): Promise<ResultadoDeMinijuego>;

  /** Una pausa. */
  esperar(esperaEnSegundos: number, senal: AbortSignal): Promise<void>;
}

/** Las acciones que dirigen la escena: la cámara, quién está en el escenario, lo que suena y lo que se ve. */
export interface AccionesDeDireccion {
  /** Lleva la cámara a su destino en el tiempo que dice el paso. Sin duración, es un corte. */
  moverCamara(paso: PasoDeCamara, senal: AbortSignal): Promise<void>;
  /** Deja la cámara ya en su destino, sin recorrido: es como queda al terminar `moverCamara`. */
  cortarCamara(destino: string): void;

  /** Voltea a un personaje hacia otro personaje o hacia un punto del mapa. */
  mirar(paso: PasoDeMirada): void;

  /**
   * Cambia el dibujo de un personaje por una animación o una imagen. Con `repite`, termina en cuanto
   * el dibujo nuevo se ve; sin él, espera a que la animación pase una vez y regresa al dibujo normal.
   */
  animar(paso: PasoDeAnimacion, senal: AbortSignal): Promise<void>;

  /** Mete a un personaje al escenario. Termina cuando su imagen ya cargó. */
  aparecer(paso: PasoDeAparicion): Promise<void>;
  /** Saca a un personaje del escenario. */
  desaparecer(personaje: string): void;

  /** Cambia la música de fondo por la de esa clave de assets. */
  ponerMusica(clave: string): void;
  /** Toca un sonido corto, sin esperar a que termine. */
  tocarSonido(clave: string): void;

  /** Aclara u oscurece la pantalla en el tiempo que dice el paso. */
  fundir(paso: PasoDeFundido, senal: AbortSignal): Promise<void>;
  /** Deja la pantalla ya clara (`abrir`) o negra (`cerrar`): es como queda al terminar `fundir`. */
  dejarFundido(sentido: 'abrir' | 'cerrar'): void;

  /**
   * Reproduce un video a pantalla completa: el de la clave que corresponde al idioma del sitio.
   * Si el video no se puede reproducir, termina igual: nunca deja trabada una escena.
   */
  reproducirVideo(clavePorIdioma: Readonly<Record<Idioma, string>>, senal: AbortSignal): Promise<void>;

  /** Pide que el nivel termine hacia un destino en cuanto acabe la escena en curso. */
  pedirSalida(destino: string): void;

  /** Cambia quién acompaña al jugador mientras explora. Con `undefined`, ya nadie lo acompaña. */
  cambiarAcompanante(personaje: string | undefined): void;
}

/** Todas las acciones que el ejecutor de pasos puede pedir. */
export interface AccionesDePaso extends AccionesDeDialogo, AccionesDeDireccion {}

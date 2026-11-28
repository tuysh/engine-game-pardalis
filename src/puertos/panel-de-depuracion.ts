// El puerto del panel de depuración: lo que quien arma un nivel le pide al motor con el teclado y el ratón
// mientras usa la cámara libre (docs/DISENO-3.0.md §9.3), y el texto con el que el motor le responde.
// Solo existe cuando el juego se crea con `depurar: true`.

import type { GrosorDeFranjas } from '../dominio/contenido.ts';

/** Lo que pide quien depura. */
export type OrdenDeDepuracion =
  /** Entrar o salir de la cámara libre (la tecla C). */
  | { readonly tipo: 'alternarCamaraLibre' }
  /** Copiar el plano actual como JSON (la tecla P). */
  | { readonly tipo: 'copiarPlano' }
  /** Saltar a uno de los planos ya definidos (las teclas 1 a 9). `numero` empieza en 1. */
  | { readonly tipo: 'irAlPlano'; readonly numero: number }
  /** Girar la cámara: lo que se arrastró el ratón, en puntos de CSS. Hacia la derecha y hacia abajo son positivos. */
  | { readonly tipo: 'girar'; readonly haciaLaDerechaEnPuntos: number; readonly haciaAbajoEnPuntos: number }
  /** Acercar o alejar la cámara: las muescas que giró la rueda. Positivo = alejar. */
  | { readonly tipo: 'alejar'; readonly muescas: number };

export interface PanelDeDepuracion {
  /** Avisa de cada orden. Devuelve una función que deja de avisar. */
  alRecibirOrden(funcion: (orden: OrdenDeDepuracion) => void): () => void;

  /**
   * Le dice al panel si la cámara libre está activa. Solo entonces atiende los arrastres y la rueda
   * (y no deja que la rueda desplace la página).
   */
  avisarCamaraLibre(estaActiva: boolean): void;

  /**
   * Marca encima del juego dónde quedan las franjas negras de cine de ese grosor, para encuadrar un plano
   * contra lo que de verdad se verá en una cinemática. Con `undefined`, la marca se quita.
   */
  mostrarGuiaDeFranjas(grosor: GrosorDeFranjas | undefined): void;

  /** Muestra un texto fijo en una esquina del juego: la ayuda y el plano actual. Reemplaza el anterior. */
  mostrarTexto(texto: string): void;

  /** Copia un texto al portapapeles. Termina con `false` si el navegador no lo permitió. */
  copiar(texto: string): Promise<boolean>;

  /** Quita el panel y deja de escuchar. Se puede llamar más de una vez. */
  destruir(): void;
}

// Qué parte del alto del juego ocupa cada franja negra de cine (la de arriba y la de abajo), según el grosor
// que pide el nivel en `mundo.franjas`. Lo usan la interfaz, que dibuja las franjas de verdad, y el panel de
// depuración, que enseña con una guía dónde quedarán mientras se encuadra un plano con la cámara libre.

import type { GrosorDeFranjas } from '../../dominio/contenido.ts';

/** Las franjas de siempre: casi una décima del alto cada una, como en el cine. */
const PROPORCION_DE_LAS_FRANJAS_NORMALES = 0.09;
const PROPORCION_DE_LAS_FRANJAS_DELGADAS = 0.045;
const PROPORCION_SIN_FRANJAS = 0;

/** Para pasar de una proporción (0.09) a un porcentaje de CSS (9%). */
const PORCIENTO_DE_UNA_PROPORCION_COMPLETA = 100;

/** La parte del alto del juego que ocupa cada franja: de 0 (no hay franja) a 1 (todo el alto). */
export function proporcionDeLaFranja(grosor: GrosorDeFranjas): number {
  switch (grosor) {
    case 'normales':
      return PROPORCION_DE_LAS_FRANJAS_NORMALES;
    case 'delgadas':
      return PROPORCION_DE_LAS_FRANJAS_DELGADAS;
    case 'ninguna':
      return PROPORCION_SIN_FRANJAS;
  }
}

/** El alto de cada franja como lo entiende CSS, por ejemplo `"9%"`. */
export function altoDeLaFranjaEnCss(grosor: GrosorDeFranjas): string {
  return `${proporcionDeLaFranja(grosor) * PORCIENTO_DE_UNA_PROPORCION_COMPLETA}%`;
}

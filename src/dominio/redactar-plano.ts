// Escribe un plano de cámara como el renglón de JSON que va dentro de `mundo.planos` del contenido.
// Lo usa la cámara libre del modo depuración: quien arma el nivel encuadra a mano y copia el resultado.

import type { Plano } from './contenido.ts';

/** Nombre con el que sale el plano copiado; quien lo pega le pone el suyo. */
export const NOMBRE_DE_UN_PLANO_NUEVO = 'plano_nuevo';

const DECIMALES_DE_LOS_METROS = 1;

/**
 * Ejemplo: `"plano_nuevo": { "mira": "tortu", "distancia": 5.5, "altura": 2.4, "giro": -14 }`.
 * Los metros se redondean a un decimal y el giro a grados enteros: más detalle no se nota en pantalla.
 */
export function redactarPlano(plano: Plano): string {
  const distancia = redondearMetros(plano.distanciaEnMetros);
  const altura = redondearMetros(plano.alturaEnMetros);
  const giro = Math.round(plano.giroEnGrados);
  const mira = JSON.stringify(plano.mira);
  return `"${NOMBRE_DE_UN_PLANO_NUEVO}": { "mira": ${mira}, "distancia": ${distancia}, "altura": ${altura}, "giro": ${giro} }`;
}

function redondearMetros(metros: number): number {
  return Number(metros.toFixed(DECIMALES_DE_LOS_METROS));
}

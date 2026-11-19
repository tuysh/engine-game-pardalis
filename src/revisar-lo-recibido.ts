// Recibe lo que el host le entrega a `crearEscenario()` y lo revisa completo antes de usarlo.
// Viene de afuera, muchas veces de JavaScript sin tipos: un descuido se explica aquí con claridad
// en vez de aparecer más tarde como un error difícil de rastrear.

import { revisarDondeMontar } from './adaptadores/dom/revisar-elemento.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { OpcionesDeEscenario } from './opciones-de-escenario.ts';
import { quitarOpcionesVacias, revisarOpciones } from './revisar-opciones.ts';

/**
 * Revisa el elemento y las opciones. Las advertencias van a la consola; con errores, lanza un
 * `ErrorDeEscenario` que los trae todos. Devuelve las opciones listas para usarse: sin las que llegaron en `null`.
 */
export function revisarLoRecibido(elemento: unknown, opciones: OpcionesDeEscenario): OpcionesDeEscenario {
  const revision = revisarOpciones(opciones);
  for (const advertencia of revision.advertencias) {
    console.warn(`[escenario-engine] ${advertencia}`);
  }

  const errores = [...revision.errores];
  const problemaDelElemento = revisarDondeMontar(elemento);
  if (problemaDelElemento !== undefined) {
    errores.push(problemaDelElemento);
  }
  if (errores.length > 0) {
    throw new ErrorDeEscenario(errores);
  }
  return quitarOpcionesVacias(opciones);
}

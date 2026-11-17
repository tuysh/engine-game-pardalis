// `crearEscenario()`: la única puerta de entrada del motor en el navegador (docs/DISENO-3.0.md §4).
// Es la raíz de composición: el único lugar que crea adaptadores y se los entrega a la aplicación.
//
// Estado: todavía no arma nada. Rechaza con un `ErrorDeEscenario` que lo dice con claridad,
// para que un host que ya instaló el paquete vea el mismo tipo de error que verá después.
// El escenario se conecta aquí conforme avancen las fases 4 a 8 del diseño (§13).

import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { Juego } from './juego.ts';
import type { OpcionesDeEscenario } from './opciones-de-escenario.ts';

/**
 * Crea el juego dentro de `elemento`, ocupando todo su tamaño.
 * La promesa termina cuando el nivel ya se puede jugar y rechaza con `ErrorDeEscenario`
 * si no pudo arrancar; `error.problemas` trae un mensaje por problema.
 */
export async function crearEscenario(elemento: HTMLElement, opciones: OpcionesDeEscenario): Promise<Juego> {
  if (opciones.senal !== undefined) {
    opciones.senal.throwIfAborted();
  }
  throw new ErrorDeEscenario([
    `crearEscenario() todavía no está disponible en esta versión del paquete (no se cargó el nivel "${opciones.nivel}")`,
  ]);
}

// Hace que un paso `camina` se vea: lleva a un personaje, cuadro a cuadro, hasta un punto del mapa.
// Estas caminatas van en línea recta a su punto y no miran el terreno: las escribió quien hizo el nivel.
//
// Si el diálogo se interrumpe, el personaje se queda donde iba.

import { acercarse } from '../dominio/caminar.ts';
import { VELOCIDAD_DEL_JUGADOR_POR_DEFECTO } from '../dominio/contenido.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** Quién camina y hasta dónde. */
export interface CaminataPorHacer {
  /** Id del personaje que camina. */
  readonly personaje: string;
  /** Nombre de un punto del mapa. */
  readonly punto: string;
}

export function caminarEnEscena(caminata: CaminataPorHacer, senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  const { personaje, punto } = caminata;
  const destino = piezas.puntos[punto]!; // la validación garantiza que el punto existe
  if (senal.aborted || !piezas.reparto.estaEnEscena(personaje)) {
    return Promise.resolve();
  }

  // Todos caminan a la velocidad del jugador, para que las escenas tengan un solo ritmo.
  let velocidadEnMetrosPorSegundo = VELOCIDAD_DEL_JUGADOR_POR_DEFECTO;
  if (piezas.contenido.jugador !== undefined) {
    velocidadEnMetrosPorSegundo = piezas.contenido.jugador.velocidadEnMetrosPorSegundo;
  }

  return new Promise((terminar) => {
    const finalizar = (): void => {
      dejarDeAvanzar();
      senal.removeEventListener('abort', finalizar);
      terminar();
    };

    const dejarDeAvanzar = piezas.reloj.enCadaCuadro((segundos) => {
      const posicion = piezas.reparto.posicionDe(personaje);
      if (posicion === undefined) {
        finalizar();
        return;
      }
      const posicionNueva = acercarse(posicion, destino, velocidadEnMetrosPorSegundo * segundos);
      piezas.reparto.mirarHacia(personaje, posicionNueva);
      piezas.reparto.mover(personaje, posicionNueva);

      const yaLlego = posicionNueva.x === destino.x && posicionNueva.y === destino.y;
      if (yaLlego) {
        finalizar();
      }
    });
    senal.addEventListener('abort', finalizar, { once: true });
  });
}

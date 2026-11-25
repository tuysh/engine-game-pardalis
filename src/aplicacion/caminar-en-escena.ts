// Hace que un paso `camina` se vea: lleva a un personaje, cuadro a cuadro, hasta un punto del mapa.
//
// Si quien camina y su punto están sobre el piso, sigue el piso y rodea el decorado (dominio/buscar-camino.ts).
// Si alguno está fuera (alguien que entra desde fuera del escenario) o no hay camino entre los dos,
// va en línea recta: así lo escribió quien hizo el nivel.
//
// Si el diálogo se interrumpe, el personaje se queda donde iba. Si una cinemática se salta,
// el personaje queda ya en su punto (`colocarEnEscena`).

import { buscarCamino } from '../dominio/buscar-camino.ts';
import { acercarse } from '../dominio/caminar.ts';
import { VELOCIDAD_DEL_JUGADOR_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Punto } from '../dominio/geometria.ts';
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

  const posicionInicial = piezas.reparto.posicionDe(personaje)!; // arriba se comprobó que está en escena
  let ruta = buscarRuta(posicionInicial, destino, piezas);

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
      const siguientePunto = ruta[0]!; // la ruta siempre tiene al menos el destino, y se termina al vaciarse
      const posicionNueva = acercarse(posicion, siguientePunto, velocidadEnMetrosPorSegundo * segundos);
      piezas.reparto.mirarHacia(personaje, posicionNueva);
      piezas.reparto.mover(personaje, posicionNueva);

      const pasoPorElPunto = posicionNueva.x === siguientePunto.x && posicionNueva.y === siguientePunto.y;
      if (pasoPorElPunto) {
        ruta = ruta.slice(1);
      }
      if (ruta.length === 0) {
        finalizar();
      }
    });
    senal.addEventListener('abort', finalizar, { once: true });
  });
}

/** Los puntos por los que pasa la caminata: el camino sobre el piso si lo hay; si no, derecho al destino. */
function buscarRuta(desde: Punto, destino: Punto, piezas: PiezasDeEscena): readonly Punto[] {
  const camino = buscarCamino(desde, destino, piezas.caminos);
  if (camino === undefined || !camino.llegaAlDestino) return [destino];
  return camino.puntos;
}

/** Deja al personaje ya parado en su punto, mirando hacia donde caminaba: es como queda al terminar la caminata. */
export function colocarEnEscena(caminata: CaminataPorHacer, piezas: PiezasDeEscena): void {
  const destino = piezas.puntos[caminata.punto]!; // la validación garantiza que el punto existe
  piezas.reparto.mirarHacia(caminata.personaje, destino);
  piezas.reparto.mover(caminata.personaje, destino);
}

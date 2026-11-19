// Guarda las funciones que el host registró con `juego.on(...)` y las llama cuando el motor emite un evento.
//
// Si una de esas funciones lanza un error, el error se muestra en la consola y el motor sigue:
// un descuido del host al escuchar un evento no debe dejar una cinemática o un diálogo a medias.

import type { EventosDeJuego, NombreDeEvento } from './juego.ts';

/** La función que el host registra para un evento: recibe el dato de ese evento. */
type Oyente<Evento extends NombreDeEvento> = (dato: EventosDeJuego[Evento]) => void;

// Este tipo dice: «por cada evento, un conjunto de oyentes de ESE evento». Está escrito como tipo calculado
// (y no a mano, evento por evento) porque es la única forma de que TypeScript compruebe que un oyente
// de `guardar` nunca termine en la lista de `objetivo`. No hace falta entenderlo para usar la clase.
type OyentesPorEvento = { [Evento in NombreDeEvento]: Set<Oyente<Evento>> };

export class EmisorDeEventos {
  private readonly oyentes: OyentesPorEvento = {
    guardar: new Set(),
    objetivo: new Set(),
    palabra: new Set(),
    nivel: new Set(),
    cinematica: new Set(),
    salida: new Set(),
    error: new Set(),
  };

  /** Registra una función para un evento. Devuelve una función que cancela el registro. */
  on<Evento extends NombreDeEvento>(evento: Evento, funcion: Oyente<Evento>): () => void {
    this.oyentes[evento].add(funcion);
    return () => {
      this.oyentes[evento].delete(funcion);
    };
  }

  emitir<Evento extends NombreDeEvento>(evento: Evento, dato: EventosDeJuego[Evento]): void {
    // Se recorre una copia porque una función puede cancelar su registro mientras se la llama.
    for (const funcion of [...this.oyentes[evento]]) {
      try {
        funcion(dato);
      } catch (error) {
        console.error(`[escenario-engine] una función que escucha el evento "${evento}" lanzó un error:`, error);
      }
    }
  }

  /** Olvida todas las funciones registradas. */
  vaciar(): void {
    this.oyentes.guardar.clear();
    this.oyentes.objetivo.clear();
    this.oyentes.palabra.clear();
    this.oyentes.nivel.clear();
    this.oyentes.cinematica.clear();
    this.oyentes.salida.clear();
    this.oyentes.error.clear();
  }
}

// Guarda las funciones que el host registró con `juego.on(...)` y las llama cuando el motor emite un evento.

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
    for (const funcion of this.oyentes[evento]) {
      funcion(dato);
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

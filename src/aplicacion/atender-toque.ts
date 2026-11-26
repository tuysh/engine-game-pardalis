// Decide qué pasa cuando el jugador toca algo del escenario:
//   - el piso: su personaje camina hasta ahí (si es la salida, intentará salir en cuanto esté dentro);
//   - un personaje: camina hasta quedar junto a él y le habla;
//   - un objeto interactivo del decorado: camina hasta quedar frente a él y lo usa.
//
// El acompañante cede el toque: como camina junto al jugador, muchas veces queda entre la cámara y lo que el
// jugador quiere tocar. Si se toca al acompañante y detrás de él hay otro personaje u objeto, el toque es para
// ese. Tocarlo a él solo (con el piso detrás) sigue siendo hablar con él.
//
// Mientras hay un diálogo en curso, los toques al escenario no hacen nada.

import type { Punto } from '../dominio/geometria.ts';
import { lugarParaHablarCon, lugarParaUsar } from '../dominio/lugar-para-hablar.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Toque } from '../puertos/escenario.ts';
import type { Conversacion } from './conversacion.ts';
import type { Exploracion } from './exploracion.ts';
import type { Reparto } from './reparto.ts';
import type { SalidaDelNivel } from './salida-del-nivel.ts';

export interface PiezasParaAtenderToques {
  readonly nivel: Nivel;
  readonly reparto: Reparto;
  readonly conversacion: Conversacion;
  readonly salida: SalidaDelNivel;
  /** El control del jugador. `undefined` en un nivel sin jugador. */
  readonly exploracion: Exploracion | undefined;
  /** Quien acompaña al jugador, si alguien lo acompaña. Lo que importa es su `id`, que puede cambiar a media aventura. */
  readonly acompanante?: { readonly id: string | undefined };
}

export function atenderToque(toqueRecibido: Toque, piezas: PiezasParaAtenderToques): void {
  if (piezas.conversacion.hayDialogoEnCurso) return;

  const toque = elegirLoQueSeQuisoTocar(toqueRecibido, piezas.acompanante?.id);
  switch (toque.tipo) {
    case 'piso':
      atenderToqueAlPiso(toque.punto, piezas);
      break;
    case 'personaje':
      atenderToqueAPersonaje(toque.id, piezas);
      break;
    case 'decorado':
      atenderToqueADecorado(toque.id, piezas);
      break;
  }
}

/** Si se tocó al acompañante y detrás había otra cosa tocable, el toque es para esa otra cosa. */
export function elegirLoQueSeQuisoTocar(toque: Toque, idDelAcompanante: string | undefined): Toque {
  if (toque.tipo !== 'personaje' || toque.detras === undefined) return toque;
  if (toque.id !== idDelAcompanante) return toque;
  return toque.detras;
}

function atenderToqueAlPiso(punto: Punto, piezas: PiezasParaAtenderToques): void {
  if (piezas.exploracion === undefined) return;

  if (piezas.salida.contiene(punto)) {
    piezas.salida.pedirSalir();
  } else {
    piezas.salida.olvidarPedido();
  }
  piezas.exploracion.irA(punto);
}

function atenderToqueAPersonaje(id: string, piezas: PiezasParaAtenderToques): void {
  const posicionDelPersonaje = piezas.reparto.posicionDe(id);
  if (posicionDelPersonaje === undefined) return;

  const hablar = (): void => {
    voltearAlJugadorHacia(posicionDelPersonaje, piezas);
    // `hablarCon` nunca rechaza: si el diálogo falla, la conversación avisa por su cuenta.
    void piezas.conversacion.hablarCon('npcs', id);
  };
  if (piezas.exploracion === undefined) {
    hablar();
    return;
  }
  piezas.exploracion.irA(lugarParaHablarCon(posicionDelPersonaje, piezas.exploracion.posicion), hablar);
}

function atenderToqueADecorado(id: string, piezas: PiezasParaAtenderToques): void {
  const objeto = piezas.nivel.mundo.decorado.find((candidato) => candidato.id === id);
  if (objeto === undefined) return;

  const usar = (): void => {
    void piezas.conversacion.hablarCon('interactivos', id);
  };
  if (piezas.exploracion === undefined) {
    usar();
    return;
  }
  piezas.exploracion.irA(lugarParaUsar(objeto.huella), usar);
}

function voltearAlJugadorHacia(punto: Punto, piezas: PiezasParaAtenderToques): void {
  const jugador = piezas.nivel.contenido.jugador;
  if (jugador !== undefined) {
    piezas.reparto.mirarHacia(jugador.personaje, punto);
  }
}

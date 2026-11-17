// Decide qué pasa cuando el jugador toca algo del escenario:
//   - el piso: su personaje camina hasta ahí (y si es la salida, al llegar intenta salir);
//   - un personaje: camina hasta quedar junto a él y le habla;
//   - un objeto interactivo del decorado: camina hasta quedar frente a él y lo usa.
//
// Mientras hay un diálogo en curso, los toques al escenario no hacen nada.

import { cumpleCondicion } from '../dominio/condicion.ts';
import { puntoDentroDeForma } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import { lugarParaHablarCon, lugarParaUsar } from '../dominio/lugar-para-hablar.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Toque } from '../puertos/escenario.ts';
import type { Conversacion } from './conversacion.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';
import type { Exploracion } from './exploracion.ts';
import type { Reparto } from './reparto.ts';

export interface PiezasParaAtenderToques {
  readonly nivel: Nivel;
  readonly reparto: Reparto;
  readonly conversacion: Conversacion;
  readonly estado: EstadoEnJuego;
  /** El control del jugador. `undefined` en un nivel sin jugador. */
  readonly exploracion: Exploracion | undefined;
  /** Se llama cuando el jugador sale del nivel, con el destino de la salida. */
  readonly alSalir: (destino: string) => void;
}

export function atenderToque(toque: Toque, piezas: PiezasParaAtenderToques): void {
  if (piezas.conversacion.hayDialogoEnCurso) return;

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

function atenderToqueAlPiso(punto: Punto, piezas: PiezasParaAtenderToques): void {
  if (piezas.exploracion === undefined) return;

  const salida = piezas.nivel.mundo.salida;
  const tocoLaSalida = salida !== undefined && puntoDentroDeForma(punto, salida.forma);
  if (tocoLaSalida) {
    piezas.exploracion.irA(punto, () => intentarSalir(piezas));
    return;
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

/** Sale del nivel si ya se cumple lo que la salida requiere; si no, ejecuta los pasos de la salida bloqueada. */
function intentarSalir(piezas: PiezasParaAtenderToques): void {
  const salida = piezas.nivel.contenido.salida;
  if (salida === undefined) return;

  const sePuedeSalir = salida.requiere === undefined || cumpleCondicion(salida.requiere, piezas.estado.actual);
  if (sePuedeSalir) {
    piezas.alSalir(salida.destino);
    return;
  }
  if (salida.siBloqueada !== undefined) {
    void piezas.conversacion.ejecutar(salida.siBloqueada);
  }
}

function voltearAlJugadorHacia(punto: Punto, piezas: PiezasParaAtenderToques): void {
  const jugador = piezas.nivel.contenido.jugador;
  if (jugador !== undefined) {
    piezas.reparto.mirarHacia(jugador.personaje, punto);
  }
}

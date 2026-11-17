// La salida del nivel: el área del mapa por donde el jugador termina el nivel.
//
// El jugador intenta salir cuando ENTRA al área (caminando con el teclado o porque tocó un lugar de ella)
// o cuando la toca estando ya dentro. Al intentar:
//   - si se cumple lo que la salida requiere, el nivel avisa del destino;
//   - si no, se ejecutan los pasos de `siBloqueada` (por ejemplo, alguien dice qué falta).

import { cumpleCondicion } from '../dominio/condicion.ts';
import { puntoDentroDeForma } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Conversacion } from './conversacion.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

export interface PiezasDeLaSalida {
  readonly nivel: Nivel;
  readonly estado: EstadoEnJuego;
  readonly conversacion: Conversacion;
  /** Se llama cuando el jugador sale del nivel, con el destino de la salida. */
  readonly alSalir: (destino: string) => void;
}

export class SalidaDelNivel {
  private readonly piezas: PiezasDeLaSalida;
  private elJugadorEstabaDentro = false;
  /** `true` desde que el jugador toca la salida hasta que se atiende ese toque. */
  private elJugadorPidioSalir = false;

  constructor(piezas: PiezasDeLaSalida) {
    this.piezas = piezas;
  }

  /** Dice si un punto del piso está dentro del área de la salida. */
  contiene(punto: Punto): boolean {
    const salidaDelMapa = this.piezas.nivel.mundo.salida;
    return salidaDelMapa !== undefined && puntoDentroDeForma(punto, salidaDelMapa.forma);
  }

  /** El jugador tocó la salida: en cuanto esté dentro de ella, intentará salir. */
  pedirSalir(): void {
    this.elJugadorPidioSalir = true;
  }

  /** El jugador tocó otro lugar: ya no quiere salir. */
  olvidarPedido(): void {
    this.elJugadorPidioSalir = false;
  }

  /** Se llama en cada cuadro con la posición del jugador. */
  vigilar(posicionDelJugador: Punto): void {
    const estaDentro = this.contiene(posicionDelJugador);
    const acabaDeEntrar = estaDentro && !this.elJugadorEstabaDentro;
    this.elJugadorEstabaDentro = estaDentro;
    if (!estaDentro) return;

    if (acabaDeEntrar || this.elJugadorPidioSalir) {
      this.elJugadorPidioSalir = false;
      this.intentarSalir();
    }
  }

  private intentarSalir(): void {
    const salida = this.piezas.nivel.contenido.salida;
    // Un mapa con salida pero sin la sección `salida` en el contenido no hace nada (la validación lo advierte).
    if (salida === undefined || this.piezas.conversacion.hayDialogoEnCurso) return;

    const sePuedeSalir = salida.requiere === undefined || cumpleCondicion(salida.requiere, this.piezas.estado.actual);
    if (sePuedeSalir) {
      this.piezas.alSalir(salida.destino);
      return;
    }
    if (salida.siBloqueada !== undefined) {
      // `ejecutar` nunca rechaza: si el diálogo falla, la conversación avisa por su cuenta.
      void this.piezas.conversacion.ejecutar(salida.siBloqueada);
    }
  }
}

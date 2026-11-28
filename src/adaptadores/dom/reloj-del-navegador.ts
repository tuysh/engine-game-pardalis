// El reloj del juego en el navegador. El tiempo de juego avanza con cada cuadro que el navegador
// dibuja (`requestAnimationFrame`), así que se detiene solo cuando la pestaña no se ve,
// y se puede pausar a propósito.
//
// No tiene pruebas automáticas porque necesita un navegador; se verifica a mano en la demo.

import type { Reloj } from '../../puertos/reloj.ts';

/**
 * Lo más que puede durar un cuadro para el juego. Al volver a una pestaña que estuvo oculta,
 * el navegador entrega un cuadro «de varios minutos»; sin este tope, todo daría un salto.
 */
const DURACION_MAXIMA_DE_UN_CUADRO_EN_SEGUNDOS = 0.1;

const MILISEGUNDOS_POR_SEGUNDO = 1000;

interface EsperaPendiente {
  readonly venceEnSegundos: number;
  readonly terminar: () => void;
}

export class RelojDelNavegador implements Reloj {
  private ahoraEnSegundos = 0;
  private esperasPendientes: EsperaPendiente[] = [];
  private funcionesDeCadaCuadro: ((segundos: number) => void)[] = [];
  private funcionesDePausa: ((estaPausado: boolean) => void)[] = [];
  /** Momento, según el navegador, en que llegó el cuadro anterior. `undefined` = todavía no llega ninguno. */
  private momentoDelCuadroAnteriorEnMilisegundos: number | undefined;
  /** Identificador del cuadro pedido al navegador, para poder cancelarlo. */
  private cuadroPedido: number | undefined;
  private pausado = false;

  esperar(esperaEnSegundos: number, senal: AbortSignal): Promise<void> {
    if (senal.aborted || esperaEnSegundos <= 0) {
      return Promise.resolve();
    }
    this.pedirSiguienteCuadro();

    return new Promise((terminarPromesa) => {
      const alCancelar = (): void => {
        this.quitarEspera(espera);
        terminarPromesa();
      };
      const espera: EsperaPendiente = {
        venceEnSegundos: this.ahoraEnSegundos + esperaEnSegundos,
        terminar: () => {
          senal.removeEventListener('abort', alCancelar);
          terminarPromesa();
        },
      };
      this.esperasPendientes.push(espera);
      senal.addEventListener('abort', alCancelar, { once: true });
    });
  }

  enCadaCuadro(funcion: (segundos: number) => void): () => void {
    this.funcionesDeCadaCuadro.push(funcion);
    this.pedirSiguienteCuadro();
    return () => {
      this.funcionesDeCadaCuadro = this.funcionesDeCadaCuadro.filter((registrada) => registrada !== funcion);
    };
  }

  get estaPausado(): boolean {
    return this.pausado;
  }

  alPausarOReanudar(funcion: (estaPausado: boolean) => void): () => void {
    this.funcionesDePausa.push(funcion);
    return () => {
      this.funcionesDePausa = this.funcionesDePausa.filter((registrada) => registrada !== funcion);
    };
  }

  /** Congela el tiempo de juego: no avanzan las esperas ni se llama a las funciones de cada cuadro. */
  pausar(): void {
    if (this.pausado) return;
    this.pausado = true;
    this.avisarDeLaPausa();
  }

  reanudar(): void {
    if (!this.pausado) return;
    this.pausado = false;
    // Se olvida el cuadro anterior para que el tiempo que duró la pausa no cuente como tiempo de juego.
    this.momentoDelCuadroAnteriorEnMilisegundos = undefined;
    this.avisarDeLaPausa();
  }

  /** Detiene el reloj para siempre y termina las esperas pendientes, para que nada quede colgado. */
  detener(): void {
    if (this.cuadroPedido !== undefined) {
      cancelAnimationFrame(this.cuadroPedido);
      this.cuadroPedido = undefined;
    }
    const esperas = this.esperasPendientes;
    this.esperasPendientes = [];
    this.funcionesDeCadaCuadro = [];
    this.funcionesDePausa = [];
    for (const espera of esperas) {
      espera.terminar();
    }
  }

  private pedirSiguienteCuadro(): void {
    if (this.cuadroPedido !== undefined) return;
    this.cuadroPedido = requestAnimationFrame((momento) => this.alLlegarUnCuadro(momento));
  }

  private alLlegarUnCuadro(momentoEnMilisegundos: number): void {
    this.cuadroPedido = undefined;

    const momentoAnterior = this.momentoDelCuadroAnteriorEnMilisegundos;
    this.momentoDelCuadroAnteriorEnMilisegundos = momentoEnMilisegundos;

    if (!this.pausado && momentoAnterior !== undefined) {
      const segundosReales = (momentoEnMilisegundos - momentoAnterior) / MILISEGUNDOS_POR_SEGUNDO;
      const segundos = Math.min(segundosReales, DURACION_MAXIMA_DE_UN_CUADRO_EN_SEGUNDOS);
      this.avanzar(segundos);
    }

    const hayAlgoQueAtender = this.funcionesDeCadaCuadro.length > 0 || this.esperasPendientes.length > 0;
    if (hayAlgoQueAtender) {
      this.pedirSiguienteCuadro();
    } else {
      // Sin nada que atender se dejan de pedir cuadros; al volver a pedirlos, el tiempo no debe dar un salto.
      this.momentoDelCuadroAnteriorEnMilisegundos = undefined;
    }
  }

  private avanzar(segundos: number): void {
    this.ahoraEnSegundos += segundos;

    // Se recorre una copia porque una función puede cancelarse a sí misma mientras se la llama.
    for (const funcion of [...this.funcionesDeCadaCuadro]) {
      funcion(segundos);
    }

    const vencidas = this.esperasPendientes.filter((espera) => espera.venceEnSegundos <= this.ahoraEnSegundos);
    for (const espera of vencidas) {
      this.quitarEspera(espera);
      espera.terminar();
    }
  }

  private avisarDeLaPausa(): void {
    // Se recorre una copia porque quien escucha puede darse de baja mientras se le avisa.
    for (const funcion of [...this.funcionesDePausa]) {
      funcion(this.pausado);
    }
  }

  private quitarEspera(espera: EsperaPendiente): void {
    this.esperasPendientes = this.esperasPendientes.filter((pendiente) => pendiente !== espera);
  }
}

// Reloj falso para las pruebas: el tiempo solo pasa cuando la prueba llama a `avanzar()`.
//
// Uso:
//   const reloj = new RelojDeMemoria();
//   const espera = reloj.esperar(2, senal);
//   await reloj.avanzar(2);   // ahora `espera` ya terminó

import type { Reloj } from '../../puertos/reloj.ts';

/** Margen para que sumar decimales (0.1 + 0.2) no deje una espera sin vencer por un error de redondeo. */
const TOLERANCIA_EN_SEGUNDOS = 0.000_000_001;

interface EsperaPendiente {
  readonly venceEnSegundos: number;
  readonly terminar: () => void;
}

export class RelojDeMemoria implements Reloj {
  private ahoraEnSegundos = 0;
  private esperasPendientes: EsperaPendiente[] = [];

  esperar(esperaEnSegundos: number, senal: AbortSignal): Promise<void> {
    if (senal.aborted || esperaEnSegundos <= 0) {
      return Promise.resolve();
    }
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

  /**
   * Hace pasar el tiempo. Termina las esperas que vencen, en orden, y le da turno al código
   * que estaba esperando; si ese código pide otra espera que también vence, también termina.
   */
  async avanzar(segundos: number): Promise<void> {
    const destinoEnSegundos = this.ahoraEnSegundos + segundos;

    await dejarCorrerLoPendiente();
    let siguiente = this.buscarEsperaQueVenceAntesDe(destinoEnSegundos);
    while (siguiente !== undefined) {
      this.ahoraEnSegundos = siguiente.venceEnSegundos;
      this.quitarEspera(siguiente);
      siguiente.terminar();
      await dejarCorrerLoPendiente();
      siguiente = this.buscarEsperaQueVenceAntesDe(destinoEnSegundos);
    }

    this.ahoraEnSegundos = destinoEnSegundos;
  }

  /** Para comprobar en una prueba que nada quedó esperando. */
  get hayEsperasPendientes(): boolean {
    return this.esperasPendientes.length > 0;
  }

  private buscarEsperaQueVenceAntesDe(limiteEnSegundos: number): EsperaPendiente | undefined {
    let masProxima: EsperaPendiente | undefined;
    for (const espera of this.esperasPendientes) {
      const yaVence = espera.venceEnSegundos <= limiteEnSegundos + TOLERANCIA_EN_SEGUNDOS;
      if (!yaVence) continue;
      if (masProxima === undefined || espera.venceEnSegundos < masProxima.venceEnSegundos) {
        masProxima = espera;
      }
    }
    return masProxima;
  }

  private quitarEspera(espera: EsperaPendiente): void {
    this.esperasPendientes = this.esperasPendientes.filter((pendiente) => pendiente !== espera);
  }
}

/**
 * Le da turno a todo el código que está detenido en un `await`.
 * Usa `setTimeout` de verdad a propósito: es la única forma de ceder el turno por completo,
 * y aquí no mide tiempo de juego (dura 0 milisegundos).
 */
function dejarCorrerLoPendiente(): Promise<void> {
  return new Promise((continuar) => {
    setTimeout(continuar, 0);
  });
}

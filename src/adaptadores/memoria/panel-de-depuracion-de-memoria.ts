// Panel de depuración falso para las pruebas: la prueba da las órdenes y lee el texto que el motor mostró.

import type { GrosorDeFranjas } from '../../dominio/contenido.ts';
import type { OrdenDeDepuracion, PanelDeDepuracion } from '../../puertos/panel-de-depuracion.ts';

export class PanelDeDepuracionDeMemoria implements PanelDeDepuracion {
  /** El texto que está en pantalla. */
  texto = '';
  /** Todo lo que se ha copiado al portapapeles, en orden. */
  readonly textosCopiados: string[] = [];
  /** `true` mientras el motor dice que la cámara libre está activa. */
  laCamaraLibreEstaActiva = false;
  /** El grosor de las franjas que la guía marca ahora. `undefined` = no hay guía. */
  guiaDeFranjas: GrosorDeFranjas | undefined;
  estaDestruido = false;

  private funcionesDeOrden: ((orden: OrdenDeDepuracion) => void)[] = [];

  alRecibirOrden(funcion: (orden: OrdenDeDepuracion) => void): () => void {
    this.funcionesDeOrden.push(funcion);
    return () => {
      this.funcionesDeOrden = this.funcionesDeOrden.filter((registrada) => registrada !== funcion);
    };
  }

  avisarCamaraLibre(estaActiva: boolean): void {
    this.laCamaraLibreEstaActiva = estaActiva;
  }

  mostrarGuiaDeFranjas(grosor: GrosorDeFranjas | undefined): void {
    this.guiaDeFranjas = grosor;
  }

  mostrarTexto(texto: string): void {
    this.texto = texto;
  }

  async copiar(texto: string): Promise<boolean> {
    this.textosCopiados.push(texto);
    return true;
  }

  destruir(): void {
    this.estaDestruido = true;
    this.funcionesDeOrden = [];
  }

  /** Para las pruebas: hace como si quien depura hubiera dado una orden. */
  simularOrden(orden: OrdenDeDepuracion): void {
    for (const funcion of [...this.funcionesDeOrden]) {
      funcion(orden);
    }
  }
}

// La flecha que señala por dónde se sale del nivel. Aparece cuando se cumple `salida.flecha.visibleCuando`
// (o siempre, si la salida no lo dice) y sigue a la salida en la pantalla aunque la cámara se mueva.

import { cumpleCondicion } from '../dominio/condicion.ts';
import { centroDeForma } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

/** A qué altura sobre el piso queda la punta de la flecha: un poco por encima de una persona. */
const ALTURA_DE_LA_FLECHA_EN_METROS = 1.9;

export interface PiezasDeLaFlecha {
  readonly nivel: Nivel;
  readonly estado: EstadoEnJuego;
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
}

export class FlechaDeSalida {
  private readonly piezas: PiezasDeLaFlecha;
  /** El centro de la salida en el plano. `undefined` = el nivel no tiene salida: nunca hay flecha. */
  private readonly centroDeLaSalida: Punto | undefined;
  private estaVisible = false;

  constructor(piezas: PiezasDeLaFlecha) {
    this.piezas = piezas;
    const salidaDelMapa = piezas.nivel.mundo.salida;
    const salidaDelContenido = piezas.nivel.contenido.salida;
    if (salidaDelMapa !== undefined && salidaDelContenido !== undefined) {
      this.centroDeLaSalida = centroDeForma(salidaDelMapa.forma);
    }
  }

  /** Se llama en cada cuadro: muestra u oculta la flecha según el estado y la mantiene sobre la salida. */
  actualizar(): void {
    if (this.centroDeLaSalida === undefined) return;

    const debeVerse = this.debeVerse();
    if (debeVerse && !this.estaVisible) {
      this.piezas.interfaz.mostrarFlecha(this.leerLeyenda());
    }
    if (!debeVerse && this.estaVisible) {
      this.piezas.interfaz.ocultarFlecha();
    }
    this.estaVisible = debeVerse;

    if (debeVerse) {
      const lugar = this.piezas.escenario.lugarEnPantallaDelPunto(this.centroDeLaSalida, ALTURA_DE_LA_FLECHA_EN_METROS);
      this.piezas.interfaz.apuntarFlecha(lugar);
    }
  }

  /** Quita la flecha, por ejemplo al terminar el nivel. */
  ocultar(): void {
    if (this.estaVisible) {
      this.piezas.interfaz.ocultarFlecha();
      this.estaVisible = false;
    }
  }

  private debeVerse(): boolean {
    const salida = this.piezas.nivel.contenido.salida;
    if (salida === undefined) return false;
    if (salida.flecha === undefined || salida.flecha.visibleCuando === undefined) return true;
    return cumpleCondicion(salida.flecha.visibleCuando, this.piezas.estado.actual);
  }

  private leerLeyenda(): string | undefined {
    const salida = this.piezas.nivel.contenido.salida;
    if (salida === undefined || salida.flecha === undefined) return undefined;
    return salida.flecha.texto;
  }
}

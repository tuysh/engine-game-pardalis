// Sabe qué tiene el jugador a la mano (un personaje con quien hablar o un objeto que usar)
// y se lo señala con un aviso encima. Es lo que usa la tecla de hablar para saber con quién.

import { centroDeRectangulo } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import { buscarInteractuableCercano } from '../dominio/interactuable-cercano.ts';
import type { Interactuable } from '../dominio/interactuable-cercano.ts';
import type { Decorado } from '../dominio/mundo.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Escenario, LugarEnPantalla } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { Reparto } from './reparto.ts';

/** A qué altura va el aviso sobre un objeto pintado en el piso, que no tiene altura propia. */
const ALTURA_DEL_AVISO_SOBRE_EL_PISO_EN_METROS = 0.5;

export interface PiezasDeCercania {
  readonly nivel: Nivel;
  readonly reparto: Reparto;
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
  /** Quien acompaña al jugador, si alguien lo acompaña: cede su lugar a cualquier otra cosa que esté a la mano. */
  readonly acompanante?: { readonly id: string | undefined };
}

export class Cercania {
  private readonly piezas: PiezasDeCercania;
  private estaElAvisoEnPantalla = false;

  constructor(piezas: PiezasDeCercania) {
    this.piezas = piezas;
  }

  /** Lo que el jugador tiene a la mano desde esa posición, o `undefined` si no hay nada cerca. */
  buscar(posicionDelJugador: Punto): Interactuable | undefined {
    return buscarInteractuableCercano(posicionDelJugador, this.reunirInteractuables(), this.piezas.acompanante?.id);
  }

  /**
   * Se llama en cada cuadro: pone el aviso sobre lo que el jugador tiene a la mano, o lo quita.
   * Con `sePuedeInteractuar` en `false` (hay un diálogo o una cinemática), el aviso no se muestra.
   */
  actualizar(posicionDelJugador: Punto, sePuedeInteractuar: boolean): void {
    let cercano: Interactuable | undefined;
    if (sePuedeInteractuar) {
      cercano = this.buscar(posicionDelJugador);
    }
    if (cercano === undefined) {
      this.ocultar();
      return;
    }

    const lugar = this.buscarLugarEnPantalla(cercano);
    if (lugar === undefined) {
      this.ocultar();
      return;
    }
    if (!this.estaElAvisoEnPantalla) {
      this.piezas.interfaz.mostrarAviso();
      this.estaElAvisoEnPantalla = true;
    }
    this.piezas.interfaz.apuntarAviso(lugar);
  }

  ocultar(): void {
    if (this.estaElAvisoEnPantalla) {
      this.piezas.interfaz.ocultarAviso();
      this.estaElAvisoEnPantalla = false;
    }
  }

  /** Los personajes con diálogo (donde estén ahora) y los objetos del decorado que se pueden usar. */
  private reunirInteractuables(): Interactuable[] {
    const interactuables: Interactuable[] = [];

    for (const id of Object.keys(this.piezas.nivel.contenido.npcs)) {
      const posicion = this.piezas.reparto.posicionDe(id);
      if (posicion !== undefined) {
        interactuables.push({ tipo: 'personaje', id, punto: posicion });
      }
    }
    for (const objeto of this.piezas.nivel.mundo.decorado) {
      if (objeto.id !== undefined) {
        interactuables.push({ tipo: 'decorado', id: objeto.id, punto: centroDeRectangulo(objeto.huella) });
      }
    }
    return interactuables;
  }

  /** Encima de la cabeza del personaje, o encima del dibujo del objeto. */
  private buscarLugarEnPantalla(interactuable: Interactuable): LugarEnPantalla | undefined {
    if (interactuable.tipo === 'personaje') {
      return this.piezas.escenario.lugarEnPantallaDe(interactuable.id);
    }
    const objeto = this.piezas.nivel.mundo.decorado.find((candidato) => candidato.id === interactuable.id);
    if (objeto === undefined) return undefined;
    return this.piezas.escenario.lugarEnPantallaDelPunto(interactuable.punto, this.calcularAlturaDe(objeto));
  }

  /** Hasta dónde llega el dibujo de un objeto, en metros sobre el piso. */
  private calcularAlturaDe(objeto: Decorado): number {
    if (objeto.clase === 'plano') return ALTURA_DEL_AVISO_SOBRE_EL_PISO_EN_METROS;

    const asset = this.piezas.nivel.assets[objeto.asset]!.asset; // la validación garantiza que la imagen existe
    let altoDelDibujoEnMetros = 0;
    if (asset.tipo === 'imagen' || asset.tipo === 'animacion') {
      altoDelDibujoEnMetros = asset.altoEnPixeles / this.piezas.nivel.contenido.mundo.pixelesPorMetro;
    }
    if (objeto.clase === 'colgado') return objeto.alturaEnMetros + altoDelDibujoEnMetros;
    return altoDelDibujoEnMetros;
  }
}

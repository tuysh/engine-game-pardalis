// Los objetos del decorado que ya están en el escenario, en el orden de `Escenografia.decorado`:
// los que se tocan, los que se animan solos, los que se esconden según el estado (`visibleCuando`)
// y los que cambian de dibujo con un paso `anima`.
//
// Las piezas viven dentro del grupo de la escenografía (escenario-de-three.ts), que es quien las libera al
// montar otro lugar; aquí solo se lleva la cuenta de cada una por su lugar en la lista.

import type { Group, Mesh, Object3D } from 'three';
import type { DecoradoDeEscena, ImagenDeEscena, Toque } from '../../puertos/escenario.ts';
import type { AlmacenDeTexturas } from './almacen-de-texturas.ts';
import type { AnimacionesDeHojas } from './animaciones-de-hojas.ts';
import type { DecoradoListo } from './armar-escenografia.ts';
import { crearPiezaDeDecorado, liberarPieza } from './piezas-de-papel.ts';

/** Lo que el decorado comparte con el resto del escenario. */
export interface PiezasDelDecorado {
  /** El grupo de la escenografía, donde van las piezas. */
  readonly grupo: Group;
  readonly almacen: AlmacenDeTexturas;
  readonly animaciones: AnimacionesDeHojas;
  /** Los objetos que responden al toque, con el toque que les corresponde. */
  readonly tocables: Map<Object3D, Toque>;
}

/** Un objeto del decorado puesto en el escenario. */
interface ObjetoPuesto {
  readonly objeto: DecoradoDeEscena;
  pieza: Mesh;
  esVisible: boolean;
  /** Cambia con cada `ponerDibujo`: un dibujo que terminó de cargar tarde, si ya se pidió otro, no se pone. */
  cambiosDeDibujoPedidos: number;
}

/** Las piezas del decorado de un lugar, por su lugar en la lista: las esconde, las muestra y les cambia el dibujo. */
export class DecoradoDePapel {
  private readonly piezas: PiezasDelDecorado;
  private objetos: ObjetoPuesto[] = [];

  constructor(piezas: PiezasDelDecorado) {
    this.piezas = piezas;
  }

  /** Pone en el escenario los objetos de un lugar nuevo. Los del lugar anterior ya se quitaron con el grupo. */
  poner(decorado: readonly DecoradoListo[]): void {
    this.objetos = [];
    for (const { objeto, texturas, pieza } of decorado) {
      this.piezas.grupo.add(pieza);
      this.objetos.push({ objeto, pieza, esVisible: true, cambiosDeDibujoPedidos: 0 });
      this.hacerTocable(objeto, pieza);
      // Un objeto cuyo dibujo es una animación la repite sin parar (una bandera, un foco que parpadea).
      this.piezas.animaciones.animar(pieza, texturas, { cuadrosPorSegundo: objeto.imagen.cuadrosPorSegundo, repite: true });
    }
  }

  /** Muestra u oculta el objeto de ese lugar de la lista. Uno oculto no se puede tocar. */
  cambiarVisibilidad(indice: number, esVisible: boolean): void {
    const puesto = this.objetos[indice];
    if (puesto === undefined) return;
    puesto.esVisible = esVisible;
    puesto.pieza.visible = esVisible;
    // La línea imaginaria que busca qué se tocó choca también con lo invisible: por eso se quita de los tocables.
    if (esVisible) {
      this.hacerTocable(puesto.objeto, puesto.pieza);
    } else {
      this.piezas.tocables.delete(puesto.pieza);
    }
  }

  /**
   * Cambia el dibujo del objeto de ese lugar de la lista por otra imagen o animación, en la misma huella.
   * Una animación empieza en su primer cuadro; con `repite` vuelve a empezar y, sin él, se queda en el último.
   */
  async ponerDibujo(indice: number, imagen: ImagenDeEscena, opciones: { readonly repite: boolean }): Promise<void> {
    const puestoAlPedirlo = this.objetos[indice];
    if (puestoAlPedirlo === undefined) return;
    puestoAlPedirlo.cambiosDeDibujoPedidos++;
    const cambioPedido = puestoAlPedirlo.cambiosDeDibujoPedidos;

    const texturas = await this.piezas.almacen.cargar(imagen);
    // Mientras cargaba, pudo montarse otro lugar o pedirse otro dibujo más nuevo.
    if (this.objetos[indice] !== puestoAlPedirlo || puestoAlPedirlo.cambiosDeDibujoPedidos !== cambioPedido) return;

    // El dibujo nuevo puede medir distinto, así que se cambia la pieza completa y no solo su textura.
    const piezaNueva = crearPiezaDeDecorado({ ...puestoAlPedirlo.objeto, imagen }, texturas[0]!); // al menos un cuadro
    piezaNueva.visible = puestoAlPedirlo.esVisible;
    const piezaVieja = puestoAlPedirlo.pieza;
    this.piezas.tocables.delete(piezaVieja);
    this.piezas.animaciones.olvidar(piezaVieja);
    this.piezas.grupo.remove(piezaVieja);
    liberarPieza(piezaVieja);

    puestoAlPedirlo.pieza = piezaNueva;
    this.piezas.grupo.add(piezaNueva);
    if (puestoAlPedirlo.esVisible) {
      this.hacerTocable(puestoAlPedirlo.objeto, piezaNueva);
    }
    this.piezas.animaciones.animar(piezaNueva, texturas, { cuadrosPorSegundo: imagen.cuadrosPorSegundo, ...opciones });
  }

  /** Olvida los objetos: el grupo de la escenografía ya los quitó y liberó. */
  olvidarTodos(): void {
    this.objetos = [];
  }

  private hacerTocable(objeto: DecoradoDeEscena, pieza: Mesh): void {
    if (objeto.id !== undefined) {
      this.piezas.tocables.set(pieza, { tipo: 'decorado', id: objeto.id });
    }
  }
}

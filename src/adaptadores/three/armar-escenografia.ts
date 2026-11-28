// Convierte la escenografía de un nivel en las piezas de papel que la dibujan: el suelo, los telones y el decorado.
// Aquí solo se crean, con sus texturas ya cargadas; ponerlas en la escena es cosa de escenario-de-three.ts.

import type { Mesh, Object3D, Texture } from 'three';
import type { DecoradoDeEscena, Escenografia } from '../../puertos/escenario.ts';
import type { AlmacenDeTexturas } from './almacen-de-texturas.ts';
import {
  crearHojaAcostada,
  crearPiezaDeDecorado,
  crearTelon,
  ORDEN_DE_LO_PINTADO_EN_EL_PISO,
  ORDEN_DEL_PISO,
  ordenDeLoPintadoEnElPiso,
} from './piezas-de-papel.ts';

/** Un objeto del decorado ya con sus texturas y su pieza, listo para ponerse en el escenario. */
export interface DecoradoListo {
  readonly objeto: DecoradoDeEscena;
  /** Una textura por cuadro: más de una si el dibujo del objeto es una animación. */
  readonly texturas: readonly Texture[];
  readonly pieza: Mesh;
}

/** La escenografía ya convertida en piezas. */
export interface EscenografiaLista {
  /** El suelo y los telones: ni se tocan ni se animan. */
  readonly fondo: readonly Object3D[];
  readonly decorado: readonly DecoradoListo[];
}

/** La promesa termina cuando todas las imágenes de la escenografía ya cargaron. */
export async function armarEscenografia(
  escenografia: Escenografia,
  almacen: AlmacenDeTexturas,
): Promise<EscenografiaLista> {
  const fondo: Object3D[] = [];
  if (escenografia.suelo !== undefined) {
    const { imagen, esquina } = escenografia.suelo;
    const texturas = await almacen.cargar(imagen);
    const rectangulo = { x: esquina.x, y: esquina.y, ancho: imagen.anchoEnMetros, alto: imagen.altoEnMetros };
    fondo.push(crearHojaAcostada(primerCuadroDe(texturas), rectangulo, ORDEN_DEL_PISO));
  }
  for (const telon of escenografia.telones) {
    const texturas = await almacen.cargar(telon.imagen);
    fondo.push(crearTelon(primerCuadroDe(texturas), telon));
  }

  // Lo pintado en el piso se encima en el orden del mapa: el que va después en la capa queda arriba.
  let cantidadDePintados = 0;
  for (const objeto of escenografia.decorado) {
    if (objeto.clase === 'plano') {
      cantidadDePintados++;
    }
  }
  let pintadosAntes = 0;
  const decorado: DecoradoListo[] = [];
  for (const objeto of escenografia.decorado) {
    const texturas = await almacen.cargar(objeto.imagen);
    // Solo cuenta para lo pintado en el piso; lo parado y lo colgado tienen su propio orden.
    let orden = ORDEN_DE_LO_PINTADO_EN_EL_PISO;
    if (objeto.clase === 'plano') {
      orden = ordenDeLoPintadoEnElPiso(pintadosAntes, cantidadDePintados);
      pintadosAntes++;
    }
    decorado.push({ objeto, texturas, pieza: crearPiezaDeDecorado(objeto, primerCuadroDe(texturas), orden) });
  }
  return { fondo, decorado };
}

function primerCuadroDe(texturas: readonly Texture[]): Texture {
  return texturas[0]!; // una imagen tiene al menos un cuadro
}

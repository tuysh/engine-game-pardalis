// Lo que comparten los archivos que convierten cada capa del mapa: la escala de píxeles a metros,
// dónde anotar los problemas, y cómo leer las propiedades de un objeto de Tiled.

import type { Diagnostico } from '../../dominio/diagnostico.ts';
import type { Forma } from '../../dominio/forma.ts';
import type { Punto, Rectangulo } from '../../dominio/geometria.ts';
import type { Mira } from '../../dominio/mundo.ts';
import type { CapaDeTiled, ObjetoDeTiled } from './mapa-de-tiled.ts';

export interface Conversion {
  readonly pixelesPorMetro: number;
  readonly diagnostico: Diagnostico;
}

const VERTICES_MINIMOS_DE_UN_POLIGONO = 3;

export function aMetros(valorEnPixeles: number, conversion: Conversion): number {
  return valorEnPixeles / conversion.pixelesPorMetro;
}

export function puntoEnMetros(puntoEnPixeles: Punto, conversion: Conversion): Punto {
  return { x: aMetros(puntoEnPixeles.x, conversion), y: aMetros(puntoEnPixeles.y, conversion) };
}

/** La posición de un objeto como un solo punto: el punto mismo, o el centro si es una figura con tamaño. */
export function posicionEnMetros(objeto: ObjetoDeTiled, conversion: Conversion): Punto {
  const centroEnPixeles = {
    x: objeto.xEnPixeles + objeto.anchoEnPixeles / 2,
    y: objeto.yEnPixeles + objeto.altoEnPixeles / 2,
  };
  return puntoEnMetros(centroEnPixeles, conversion);
}

export function rectanguloEnMetros(objeto: ObjetoDeTiled, conversion: Conversion): Rectangulo {
  return {
    x: aMetros(objeto.xEnPixeles, conversion),
    y: aMetros(objeto.yEnPixeles, conversion),
    ancho: aMetros(objeto.anchoEnPixeles, conversion),
    alto: aMetros(objeto.altoEnPixeles, conversion),
  };
}

/** Los vértices de un polígono en metros, o `undefined` si el objeto no es un polígono de 3 o más vértices. */
export function poligonoEnMetros(objeto: ObjetoDeTiled, conversion: Conversion): Punto[] | undefined {
  if (objeto.figura !== 'poligono') return undefined;
  if (objeto.verticesEnPixeles.length < VERTICES_MINIMOS_DE_UN_POLIGONO) return undefined;
  return objeto.verticesEnPixeles.map((vertice) => puntoEnMetros(vertice, conversion));
}

/** La forma de un área (zona, salida): un rectángulo o un polígono. `undefined` si es otra figura. */
export function formaEnMetros(objeto: ObjetoDeTiled, conversion: Conversion): Forma | undefined {
  if (objeto.figura === 'rectangulo') {
    return { tipo: 'rectangulo', rectangulo: rectanguloEnMetros(objeto, conversion) };
  }
  const vertices = poligonoEnMetros(objeto, conversion);
  if (vertices === undefined) return undefined;
  return { tipo: 'poligono', vertices };
}

/** Anota un error que nombra el objeto y su capa. */
export function anotarError(objeto: ObjetoDeTiled, capa: CapaDeTiled, problema: string, conversion: Conversion): void {
  conversion.diagnostico.errores.push(`mapa: ${objeto.descripcion} de la capa "${capa.nombre}": ${problema}`);
}

/** El texto de una propiedad, o `undefined` si falta, está vacía o no es un texto. */
export function textoDePropiedad(propiedades: Readonly<Record<string, unknown>>, nombre: string): string | undefined {
  if (!Object.hasOwn(propiedades, nombre)) return undefined;
  const valor = propiedades[nombre];
  if (typeof valor !== 'string' || valor === '') return undefined;
  return valor;
}

/** El número de una propiedad, o `undefined` si falta o no es un número. */
export function numeroDePropiedad(propiedades: Readonly<Record<string, unknown>>, nombre: string): number | undefined {
  if (!Object.hasOwn(propiedades, nombre)) return undefined;
  const valor = propiedades[nombre];
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return undefined;
  return valor;
}

/**
 * Hacia dónde mira un personaje según la propiedad `mira`. Si falta, mira a la derecha.
 * Si trae otro valor, anota el error y también mira a la derecha.
 */
export function leerMira(objeto: ObjetoDeTiled, capa: CapaDeTiled, conversion: Conversion): Mira {
  if (!Object.hasOwn(objeto.propiedades, 'mira')) return 'derecha';

  const valor = objeto.propiedades['mira'];
  if (valor === 'izquierda' || valor === 'derecha') return valor;

  anotarError(objeto, capa, 'la propiedad "mira" debe ser "izquierda" o "derecha"', conversion);
  return 'derecha';
}

/** Comprueba que la capa sea de objetos. Si no lo es, anota el error. */
export function esCapaDeObjetos(capa: CapaDeTiled, conversion: Conversion): boolean {
  if (capa.tipo === 'objectgroup') return true;
  conversion.diagnostico.errores.push(`mapa: la capa "${capa.nombre}" debe ser una capa de objetos`);
  return false;
}

// Las piezas con las que se arma el escenario de papel: hojas paradas, hojas acostadas sobre el piso y sombras.
//
// Cómo se pasa del plano del lugar al espacio 3D de Three.js:
//   plano (visto desde arriba)    espacio 3D
//   x  (izquierda–derecha)    →   x
//   y  (profundidad)          →   z   (más grande = más cerca de la cámara)
//   altura                    →   y   (0 = el piso)
//
// Nada lleva luces: todo usa `MeshBasicMaterial`, que muestra la imagen con sus colores tal cual.
// Las texturas no son de las piezas: son del almacén (almacen-de-texturas.ts), que es quien las libera.

import { CircleGeometry, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { Object3D, Texture } from 'three';
import { centroDeRectangulo } from '../../dominio/forma.ts';
import type { Punto, Rectangulo } from '../../dominio/geometria.ts';
import type { DecoradoDeEscena } from '../../puertos/escenario.ts';

/**
 * Orden en que se dibujan las piezas. Lo que está pegado al piso va siempre antes que lo que está parado;
 * si no, una flecha pintada en el piso podría dibujarse encima de los pies de un personaje.
 */
export const ORDEN_DEL_PISO = 0;
export const ORDEN_DE_LO_PINTADO_EN_EL_PISO = 1;
export const ORDEN_DE_LAS_SOMBRAS = 2;
export const ORDEN_DE_LO_PARADO = 3;

/** Cuánto se levanta del piso lo que va pintado sobre él, para que no parpadee al quedar en el mismo plano. */
const SEPARACION_DEL_PISO_EN_METROS = 0.01;

const UN_CUARTO_DE_VUELTA = Math.PI / 2;

/** Qué tan oscura es la sombra de un personaje: 0 = invisible, 1 = negra. */
const OPACIDAD_DE_LA_SOMBRA = 0.22;
/** La sombra es un óvalo: este es su fondo como proporción de su ancho. */
const PROPORCION_DE_FONDO_DE_LA_SOMBRA = 0.4;
/** Ancho de la sombra como proporción del ancho del personaje. */
const PROPORCION_DE_ANCHO_DE_LA_SOMBRA = 0.8;
const LADOS_DEL_CIRCULO_DE_LA_SOMBRA = 24;

/** Tamaño de una hoja, en metros. */
export interface TamanoDeHoja {
  readonly anchoEnMetros: number;
  readonly altoEnMetros: number;
}

/**
 * Una hoja de papel parada, vista de frente desde la cámara.
 * Su origen queda en el centro de su borde inferior: al ponerla en un punto, ahí «pisa».
 */
export function crearHojaParada(textura: Texture, tamano: TamanoDeHoja): Mesh {
  const geometria = new PlaneGeometry(tamano.anchoEnMetros, tamano.altoEnMetros);
  geometria.translate(0, tamano.altoEnMetros / 2, 0);

  const material = new MeshBasicMaterial({
    map: textura,
    transparent: true,
    // Las hojas no tapan a las de atrás por profundidad: se dibujan de la más lejana a la más cercana.
    depthWrite: false,
    // Se ve por los dos lados: así se puede voltear a un personaje como se voltea un papel.
    side: DoubleSide,
  });
  const hoja = new Mesh(geometria, material);
  hoja.renderOrder = ORDEN_DE_LO_PARADO;
  return hoja;
}

/** Una hoja acostada sobre el piso que cubre exactamente un rectángulo del plano. */
export function crearHojaAcostada(textura: Texture, rectangulo: Rectangulo, orden: number): Mesh {
  const geometria = new PlaneGeometry(rectangulo.ancho, rectangulo.alto);
  const esElPiso = orden === ORDEN_DEL_PISO;
  const material = new MeshBasicMaterial({ map: textura, transparent: !esElPiso, depthWrite: esElPiso });

  const hoja = new Mesh(geometria, material);
  // Una hoja nace parada; con un cuarto de vuelta queda acostada, con el borde de arriba hacia el fondo.
  hoja.rotation.x = -UN_CUARTO_DE_VUELTA;
  let altura = 0;
  if (!esElPiso) {
    altura = SEPARACION_DEL_PISO_EN_METROS;
  }
  hoja.position.set(rectangulo.x + rectangulo.ancho / 2, altura, rectangulo.y + rectangulo.alto / 2);
  hoja.renderOrder = orden;
  return hoja;
}

/** Por dónde pasa un telón en el plano y cuánto mide de alto. */
export interface LineaDeTelon {
  readonly desde: Punto;
  readonly hasta: Punto;
  readonly altoEnMetros: number;
}

/** Una hoja parada que va de un punto a otro del plano, como una fachada. Tapa lo que queda detrás. */
export function crearTelon(textura: Texture, linea: LineaDeTelon): Mesh {
  const { desde, hasta, altoEnMetros } = linea;
  const largoEnX = hasta.x - desde.x;
  const largoEnZ = hasta.y - desde.y;
  const anchoEnMetros = Math.hypot(largoEnX, largoEnZ);

  const geometria = new PlaneGeometry(anchoEnMetros, altoEnMetros);
  const material = new MeshBasicMaterial({ map: textura, side: DoubleSide });
  const telon = new Mesh(geometria, material);

  const centroEnX = (desde.x + hasta.x) / 2;
  const centroEnZ = (desde.y + hasta.y) / 2;
  telon.position.set(centroEnX, altoEnMetros / 2, centroEnZ);
  // Se gira para que la hoja siga la dirección de la línea dibujada en el mapa.
  telon.rotation.y = -Math.atan2(largoEnZ, largoEnX);
  telon.renderOrder = ORDEN_DEL_PISO;
  return telon;
}

/** La pieza de un objeto del decorado, según su clase: pintada en el piso, parada o colgada en lo alto. */
export function crearPiezaDeDecorado(objeto: DecoradoDeEscena, textura: Texture): Mesh {
  if (objeto.clase === 'plano') {
    return crearHojaAcostada(textura, objeto.huella, ORDEN_DE_LO_PINTADO_EN_EL_PISO);
  }

  // `parado` y `colgado` son hojas paradas en el centro de su huella; lo colgado, además, va en lo alto.
  const hoja = crearHojaParada(textura, objeto.imagen);
  const centro = centroDeRectangulo(objeto.huella);
  const altura = objeto.clase === 'colgado' ? objeto.alturaEnMetros : 0;
  hoja.position.set(centro.x, altura, centro.y);
  return hoja;
}

/** La sombra de un personaje: un óvalo oscuro y transparente, pegado al piso bajo sus pies. */
export function crearSombra(anchoDelPersonajeEnMetros: number): Mesh {
  const radio = (anchoDelPersonajeEnMetros * PROPORCION_DE_ANCHO_DE_LA_SOMBRA) / 2;
  const geometria = new CircleGeometry(radio, LADOS_DEL_CIRCULO_DE_LA_SOMBRA);
  const material = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: OPACIDAD_DE_LA_SOMBRA,
    depthWrite: false,
  });

  const sombra = new Mesh(geometria, material);
  sombra.rotation.x = -UN_CUARTO_DE_VUELTA;
  // Antes de acostarla, el círculo se aplasta para que la sombra sea un óvalo.
  sombra.scale.y = PROPORCION_DE_FONDO_DE_LA_SOMBRA;
  sombra.position.y = SEPARACION_DEL_PISO_EN_METROS;
  sombra.renderOrder = ORDEN_DE_LAS_SOMBRAS;
  return sombra;
}

/** Libera la memoria de video de una pieza: su forma y su material. Su textura es del almacén y no se toca. */
export function liberarPieza(pieza: Object3D): void {
  if (!(pieza instanceof Mesh)) return;
  pieza.geometry.dispose();
  const material = pieza.material;
  // Todas las piezas de este archivo usan un solo `MeshBasicMaterial`.
  if (material instanceof MeshBasicMaterial) {
    material.dispose();
  }
}

// Los lugares de un nivel que tienen nombre y a los que un plano de cámara puede mirar:
// los personajes que están en el escenario, los puntos del mapa y los objetos del decorado con id.
// Los usa la cámara libre del modo depuración para saber dónde está lo que se mira y qué se tocó.

import type { Contenido } from '../dominio/contenido.ts';
import { centroDeRectangulo } from '../dominio/forma.ts';
import { distanciaEntre } from '../dominio/geometria.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Decorado } from '../dominio/mundo.ts';
import type { Reparto } from './reparto.ts';

/** Algo del lugar que tiene nombre, y dónde está ahora. */
export interface LugarConNombre {
  readonly nombre: string;
  readonly punto: Punto;
}

/** De dónde salen los lugares con nombre de un nivel. */
export interface FuentesDeLugares {
  readonly contenido: Contenido;
  /** Dice dónde está cada personaje en este momento. */
  readonly reparto: Reparto;
  /** Los puntos con nombre del mapa. */
  readonly puntos: Readonly<Record<string, Punto>>;
  readonly decorado: readonly Decorado[];
}

/** Todos los lugares con nombre, en este orden: personajes en el escenario, puntos y objetos con id. */
export function reunirLugaresConNombre(fuentes: FuentesDeLugares): LugarConNombre[] {
  const lugares: LugarConNombre[] = [];
  for (const id of Object.keys(fuentes.contenido.meta.personajes)) {
    const posicion = fuentes.reparto.posicionDe(id);
    if (posicion !== undefined) {
      lugares.push({ nombre: id, punto: posicion });
    }
  }
  for (const nombre of Object.keys(fuentes.puntos)) {
    lugares.push({ nombre, punto: fuentes.puntos[nombre]! }); // `nombre` viene de `Object.keys`
  }
  for (const objeto of fuentes.decorado) {
    if (objeto.id !== undefined) {
      lugares.push({ nombre: objeto.id, punto: centroDeRectangulo(objeto.huella) });
    }
  }
  return lugares;
}

/** El lugar más cercano a un punto del piso, o `undefined` si ninguno está a `radioEnMetros` o menos. */
export function buscarLugarMasCercano(
  lugares: readonly LugarConNombre[],
  punto: Punto,
  radioEnMetros: number,
): LugarConNombre | undefined {
  let masCercano: LugarConNombre | undefined;
  let distanciaDelMasCercano = radioEnMetros;
  for (const lugar of lugares) {
    const distancia = distanciaEntre(punto, lugar.punto);
    if (distancia <= distanciaDelMasCercano) {
      masCercano = lugar;
      distanciaDelMasCercano = distancia;
    }
  }
  return masCercano;
}

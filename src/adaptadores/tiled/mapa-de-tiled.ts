// Lee el JSON de un mapa de Tiled (.tmj) y lo deja en una forma cómoda: capas con sus objetos,
// todavía en píxeles. Aquí solo se entiende el formato de Tiled; decidir qué significa cada capa
// para el juego es trabajo de los archivos `convertir-*.ts`.
//
// Los nombres de campos en inglés (`layers`, `objects`, `polygon`…) son los del formato de Tiled:
// https://doc.mapeditor.org/en/stable/reference/json-map-format/

import { esObjetoPlano } from '../../dominio/es-objeto-plano.ts';
import type { Punto } from '../../dominio/geometria.ts';

/** Cómo está dibujado un objeto en Tiled. */
export type FiguraDeTiled = 'punto' | 'rectangulo' | 'elipse' | 'poligono' | 'linea';

export interface ObjetoDeTiled {
  /** Cómo nombrarlo en un mensaje. Ejemplo: `objeto #12 "Doña Tortu"`. */
  readonly descripcion: string;
  readonly nombre: string;
  /** El campo «Clase» de Tiled. Vacío si no se escribió. */
  readonly clase: string;
  readonly figura: FiguraDeTiled;
  /** Esquina de menor `x` y menor `y` (o el punto mismo, si es un punto). */
  readonly xEnPixeles: number;
  readonly yEnPixeles: number;
  readonly anchoEnPixeles: number;
  readonly altoEnPixeles: number;
  /** Solo para polígonos y líneas: sus vértices, ya con la posición del objeto sumada. */
  readonly verticesEnPixeles: readonly Punto[];
  /** Las propiedades personalizadas del objeto, por nombre. */
  readonly propiedades: Readonly<Record<string, unknown>>;
}

export interface CapaDeTiled {
  readonly nombre: string;
  /** `'objectgroup'` (capa de objetos), `'imagelayer'` (capa de imagen), `'tilelayer'` o `'group'`. */
  readonly tipo: string;
  readonly objetos: readonly ObjetoDeTiled[];
  readonly propiedades: Readonly<Record<string, unknown>>;
  /** Cuánto está desplazada la capa completa. */
  readonly desplazamientoEnPixeles: Punto;
}

export interface MapaDeTiled {
  readonly anchoEnPixeles: number;
  readonly altoEnPixeles: number;
  readonly capas: readonly CapaDeTiled[];
}

/** Devuelve `undefined` si el JSON no es un mapa de Tiled. */
export function leerMapaDeTiled(json: unknown): MapaDeTiled | undefined {
  if (!esObjetoPlano(json) || !Array.isArray(json.layers)) return undefined;

  const capas: CapaDeTiled[] = [];
  for (const capaEnJson of json.layers) {
    if (esObjetoPlano(capaEnJson)) {
      capas.push(leerCapa(capaEnJson));
    }
  }

  // Tiled mide el mapa en celdas; el tamaño en píxeles es celdas × tamaño de celda.
  const anchoEnPixeles = numeroDe(json, 'width') * numeroDe(json, 'tilewidth');
  const altoEnPixeles = numeroDe(json, 'height') * numeroDe(json, 'tileheight');
  return { anchoEnPixeles, altoEnPixeles, capas };
}

function leerCapa(capaEnJson: Record<string, unknown>): CapaDeTiled {
  const desplazamientoEnPixeles = { x: numeroDe(capaEnJson, 'offsetx'), y: numeroDe(capaEnJson, 'offsety') };

  const objetos: ObjetoDeTiled[] = [];
  if (Array.isArray(capaEnJson.objects)) {
    for (const objetoEnJson of capaEnJson.objects) {
      if (esObjetoPlano(objetoEnJson)) {
        objetos.push(leerObjeto(objetoEnJson, desplazamientoEnPixeles));
      }
    }
  }

  return {
    nombre: textoDe(capaEnJson, 'name'),
    tipo: textoDe(capaEnJson, 'type'),
    objetos,
    propiedades: leerPropiedades(capaEnJson),
    desplazamientoEnPixeles,
  };
}

function leerObjeto(objetoEnJson: Record<string, unknown>, desplazamientoDeLaCapa: Punto): ObjetoDeTiled {
  const nombre = textoDe(objetoEnJson, 'name');
  const xEnPixeles = numeroDe(objetoEnJson, 'x') + desplazamientoDeLaCapa.x;
  const yEnPixeles = numeroDe(objetoEnJson, 'y') + desplazamientoDeLaCapa.y;

  let figura: FiguraDeTiled = 'rectangulo';
  let verticesRelativos: unknown = undefined;
  if (objetoEnJson.point === true) {
    figura = 'punto';
  } else if (objetoEnJson.ellipse === true) {
    figura = 'elipse';
  } else if (Array.isArray(objetoEnJson.polygon)) {
    figura = 'poligono';
    verticesRelativos = objetoEnJson.polygon;
  } else if (Array.isArray(objetoEnJson.polyline)) {
    figura = 'linea';
    verticesRelativos = objetoEnJson.polyline;
  }

  let descripcion = `objeto #${numeroDe(objetoEnJson, 'id')}`;
  if (nombre !== '') {
    descripcion += ` "${nombre}"`;
  }

  return {
    descripcion,
    nombre,
    clase: leerClase(objetoEnJson),
    figura,
    xEnPixeles,
    yEnPixeles,
    anchoEnPixeles: numeroDe(objetoEnJson, 'width'),
    altoEnPixeles: numeroDe(objetoEnJson, 'height'),
    verticesEnPixeles: leerVertices(verticesRelativos, { x: xEnPixeles, y: yEnPixeles }),
    propiedades: leerPropiedades(objetoEnJson),
  };
}

/** La clase se guarda en `type` desde Tiled 1.10, y en `class` en Tiled 1.9. */
function leerClase(objetoEnJson: Record<string, unknown>): string {
  const claseNueva = textoDe(objetoEnJson, 'type');
  if (claseNueva !== '') return claseNueva;
  return textoDe(objetoEnJson, 'class');
}

/** Tiled guarda los vértices relativos a la posición del objeto; aquí se les suma esa posición. */
function leerVertices(verticesRelativos: unknown, posicionDelObjeto: Punto): Punto[] {
  const vertices: Punto[] = [];
  if (!Array.isArray(verticesRelativos)) return vertices;

  for (const vertice of verticesRelativos) {
    if (esObjetoPlano(vertice)) {
      vertices.push({
        x: posicionDelObjeto.x + numeroDe(vertice, 'x'),
        y: posicionDelObjeto.y + numeroDe(vertice, 'y'),
      });
    }
  }
  return vertices;
}

/** Tiled guarda las propiedades como una lista `[{ name, type, value }]`; aquí quedan por nombre. */
function leerPropiedades(conPropiedades: Record<string, unknown>): Record<string, unknown> {
  const propiedades: Record<string, unknown> = {};
  if (!Array.isArray(conPropiedades.properties)) return propiedades;

  for (const propiedad of conPropiedades.properties) {
    if (!esObjetoPlano(propiedad)) continue;
    const nombre = textoDe(propiedad, 'name');
    // Guardar la clave "__proto__" cambiaría el prototipo del objeto en vez de agregar una propiedad.
    if (nombre === '' || nombre === '__proto__') continue;
    propiedades[nombre] = propiedad.value;
  }
  return propiedades;
}

/** El número de un campo, o 0 si falta o no es un número. */
function numeroDe(objeto: Record<string, unknown>, campo: string): number {
  const valor = objeto[campo];
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  return 0;
}

/** El texto de un campo, o `''` si falta o no es un texto. */
function textoDe(objeto: Record<string, unknown>, campo: string): string {
  const valor = objeto[campo];
  if (typeof valor === 'string') return valor;
  return '';
}

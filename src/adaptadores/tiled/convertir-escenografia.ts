// Convierte las capas del mapa que son escenografía: `suelo`, `telones`, `decorado` y `piso`.

import { leerCondicionDeTexto } from '../../dominio/condicion.ts';
import type { Condicion } from '../../dominio/condicion.ts';
import type { Punto } from '../../dominio/geometria.ts';
import { ALTURA_DE_LO_COLGADO_POR_DEFECTO_EN_METROS, CLASES_DE_DECORADO } from '../../dominio/mundo.ts';
import type { ClaseDeDecorado, Decorado, Suelo, Telon } from '../../dominio/mundo.ts';
import {
  aMetros,
  anotarError,
  esCapaDeObjetos,
  numeroDePropiedad,
  poligonoEnMetros,
  puntoEnMetros,
  rectanguloEnMetros,
  textoDePropiedad,
} from './conversion.ts';
import type { Conversion } from './conversion.ts';
import type { CapaDeTiled, ObjetoDeTiled } from './mapa-de-tiled.ts';

/** La capa `suelo` es una capa de imagen con la propiedad `asset`. */
export function convertirSuelo(capa: CapaDeTiled, conversion: Conversion): Suelo | undefined {
  if (capa.tipo !== 'imagelayer') {
    conversion.diagnostico.errores.push('mapa: la capa "suelo" debe ser una capa de imagen');
    return undefined;
  }
  const asset = textoDePropiedad(capa.propiedades, 'asset');
  if (asset === undefined) {
    conversion.diagnostico.errores.push(
      'mapa: la capa "suelo" necesita la propiedad "asset" con la clave de la imagen del piso',
    );
    return undefined;
  }
  return { asset, esquina: puntoEnMetros(capa.desplazamientoEnPixeles, conversion) };
}

/** Cada objeto de `telones` es una línea de dos puntos con las propiedades `asset` y `alto`. */
export function convertirTelones(capa: CapaDeTiled, conversion: Conversion): Telon[] {
  const telones: Telon[] = [];
  if (!esCapaDeObjetos(capa, conversion)) return telones;

  for (const objeto of capa.objetos) {
    const desde = objeto.verticesEnPixeles[0];
    const hasta = objeto.verticesEnPixeles[1];
    const esLineaDeDosPuntos = objeto.figura === 'linea' && objeto.verticesEnPixeles.length === 2;
    if (!esLineaDeDosPuntos || desde === undefined || hasta === undefined) {
      anotarError(objeto, capa, 'un telón se dibuja como una línea de dos puntos', conversion);
      continue;
    }

    const asset = leerAsset(objeto, capa, conversion);
    const altoEnPixeles = numeroDePropiedad(objeto.propiedades, 'alto');
    if (altoEnPixeles === undefined || altoEnPixeles <= 0) {
      anotarError(objeto, capa, 'falta la propiedad "alto": la altura del telón en píxeles, mayor que 0', conversion);
      continue;
    }
    if (asset === undefined) continue;

    telones.push({
      descripcion: objeto.descripcion,
      asset,
      desde: puntoEnMetros(desde, conversion),
      hasta: puntoEnMetros(hasta, conversion),
      altoEnMetros: aMetros(altoEnPixeles, conversion),
    });
  }
  return telones;
}

/** Cada objeto de `decorado` es un rectángulo (su huella) con una clase del catálogo y la propiedad `asset`. */
export function convertirDecorado(capa: CapaDeTiled, conversion: Conversion): Decorado[] {
  const decorado: Decorado[] = [];
  if (!esCapaDeObjetos(capa, conversion)) return decorado;

  for (const objeto of capa.objetos) {
    if (objeto.figura !== 'rectangulo') {
      anotarError(objeto, capa, 'debe ser un rectángulo: su forma es la huella del objeto en el piso', conversion);
      continue;
    }
    const clase = leerClaseDeDecorado(objeto, capa, conversion);
    const asset = leerAsset(objeto, capa, conversion);
    if (clase === undefined || asset === undefined) continue;

    let alturaEnMetros = ALTURA_DE_LO_COLGADO_POR_DEFECTO_EN_METROS;
    const alturaEnPixeles = numeroDePropiedad(objeto.propiedades, 'altura');
    if (alturaEnPixeles !== undefined) {
      alturaEnMetros = aMetros(alturaEnPixeles, conversion);
    }

    decorado.push({
      descripcion: objeto.descripcion,
      clase,
      asset,
      huella: rectanguloEnMetros(objeto, conversion),
      alturaEnMetros,
      id: textoDePropiedad(objeto.propiedades, 'id'),
      visibleCuando: leerVisibleCuando(objeto),
    });
  }
  return decorado;
}

/**
 * La propiedad `visibleCuando`: una condición escrita como texto, igual que en el contenido
 * (`"no tengo verduras"`, `"objetivosCompletos"`). Que sus variables existan se revisa al cruzar con el contenido.
 */
function leerVisibleCuando(objeto: ObjetoDeTiled): Condicion | undefined {
  const texto = textoDePropiedad(objeto.propiedades, 'visibleCuando');
  if (texto === undefined) return undefined;
  return leerCondicionDeTexto(texto);
}

/** Cada objeto de `piso` es un polígono de 3 o más vértices, o un rectángulo. */
export function convertirPisos(capa: CapaDeTiled, conversion: Conversion): Punto[][] {
  const pisos: Punto[][] = [];
  if (!esCapaDeObjetos(capa, conversion)) return pisos;

  for (const objeto of capa.objetos) {
    const vertices = verticesDePiso(objeto, conversion);
    if (vertices === undefined) {
      anotarError(objeto, capa, 'el piso se dibuja con polígonos de 3 o más vértices, o con rectángulos', conversion);
      continue;
    }
    pisos.push(vertices);
  }
  return pisos;
}

function verticesDePiso(objeto: ObjetoDeTiled, conversion: Conversion): Punto[] | undefined {
  if (objeto.figura !== 'rectangulo') {
    return poligonoEnMetros(objeto, conversion);
  }
  // Un rectángulo se convierte en el polígono de sus cuatro esquinas.
  const rectangulo = rectanguloEnMetros(objeto, conversion);
  const xDerecha = rectangulo.x + rectangulo.ancho;
  const yDelFrente = rectangulo.y + rectangulo.alto;
  return [
    { x: rectangulo.x, y: rectangulo.y },
    { x: xDerecha, y: rectangulo.y },
    { x: xDerecha, y: yDelFrente },
    { x: rectangulo.x, y: yDelFrente },
  ];
}

function leerAsset(objeto: ObjetoDeTiled, capa: CapaDeTiled, conversion: Conversion): string | undefined {
  const asset = textoDePropiedad(objeto.propiedades, 'asset');
  if (asset === undefined) {
    anotarError(objeto, capa, 'falta la propiedad "asset" con la clave de su imagen', conversion);
  }
  return asset;
}

function leerClaseDeDecorado(
  objeto: ObjetoDeTiled,
  capa: CapaDeTiled,
  conversion: Conversion,
): ClaseDeDecorado | undefined {
  for (const clase of CLASES_DE_DECORADO) {
    if (objeto.clase === clase) return clase;
  }
  const clasesValidas = CLASES_DE_DECORADO.join(', ');
  const problema = `la clase "${objeto.clase}" no existe; las clases de decorado son: ${clasesValidas}`;
  anotarError(objeto, capa, problema, conversion);
  return undefined;
}

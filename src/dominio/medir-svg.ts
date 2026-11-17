// Lee el tamaño de un dibujo SVG a partir de su texto, y detecta si depende de archivos externos.
//
// El tamaño sale del atributo `viewBox` de la etiqueta `<svg>`; si no lo tiene, de `width` y `height`.
// El motor convierte cada SVG en textura, y al hacerlo los archivos enlazados (fuentes, fotos) no se cargan.

import type { Medidas } from './manifiesto.ts';

// La etiqueta de apertura del dibujo, completa. Ejemplo: `<svg xmlns="..." viewBox="0 0 90 160">`.
const ETIQUETA_DE_APERTURA = /<svg\b[^>]*>/i;

// El atributo viewBox con su valor. En ` viewBox="0 0 90 160"` captura `0 0 90 160`.
const ATRIBUTO_VIEWBOX = /\sviewBox\s*=\s*["']([^"']*)["']/i;

// Los atributos width y height con un número, con o sin "px". En ` width="90px"` captura `90`.
// El espacio inicial evita confundirlos con otros atributos que terminan igual, como `stroke-width`.
const ATRIBUTO_WIDTH = /\swidth\s*=\s*["']\s*([0-9.]+)\s*(?:px)?\s*["']/i;
const ATRIBUTO_HEIGHT = /\sheight\s*=\s*["']\s*([0-9.]+)\s*(?:px)?\s*["']/i;

// Los números de un viewBox se separan con espacios o comas: "0 0 90 160" o "0,0,90,160".
const SEPARADOR_DE_NUMEROS = /[\s,]+/;

// Un enlace a otro recurso. En `href="foto.png"` o `xlink:href='#sombra'` captura `foto.png` o `#sombra`.
const ATRIBUTO_DE_ENLACE = /\bhref\s*=\s*["']([^"']*)["']/gi;

/** El tamaño del dibujo, o `undefined` si el SVG no trae `viewBox` ni `width` y `height` válidos. */
export function medirSvg(textoDelSvg: string): Medidas | undefined {
  const etiqueta = ETIQUETA_DE_APERTURA.exec(textoDelSvg);
  if (etiqueta === null) return undefined;
  const textoDeLaEtiqueta = etiqueta[0];

  const medidasDelViewBox = medirConViewBox(textoDeLaEtiqueta);
  if (medidasDelViewBox !== undefined) return medidasDelViewBox;
  return medirConWidthYHeight(textoDeLaEtiqueta);
}

/**
 * Los enlaces del SVG que apuntan a otros archivos. Los que empiezan con `#` (partes del mismo dibujo)
 * y con `data:` (contenido incrustado) no cuentan, porque no necesitan cargar nada.
 *
 * Limitación conocida: no detecta archivos enlazados desde CSS (`url(...)`, `@import`).
 */
export function enlacesExternosDeSvg(textoDelSvg: string): string[] {
  const externos: string[] = [];
  for (const coincidencia of textoDelSvg.matchAll(ATRIBUTO_DE_ENLACE)) {
    const destino = coincidencia[1]!.trim(); // el grupo 1 siempre existe cuando la expresión coincide
    const esInterno = destino.startsWith('#') || destino.startsWith('data:');
    if (!esInterno && destino !== '') {
      externos.push(destino);
    }
  }
  return externos;
}

function medirConViewBox(textoDeLaEtiqueta: string): Medidas | undefined {
  const atributo = ATRIBUTO_VIEWBOX.exec(textoDeLaEtiqueta);
  if (atributo === null) return undefined;

  // Un viewBox son cuatro números: x mínima, y mínima, ancho y alto.
  const numeros = atributo[1]!.trim().split(SEPARADOR_DE_NUMEROS);
  if (numeros.length !== 4) return undefined;
  return crearMedidas(Number(numeros[2]), Number(numeros[3]));
}

function medirConWidthYHeight(textoDeLaEtiqueta: string): Medidas | undefined {
  const ancho = ATRIBUTO_WIDTH.exec(textoDeLaEtiqueta);
  const alto = ATRIBUTO_HEIGHT.exec(textoDeLaEtiqueta);
  if (ancho === null || alto === null) return undefined;
  return crearMedidas(Number(ancho[1]), Number(alto[1]));
}

function crearMedidas(anchoEnPixeles: number, altoEnPixeles: number): Medidas | undefined {
  const sonTamanosValidos =
    Number.isFinite(anchoEnPixeles) && Number.isFinite(altoEnPixeles) && anchoEnPixeles > 0 && altoEnPixeles > 0;
  if (!sonTamanosValidos) return undefined;
  return { anchoEnPixeles, altoEnPixeles };
}

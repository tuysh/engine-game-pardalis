// Ayudas para crear los elementos de la interfaz. Los textos siempre se ponen con `textContent`,
// que nunca los interpreta como HTML: así un texto de un nivel no puede meter etiquetas en la página.

import type { Idioma } from '../../dominio/idioma.ts';

const ESPACIO_SVG = 'http://www.w3.org/2000/svg';

/** Crea un elemento vacío que empieza oculto. */
export function crearOculto(etiqueta: string, clase: string): HTMLElement {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  elemento.hidden = true;
  return elemento;
}

/** Crea un elemento con un texto. */
export function crearConTexto(etiqueta: string, clase: string, texto: string): HTMLElement {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  elemento.textContent = texto;
  return elemento;
}

/** Crea un elemento con un texto en ese idioma (atributo `lang`), para que un lector de pantalla lo pronuncie bien. */
export function crearEnIdioma(etiqueta: string, clase: string, texto: string, idioma: Idioma): HTMLElement {
  const elemento = crearConTexto(etiqueta, clase, texto);
  elemento.lang = idioma;
  return elemento;
}

/**
 * Crea un dibujo SVG de 24 × 24 con una sola figura. `trazo` es el recorrido de la figura en el lenguaje
 * de SVG; por ejemplo, 'M6 3 L21 12 L6 21 Z' es el triángulo de «reproducir».
 */
export function crearDibujo(trazo: string): SVGElement {
  const dibujo = document.createElementNS(ESPACIO_SVG, 'svg');
  dibujo.setAttribute('viewBox', '0 0 24 24');
  // Es un adorno: lo que significa ya lo dice la etiqueta del botón o el contexto.
  dibujo.setAttribute('aria-hidden', 'true');
  const figura = document.createElementNS(ESPACIO_SVG, 'path');
  figura.setAttribute('d', trazo);
  // Con esta regla, una figura dibujada dentro de otra queda como un hueco (los puntos del globito de aviso).
  figura.setAttribute('fill-rule', 'evenodd');
  dibujo.append(figura);
  return dibujo;
}

/** Crea un botón redondo que solo lleva un dibujo. `nombre` es lo que anuncia un lector de pantalla. */
export function crearBotonConDibujo(clase: string, nombre: string, trazo: string): HTMLButtonElement {
  const boton = document.createElement('button');
  boton.className = clase;
  boton.type = 'button';
  boton.setAttribute('aria-label', nombre);
  boton.append(crearDibujo(trazo));
  return boton;
}

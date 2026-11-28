// Las opciones de un paso `elige`: la pregunta arriba y una tarjeta grande por opción, con su imagen,
// su texto y el número de la tecla que la elige. El texto y su traducción llevan su idioma en `lang`, para que
// un lector de pantalla pronuncie «water» en inglés.

import type { OpcionPorMostrar } from '../../puertos/interfaz.ts';
import { otroIdioma } from '../../dominio/idioma.ts';
import { crearConTexto, crearEnIdioma, crearOculto } from './elementos.ts';

export class TarjetasDeOpciones {
  readonly elemento: HTMLElement;
  private tarjetas: HTMLElement[] = [];

  constructor() {
    this.elemento = crearOculto('div', 'opciones');
  }

  /** Cuántas tarjetas hay en pantalla. 0 = no hay opciones. */
  get cantidad(): number {
    return this.tarjetas.length;
  }

  /** `alElegir` se llama con la posición de la tarjeta que el jugador toca. */
  mostrar(pregunta: string, opciones: readonly OpcionPorMostrar[], alElegir: (posicion: number) => void): void {
    const fila = crearConTexto('div', 'tarjetas', '');
    this.tarjetas = [];
    for (let i = 0; i < opciones.length; i++) {
      const tarjeta = crearTarjeta(opciones[i]!, i); // `i` es menor que el largo de la lista
      tarjeta.addEventListener('click', () => alElegir(i));
      this.tarjetas.push(tarjeta);
      fila.append(tarjeta);
    }
    this.elemento.replaceChildren(crearConTexto('div', 'pregunta', pregunta), fila);
    this.elemento.hidden = false;
  }

  /** Resalta la tarjeta de esa posición y quita el resalte de las demás. `undefined` = ninguna. */
  resaltar(posicion: number | undefined): void {
    for (let i = 0; i < this.tarjetas.length; i++) {
      this.tarjetas[i]!.classList.toggle('resaltada', i === posicion); // `i` es menor que el largo de la lista
    }
  }

  ocultar(): void {
    this.elemento.hidden = true;
    this.elemento.replaceChildren();
    this.tarjetas = [];
  }
}

function crearTarjeta(opcion: OpcionPorMostrar, posicion: number): HTMLElement {
  const tarjeta = document.createElement('button');
  tarjeta.className = 'tarjeta';
  tarjeta.type = 'button';
  tarjeta.append(crearConTexto('span', 'numero-de-tarjeta', String(posicion + 1)));

  if (opcion.direccionDeLaImagen !== undefined) {
    const imagen = document.createElement('img');
    imagen.src = opcion.direccionDeLaImagen;
    // La imagen repite lo que ya dice el texto de la tarjeta; un lector de pantalla no debe leerla dos veces.
    imagen.alt = '';
    tarjeta.append(imagen);
  }
  if (opcion.texto !== undefined) {
    tarjeta.append(crearEnIdioma('span', 'texto', opcion.texto, opcion.idioma));
  }
  if (opcion.traduccion !== undefined) {
    tarjeta.append(crearEnIdioma('span', 'traduccion', opcion.traduccion, otroIdioma(opcion.idioma)));
  }
  return tarjeta;
}

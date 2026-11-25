// El globo de diálogo: una placa con el texto, la traducción opcional debajo y, si la línea
// enseña una palabra, su tarjeta de vocabulario arriba. Su piquito apunta a quien habla.
// Si el personaje piensa en vez de decir, el globo es una nube y el piquito son burbujitas.

import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import type { GloboPorMostrar } from '../../puertos/interfaz.ts';
import { crearConTexto, crearOculto } from './elementos.ts';

/** Separación entre el globo y la cabeza de quien habla, y entre el globo y la orilla del juego. */
const SEPARACION_DEL_GLOBO_EN_PUNTOS = 18;
const MARGEN_DEL_GLOBO_EN_PUNTOS = 12;

/** A qué altura del juego va el globo cuando quien habla no está en el escenario: una parte del alto. */
const ALTURA_DEL_GLOBO_SIN_HABLANTE = 0.35;

/** El tamaño del área del juego, en puntos de CSS. */
export interface TamanoDelJuego {
  readonly ancho: number;
  readonly alto: number;
}

export class GloboDeDialogo {
  readonly elemento: HTMLElement;
  /** Cuántos globos se han mostrado: dice si el que está en pantalla sigue siendo el de quien quiere quitarlo. */
  private globosMostrados = 0;

  constructor() {
    this.elemento = crearOculto('div', 'globo');
    // Quien usa un lector de pantalla escucha cada globo nuevo sin tener que buscarlo.
    this.elemento.setAttribute('role', 'status');
  }

  /** Muestra un globo y devuelve la función que quita ESE globo (no el que lo haya reemplazado). */
  mostrar(globo: GloboPorMostrar): () => void {
    this.globosMostrados++;
    const numeroDeEsteGlobo = this.globosMostrados;

    this.elemento.replaceChildren();
    // Un pensamiento se dibuja como nube con burbujitas: se distingue de lo que se dice sin leer nada.
    this.elemento.classList.toggle('pensamiento', globo.esPensamiento === true);
    if (globo.palabra !== undefined) {
      const palabraEnLosDosIdiomas = `${globo.palabra.en} · ${globo.palabra.es}`;
      this.elemento.append(crearConTexto('div', 'tarjeta-de-palabra', palabraEnLosDosIdiomas));
    }
    this.elemento.append(crearConTexto('div', 'texto', globo.texto));
    if (globo.traduccion !== undefined) {
      this.elemento.append(crearConTexto('div', 'traduccion', globo.traduccion));
    }
    this.elemento.hidden = false;

    return () => {
      const sigueSiendoElGloboEnPantalla = this.globosMostrados === numeroDeEsteGlobo;
      if (sigueSiendoElGloboEnPantalla) {
        this.elemento.hidden = true;
      }
    };
  }

  /** Pone el piquito en `lugar`. Sin lugar (quien habla no está en el escenario), el globo va arriba y al centro. */
  apuntar(lugar: LugarEnPantalla | undefined, juego: TamanoDelJuego): void {
    const anchoDelGlobo = this.elemento.offsetWidth;
    const altoDelGlobo = this.elemento.offsetHeight;
    const lugarDelPiquito = lugar ?? { x: juego.ancho / 2, y: juego.alto * ALTURA_DEL_GLOBO_SIN_HABLANTE };

    // El globo se centra sobre el piquito, pero sin salirse del juego por los lados ni por arriba.
    const izquierdaDeseada = lugarDelPiquito.x - anchoDelGlobo / 2;
    const izquierdaMaxima = juego.ancho - anchoDelGlobo - MARGEN_DEL_GLOBO_EN_PUNTOS;
    const izquierda = Math.max(MARGEN_DEL_GLOBO_EN_PUNTOS, Math.min(izquierdaDeseada, izquierdaMaxima));
    const arribaDeseado = lugarDelPiquito.y - altoDelGlobo - SEPARACION_DEL_GLOBO_EN_PUNTOS;
    const arriba = Math.max(MARGEN_DEL_GLOBO_EN_PUNTOS, arribaDeseado);

    this.elemento.style.transform = `translate(${izquierda}px, ${arriba}px)`;
    // Si el globo tuvo que correrse de lado, el piquito se corre al revés para seguir apuntando a quien habla.
    const desvioDelPiquito = izquierdaDeseada - izquierda;
    this.elemento.style.setProperty('--desvio-del-piquito', `${desvioDelPiquito}px`);
  }
}

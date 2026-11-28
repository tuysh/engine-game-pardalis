// El globo de diálogo: una placa con el texto, la traducción opcional debajo y, si la línea
// enseña una palabra, su tarjeta de vocabulario arriba. Su piquito apunta a quien habla.
// Si el personaje piensa en vez de decir, el globo es una nube y el piquito son burbujitas.
//
// Cada texto lleva su idioma en el atributo `lang`: así un lector de pantalla dice «Lettuce?» en inglés y su
// traducción en español, aunque la página esté en un solo idioma.

import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import type { GloboPorMostrar } from '../../puertos/interfaz.ts';
import { otroIdioma } from '../../dominio/idioma.ts';
import { crearConTexto, crearEnIdioma, crearOculto } from './elementos.ts';

/** Separación entre el globo y la cabeza de quien habla, y entre el globo y la orilla del juego. */
const SEPARACION_DEL_GLOBO_EN_PUNTOS = 18;
const MARGEN_DEL_GLOBO_EN_PUNTOS = 12;

/** A qué altura del juego va el globo cuando quien habla no está en el escenario: una parte del alto. */
const ALTURA_DEL_GLOBO_SIN_HABLANTE = 0.35;

/** El área del juego donde puede ir el globo, en puntos de CSS. */
export interface AreaDelGlobo {
  readonly ancho: number;
  readonly alto: number;
  /** Lo que ocupa arriba algo que no se debe tapar (la franja de cine). 0 = nada. */
  readonly ocupadoArribaEnPuntos: number;
  /** Lo mismo, abajo. */
  readonly ocupadoAbajoEnPuntos: number;
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
      // «lettuce · lechuga»: cada palabra con su idioma.
      const tarjeta = crearConTexto('div', 'tarjeta-de-palabra', '');
      const enIngles = crearEnIdioma('span', '', globo.palabra.en, 'en');
      const enEspanol = crearEnIdioma('span', '', globo.palabra.es, 'es');
      tarjeta.append(enIngles, ' · ', enEspanol);
      this.elemento.append(tarjeta);
    }
    this.elemento.append(crearEnIdioma('div', 'texto', globo.texto, globo.idioma));
    if (globo.traduccion !== undefined) {
      this.elemento.append(crearEnIdioma('div', 'traduccion', globo.traduccion, otroIdioma(globo.idioma)));
    }
    this.elemento.hidden = false;

    return () => {
      const sigueSiendoElGloboEnPantalla = this.globosMostrados === numeroDeEsteGlobo;
      if (sigueSiendoElGloboEnPantalla) {
        this.elemento.hidden = true;
      }
    };
  }

  /**
   * Pone el piquito en `lugar`. Sin lugar (quien habla no está en el escenario), el globo va arriba y al centro.
   * El globo, con su tarjeta de vocabulario, nunca se sale del área ni se mete bajo lo ocupado (las franjas de cine):
   * si hace falta, se corre y el piquito se estira hacia quien habla.
   */
  apuntar(lugar: LugarEnPantalla | undefined, area: AreaDelGlobo): void {
    const anchoDelGlobo = this.elemento.offsetWidth;
    const altoDelGlobo = this.elemento.offsetHeight;
    const lugarDelPiquito = lugar ?? { x: area.ancho / 2, y: area.alto * ALTURA_DEL_GLOBO_SIN_HABLANTE };

    // El globo se centra sobre el piquito, pero sin salirse del juego por los lados.
    const izquierdaDeseada = lugarDelPiquito.x - anchoDelGlobo / 2;
    const izquierdaMaxima = area.ancho - anchoDelGlobo - MARGEN_DEL_GLOBO_EN_PUNTOS;
    const izquierda = Math.max(MARGEN_DEL_GLOBO_EN_PUNTOS, Math.min(izquierdaDeseada, izquierdaMaxima));

    const arribaDeseado = lugarDelPiquito.y - altoDelGlobo - SEPARACION_DEL_GLOBO_EN_PUNTOS;
    // La tarjeta de vocabulario sobresale por arriba del globo: también ella debe quedar a la vista.
    const arribaMinimo = area.ocupadoArribaEnPuntos + MARGEN_DEL_GLOBO_EN_PUNTOS + this.medirLoQueSobresaleArriba();
    const arribaMaximo = area.alto - area.ocupadoAbajoEnPuntos - MARGEN_DEL_GLOBO_EN_PUNTOS - altoDelGlobo;
    // Si el juego es tan bajo que no cabe entre los dos límites, gana el de arriba: ahí está el principio del texto.
    const arriba = Math.max(arribaMinimo, Math.min(arribaDeseado, arribaMaximo));

    this.elemento.style.transform = `translate(${izquierda}px, ${arriba}px)`;
    // Si el globo tuvo que correrse de lado, el piquito se corre al revés para seguir apuntando a quien habla.
    const desvioDelPiquito = izquierdaDeseada - izquierda;
    this.elemento.style.setProperty('--desvio-del-piquito', `${desvioDelPiquito}px`);
  }

  /** Cuántos puntos sobresale la tarjeta de vocabulario por encima del borde del globo. 0 si no hay tarjeta. */
  private medirLoQueSobresaleArriba(): number {
    const tarjeta = this.elemento.querySelector('.tarjeta-de-palabra');
    if (tarjeta === null) return 0;
    // Los dos se mueven juntos, así que la diferencia entre sus bordes de arriba no depende de dónde esté el globo.
    const bordeDelGlobo = this.elemento.getBoundingClientRect().top;
    const bordeDeLaTarjeta = tarjeta.getBoundingClientRect().top;
    return Math.max(0, bordeDelGlobo - bordeDeLaTarjeta);
  }
}

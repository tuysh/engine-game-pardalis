// Las señales de lo pendiente: una estrellita que sube y baja encima de cada NPC u objeto que todavía
// tiene algo que hacer (`senal` en el contenido). Pueden ser varias a la vez; no atrapan toques.
//
// Se colocan en cada cuadro. Para no rehacer la página tantas veces, se reusan las señales que ya existen
// y solo se crean o se esconden las que sobran o faltan.

import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import { crearDibujo, crearOculto } from './elementos.ts';
import { SenalEnPantalla } from './senal-en-pantalla.ts';

/** Una estrella de cuatro puntas, como un destello: «aquí hay algo», sobre una cuadrícula de 24 × 24. */
const TRAZO_DE_ESTRELLITA = 'M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z';

/** Las estrellitas de lo pendiente en la página: tantas como lugares, reusando las que ya existen. */
export class SenalesDePendientes {
  /** El contenedor de todas las señales. Siempre está en la página; vacío no se ve. */
  readonly elemento: HTMLElement;
  private readonly senales: SenalEnPantalla[] = [];

  constructor() {
    this.elemento = crearOculto('div', 'senales-de-pendientes');
    this.elemento.hidden = false;
  }

  /** Deja una señal sobre cada lugar; las que sobran se esconden. */
  poner(lugares: readonly LugarEnPantalla[]): void {
    while (this.senales.length < lugares.length) {
      const senal = new SenalEnPantalla('senal-de-pendiente');
      senal.mostrar([crearDibujo(TRAZO_DE_ESTRELLITA)]);
      this.elemento.append(senal.elemento);
      this.senales.push(senal);
    }
    for (let i = 0; i < this.senales.length; i++) {
      const senal = this.senales[i]!; // `i` es menor que el largo de la lista
      const lugar = lugares[i];
      if (lugar === undefined) {
        senal.ocultar();
        continue;
      }
      senal.elemento.hidden = false;
      senal.apuntar(lugar);
    }
  }
}

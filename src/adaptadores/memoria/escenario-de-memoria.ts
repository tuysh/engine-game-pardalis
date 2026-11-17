// Escenario falso para las pruebas: no dibuja nada. Recuerda lo que se le pidió
// y deja que la prueba simule toques del jugador.

import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import type { Punto } from '../../dominio/geometria.ts';
import type { Mira } from '../../dominio/mundo.ts';
import type { Escenario, Escenografia, LugarEnPantalla, PersonajeDeEscena, Toque } from '../../puertos/escenario.ts';

/** Cómo está un personaje en el escenario falso. */
export interface PersonajeRecordado {
  posicion: Punto;
  mira: Mira;
  sePuedeTocar: boolean;
}

export class EscenarioDeMemoria implements Escenario {
  /** La última escenografía montada. */
  escenografia: Escenografia | undefined;
  /** Los personajes agregados, por id. */
  readonly personajes = new Map<string, PersonajeRecordado>();
  /** El último punto al que se apuntó la cámara. */
  puntoEnfocado: Punto | undefined;
  cuadrosDibujados = 0;
  estaDestruido = false;

  private funcionesDeToque: ((toque: Toque) => void)[] = [];

  async montar(escenografia: Escenografia): Promise<void> {
    this.escenografia = escenografia;
  }

  async agregarPersonaje(personaje: PersonajeDeEscena): Promise<void> {
    this.personajes.set(personaje.id, {
      posicion: personaje.posicion,
      mira: personaje.mira,
      sePuedeTocar: personaje.sePuedeTocar,
    });
  }

  moverPersonaje(id: string, posicion: Punto): void {
    const personaje = this.personajes.get(id);
    if (personaje !== undefined) {
      personaje.posicion = posicion;
    }
  }

  voltearPersonaje(id: string, mira: Mira): void {
    const personaje = this.personajes.get(id);
    if (personaje !== undefined) {
      personaje.mira = mira;
    }
  }

  /** En el escenario falso, la «pantalla» es el propio plano: un metro es un punto. */
  lugarEnPantallaDe(id: string): LugarEnPantalla | undefined {
    const personaje = this.personajes.get(id);
    if (personaje === undefined) return undefined;
    return { x: personaje.posicion.x, y: personaje.posicion.y };
  }

  lugarEnPantallaDelPunto(punto: Punto, alturaEnMetros: number): LugarEnPantalla {
    return { x: punto.x, y: punto.y };
  }

  enfocar(punto: Punto, camara: AjustesDeCamara, opciones: { readonly deInmediato: boolean }): void {
    this.puntoEnfocado = punto;
  }

  dibujar(segundos: number): void {
    this.cuadrosDibujados++;
  }

  alTocar(funcion: (toque: Toque) => void): () => void {
    this.funcionesDeToque.push(funcion);
    return () => {
      this.funcionesDeToque = this.funcionesDeToque.filter((registrada) => registrada !== funcion);
    };
  }

  destruir(): void {
    this.estaDestruido = true;
    this.funcionesDeToque = [];
  }

  /** Para las pruebas: hace como si el jugador hubiera tocado algo. */
  simularToque(toque: Toque): void {
    for (const funcion of this.funcionesDeToque) {
      funcion(toque);
    }
  }
}

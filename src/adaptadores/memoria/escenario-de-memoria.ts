// Escenario falso para las pruebas: no dibuja nada. Recuerda lo que se le pidió
// y deja que la prueba simule toques del jugador.

import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import type { Punto } from '../../dominio/geometria.ts';
import type { Mira } from '../../dominio/mundo.ts';
import type {
  Escenario,
  Escenografia,
  ImagenDeEscena,
  LugarEnPantalla,
  PersonajeDeEscena,
  Toque,
} from '../../puertos/escenario.ts';

/** Cómo está un personaje en el escenario falso. */
export interface PersonajeRecordado {
  posicion: Punto;
  mira: Mira;
  sePuedeTocar: boolean;
}

/** El dibujo que se le puso a un personaje con `ponerDibujoDePersonaje`. */
export interface DibujoRecordado {
  readonly imagen: ImagenDeEscena;
  readonly repite: boolean;
}

export class EscenarioDeMemoria implements Escenario {
  /** La última escenografía montada. */
  escenografia: Escenografia | undefined;
  /** Los personajes agregados, por id. */
  readonly personajes = new Map<string, PersonajeRecordado>();
  /** El último dibujo que se le cambió a cada personaje, por id. Quien nunca cambió de dibujo no aparece. */
  readonly dibujos = new Map<string, DibujoRecordado>();
  /** Las imágenes que se pidió descargar por adelantado. */
  readonly imagenesPrecargadas: ImagenDeEscena[] = [];
  /** El último punto al que se apuntó la cámara. */
  puntoEnfocado: Punto | undefined;
  /** Desde dónde miraba la cámara la última vez que se le apuntó. */
  camaraEnfocada: AjustesDeCamara | undefined;
  cuadrosDibujados = 0;
  /** Los efectos que se han pedido, en orden. */
  readonly efectosReproducidos: { nombre: string; punto: Punto }[] = [];
  estaDestruido = false;

  private funcionesDeToque: ((toque: Toque) => void)[] = [];

  async montar(escenografia: Escenografia): Promise<void> {
    this.escenografia = escenografia;
    // Una escenografía nueva es un lugar nuevo: los personajes del lugar anterior ya no están.
    this.personajes.clear();
    this.dibujos.clear();
  }

  async agregarPersonaje(personaje: PersonajeDeEscena): Promise<void> {
    this.personajes.set(personaje.id, {
      posicion: personaje.posicion,
      mira: personaje.mira,
      sePuedeTocar: personaje.sePuedeTocar,
    });
  }

  quitarPersonaje(id: string): void {
    this.personajes.delete(id);
    this.dibujos.delete(id);
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

  async ponerDibujoDePersonaje(
    id: string,
    imagen: ImagenDeEscena,
    opciones: { readonly repite: boolean },
  ): Promise<void> {
    if (this.personajes.has(id)) {
      this.dibujos.set(id, { imagen, repite: opciones.repite });
    }
  }

  async precargar(imagenes: readonly ImagenDeEscena[]): Promise<void> {
    this.imagenesPrecargadas.push(...imagenes);
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

  reproducirEfecto(nombre: string, punto: Punto): void {
    this.efectosReproducidos.push({ nombre, punto });
  }

  enfocar(punto: Punto, camara: AjustesDeCamara): void {
    this.puntoEnfocado = punto;
    this.camaraEnfocada = camara;
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

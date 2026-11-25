// El reparto: los personajes que están en el escenario, con su posición y hacia dónde miran.
// Es la única fuente de esos datos para la aplicación: el control del jugador, las caminatas
// de los diálogos y los globos preguntan y cambian aquí, y el reparto avisa al escenario.

import type { Punto } from '../dominio/geometria.ts';
import type { Mira } from '../dominio/mundo.ts';
import type { Escenario, ImagenDeEscena, PersonajeDeEscena } from '../puertos/escenario.ts';

/** El dibujo que un personaje tiene puesto: su imagen o animación y si la animación se repite. */
export interface DibujoDePersonaje {
  readonly imagen: ImagenDeEscena;
  readonly repite: boolean;
}

interface Miembro {
  posicion: Punto;
  mira: Mira;
  dibujo: DibujoDePersonaje;
}

export class Reparto {
  private readonly escenario: Escenario;
  private readonly miembros = new Map<string, Miembro>();

  constructor(escenario: Escenario) {
    this.escenario = escenario;
  }

  /** Pone un personaje en el escenario. Termina cuando su imagen ya cargó. */
  async agregar(personaje: PersonajeDeEscena): Promise<void> {
    // El dibujo con el que alguien entra al escenario, si es una animación, se repite sin parar.
    const dibujo = { imagen: personaje.imagen, repite: true };
    this.miembros.set(personaje.id, { posicion: personaje.posicion, mira: personaje.mira, dibujo });
    await this.escenario.agregarPersonaje(personaje);
  }

  /** Saca a un personaje del escenario. Si no está, no hace nada. */
  quitar(id: string): void {
    if (!this.miembros.has(id)) return;
    this.miembros.delete(id);
    this.escenario.quitarPersonaje(id);
  }

  estaEnEscena(id: string): boolean {
    return this.miembros.has(id);
  }

  /**
   * Cambia el dibujo de un personaje por otra imagen o animación (ver `Escenario.ponerDibujoDePersonaje`).
   * Termina cuando el dibujo nuevo ya se ve. Si el personaje no está en el escenario, no hace nada.
   */
  async ponerDibujo(id: string, imagen: ImagenDeEscena, opciones: { readonly repite: boolean }): Promise<void> {
    const miembro = this.miembros.get(id);
    if (miembro === undefined) return;
    miembro.dibujo = { imagen, repite: opciones.repite };
    await this.escenario.ponerDibujoDePersonaje(id, imagen, opciones);
  }

  /** El dibujo que un personaje tiene puesto ahora, o `undefined` si no está en el escenario. */
  dibujoDe(id: string): DibujoDePersonaje | undefined {
    const miembro = this.miembros.get(id);
    if (miembro === undefined) return undefined;
    return miembro.dibujo;
  }

  /** Dónde pisa un personaje, o `undefined` si no está en el escenario. */
  posicionDe(id: string): Punto | undefined {
    const miembro = this.miembros.get(id);
    if (miembro === undefined) return undefined;
    return miembro.posicion;
  }

  mover(id: string, posicion: Punto): void {
    const miembro = this.miembros.get(id);
    if (miembro === undefined) return;
    miembro.posicion = posicion;
    this.escenario.moverPersonaje(id, posicion);
  }

  /**
   * Voltea al personaje hacia un punto. Si el punto está justo enfrente o detrás (misma `x`),
   * el personaje se queda mirando hacia donde miraba.
   */
  mirarHacia(id: string, punto: Punto): void {
    const miembro = this.miembros.get(id);
    if (miembro === undefined) return;

    let miraNueva = miembro.mira;
    if (punto.x > miembro.posicion.x) {
      miraNueva = 'derecha';
    } else if (punto.x < miembro.posicion.x) {
      miraNueva = 'izquierda';
    }

    if (miraNueva !== miembro.mira) {
      miembro.mira = miraNueva;
      this.escenario.voltearPersonaje(id, miraNueva);
    }
  }
}

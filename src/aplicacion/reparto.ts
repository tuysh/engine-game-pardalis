// El reparto: los personajes que están en el escenario, con su posición y hacia dónde miran.
// Es la única fuente de esos datos para la aplicación: el control del jugador, las caminatas
// de los diálogos y los globos preguntan y cambian aquí, y el reparto avisa al escenario.

import type { Punto } from '../dominio/geometria.ts';
import type { Mira } from '../dominio/mundo.ts';
import type { Escenario, PersonajeDeEscena } from '../puertos/escenario.ts';

interface Miembro {
  posicion: Punto;
  mira: Mira;
}

export class Reparto {
  private readonly escenario: Escenario;
  private readonly miembros = new Map<string, Miembro>();

  constructor(escenario: Escenario) {
    this.escenario = escenario;
  }

  /** Pone un personaje en el escenario. Termina cuando su imagen ya cargó. */
  async agregar(personaje: PersonajeDeEscena): Promise<void> {
    this.miembros.set(personaje.id, { posicion: personaje.posicion, mira: personaje.mira });
    await this.escenario.agregarPersonaje(personaje);
  }

  estaEnEscena(id: string): boolean {
    return this.miembros.has(id);
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

// Lleva la partida mientras se juega (docs/DISENO-3.0.md §10): el estado con el que se dejó cada nivel
// y en qué nivel está el jugador.
//
// Desde que un nivel sale hacia otro, la partida ya dice que el jugador está en el nivel de destino,
// aunque ese nivel todavía esté cargando: si el juego se cierra en ese momento, continúa allá
// y no en un nivel intermedio que ya no tiene nada que hacer.

import type { DeclaracionDeEstado, VariablesDeEstado, VariablesSeparadas } from '../dominio/estado.ts';
import { actualizarPartida, conCompartidas, conElJugadorEn, variablesParaJugar } from '../dominio/partida.ts';
import type { Partida } from '../dominio/partida.ts';

export class PartidaEnCurso {
  /** La partida tal como quedó la última vez que se dejó un nivel. `undefined` = todavía no se deja ninguno. */
  private anotada: Partida | undefined;
  /** El nivel hacia el que se está saliendo, mientras carga. `undefined` = no se está saliendo. */
  private destinoDeLaSalida: string | undefined;

  /** `partidaInicial` es la que entregó el host, ya revisada. `undefined` = partida nueva. */
  constructor(partidaInicial: Partida | undefined) {
    this.anotada = partidaInicial;
  }

  /**
   * Las variables con las que un nivel empieza: las que dejó la última vez y las de la aventura que declara
   * en `estado.compartidas`. `undefined` = no hay partida: empieza de cero.
   */
  variablesPara(idDelNivel: string, declaracion: DeclaracionDeEstado): VariablesDeEstado | undefined {
    return variablesParaJugar(this.anotada, idDelNivel, declaracion);
  }

  /**
   * Anota el estado con el que se deja un nivel, para restaurarlo si el jugador vuelve.
   * Si se deja saliendo hacia otro nivel, lo anotado ya nombra ese destino: así, si después ningún nivel
   * logra empezar (ni el destino ni el anterior), la partida no regresa al jugador al nivel que dejó.
   */
  anotarNivel(idDelNivel: string, variables: VariablesSeparadas): void {
    this.anotada = this.nombrarElDestino(this.conElNivel(idDelNivel, variables));
  }

  /** Desde ahora la partida dice que el jugador está en `destino`, aunque ese nivel todavía esté cargando. */
  salirHacia(destino: string): void {
    this.destinoDeLaSalida = destino;
  }

  /** Ya se llegó al destino, o no se pudo llegar: la partida vuelve a nombrar al nivel que se juega. */
  olvidarLaSalida(): void {
    this.destinoDeLaSalida = undefined;
  }

  /** La partida de este momento, con el nivel que se está jugando y sus variables de ahora. */
  leerJugando(idDelNivel: string, variables: VariablesSeparadas): Partida {
    return this.nombrarElDestino(this.conElNivel(idDelNivel, variables));
  }

  /**
   * La partida cuando no hay nivel en juego (se está cambiando de nivel, o el juego ya terminó):
   * es la que se anotó al dejar el último nivel, que ya trae su estado.
   */
  leerSinNivelEnJuego(idDelUltimoNivel: string): Partida {
    if (this.anotada === undefined) {
      return this.nombrarElDestino(actualizarPartida(undefined, idDelUltimoNivel, {}));
    }
    return this.nombrarElDestino(this.anotada);
  }

  /** La partida anotada más ese nivel: sus variables propias en `niveles` y las que comparte en `compartidas`. */
  private conElNivel(idDelNivel: string, variables: VariablesSeparadas): Partida {
    const conLasPropias = actualizarPartida(this.anotada, idDelNivel, variables.propias);
    return conCompartidas(conLasPropias, variables.compartidas);
  }

  private nombrarElDestino(partida: Partida): Partida {
    if (this.destinoDeLaSalida === undefined) return partida;
    return conElJugadorEn(partida, this.destinoDeLaSalida);
  }
}

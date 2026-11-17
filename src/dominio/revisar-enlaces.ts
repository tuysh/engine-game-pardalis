// Revisa los enlaces dentro del contenido de un nivel: que exista todo lo que se nombra.
// Secuencias, hablantes, efectos, minijuegos, y las variables de toda condición y de todo paso `pon`.
//
// No mira el mapa: que un NPC o un punto exista en el mapa se revisa aparte, al cruzar mapa y contenido.

import type { Contenido, Interlocutor } from './contenido.ts';
import type { Diagnostico } from './diagnostico.ts';
import { recorrerPasos } from './recorrer-pasos.ts';
import { revisarCiclosDeSecuencias } from './revisar-ciclos-de-secuencias.ts';
import { revisarCinematicas } from './revisar-cinematicas.ts';
import { revisarPaso } from './revisar-paso.ts';
import { reunirVariablesDeclaradas, revisarCondicion } from './revisar-variables.ts';
import type { Revision } from './revision.ts';

/** Lo que el host registró en `crearEscenario()`. Lo que venga `undefined` no se sabe, así que no se revisa. */
export interface RegistrosDelHost {
  /** Nombres de los minijuegos. */
  readonly minijuegos?: readonly string[];
  /** Nombres de las cinemáticas escritas en código. */
  readonly cinematicas?: readonly string[];
}

/** Anota en `diagnostico` los errores y advertencias de enlaces del contenido. */
export function revisarEnlaces(contenido: Contenido, registros: RegistrosDelHost, diagnostico: Diagnostico): void {
  const revision: Revision = {
    contenido,
    variablesDeclaradas: reunirVariablesDeclaradas(contenido),
    minijuegos: registros.minijuegos,
    cinematicasEnCodigo: registros.cinematicas,
    diagnostico,
  };

  revisarJugador(revision);
  for (const id of Object.keys(contenido.npcs)) {
    revisarRamas(contenido.npcs[id]!, `npcs.${id}`, revision); // `id` viene de `Object.keys`, así que existe
  }
  for (const id of Object.keys(contenido.interactivos)) {
    revisarRamas(contenido.interactivos[id]!, `interactivos.${id}`, revision);
  }
  revisarSalida(revision);
  revisarCinematicas(revision);

  recorrerPasos(contenido, {
    alVerPaso(paso, ruta) {
      revisarPaso(paso, ruta, revision);
    },
    alVerSecuenciaPorNombre(nombre, ruta) {
      if (!Object.hasOwn(contenido.secuencias, nombre)) {
        diagnostico.errores.push(`secuencia "${nombre}" usada en ${ruta} pero no existe en "secuencias"`);
      }
    },
  });

  revisarCiclosDeSecuencias(contenido.secuencias, diagnostico);
}

function revisarJugador(revision: Revision): void {
  const jugador = revision.contenido.jugador;
  if (jugador === undefined) return;

  if (!Object.hasOwn(revision.contenido.meta.personajes, jugador.personaje)) {
    revision.diagnostico.errores.push(`jugador.personaje "${jugador.personaje}" no existe en meta.personajes`);
  }
}

/** Revisa las condiciones de las ramas de un diálogo y avisa de las ramas a las que nunca se llega. */
function revisarRamas(interlocutor: Interlocutor, ruta: string, revision: Revision): void {
  let yaHuboUnaRamaSinCondicion = false;

  for (let i = 0; i < interlocutor.dialogo.length; i++) {
    const rama = interlocutor.dialogo[i]!; // `i` es menor que el largo de la lista
    const rutaDeLaRama = `${ruta}.dialogo[${i}]`;

    // Una rama sin condición siempre se cumple: las que vienen después nunca se usan.
    if (yaHuboUnaRamaSinCondicion) {
      revision.diagnostico.advertencias.push(
        `${rutaDeLaRama}: rama inalcanzable, hay una rama sin "cuando" antes; deja la rama sin "cuando" al final`,
      );
    }
    if (rama.condicion === undefined) {
      yaHuboUnaRamaSinCondicion = true;
    }
    revisarCondicion(rama.condicion, rutaDeLaRama, revision);
  }
}

function revisarSalida(revision: Revision): void {
  const salida = revision.contenido.salida;
  if (salida === undefined) return;

  revisarCondicion(salida.requiere, 'salida.requiere', revision);
  if (salida.flecha !== undefined) {
    revisarCondicion(salida.flecha.visibleCuando, 'salida.flecha.visibleCuando', revision);
  }
}

// Revisa la sección `cinematicas` del contenido (docs/DISENO-3.0.md §7):
// - lo que la hace empezar existe (el objetivo; la zona se revisa aparte, contra el mapa);
// - su condición usa variables declaradas;
// - si está escrita en código, el host la registró;
// - no lleva pasos que necesitan al jugador (`elige`, `juego`), ni directo ni dentro de una secuencia.

import type { Cinematica } from './contenido.ts';
import type { Paso } from './paso.ts';
import { revisarCondicion } from './revisar-variables.ts';
import type { Revision } from './revision.ts';

/** Los pasos que no caben en una cinemática: necesitan que el jugador haga algo. */
const PASOS_QUE_PIDEN_AL_JUGADOR: readonly string[] = ['elige', 'juego'];

export function revisarCinematicas(revision: Revision): void {
  const cinematicas = revision.contenido.cinematicas;
  for (const id of Object.keys(cinematicas)) {
    revisarCinematica(cinematicas[id]!, `cinematicas.${id}`, revision); // `id` viene de `Object.keys`
  }
}

function revisarCinematica(cinematica: Cinematica, ruta: string, revision: Revision): void {
  const errores = revision.diagnostico.errores;
  const contenido = revision.contenido;

  if (cinematica.inicio.tipo === 'objetivo' && !contenido.estado.objetivos.includes(cinematica.inicio.objetivo)) {
    errores.push(`${ruta}.inicia: el objetivo "${cinematica.inicio.objetivo}" no está en estado.objetivos`);
  }
  revisarCondicion(cinematica.condicion, `${ruta}.cuando`, revision);

  const guion = cinematica.guion;
  switch (guion.tipo) {
    case 'codigo': {
      const registradas = revision.cinematicasEnCodigo;
      if (registradas !== undefined && !registradas.includes(guion.nombre)) {
        errores.push(
          `${ruta}.codigo: la cinemática en código "${guion.nombre}" no está registrada en el host ("cinematicas")`,
        );
      }
      break;
    }
    case 'pasos':
      for (let i = 0; i < guion.pasos.length; i++) {
        const paso = guion.pasos[i]!; // `i` es menor que el largo de la lista
        const pasoProhibido = buscarPasoQuePideAlJugador(paso, { revision, secuenciasVistas: [] });
        if (pasoProhibido !== undefined) {
          errores.push(
            `${ruta}.pasos[${i}]: una cinemática no puede llevar "${pasoProhibido}", que necesita al jugador`,
          );
        }
      }
      break;
  }
}

/** Lo que acompaña a la búsqueda mientras baja por los pasos. */
interface Busqueda {
  readonly revision: Revision;
  /** Las secuencias por las que ya se pasó: evita dar vueltas sin fin si dos secuencias se llaman entre sí. */
  readonly secuenciasVistas: readonly string[];
}

/**
 * Busca, en un paso y en todo lo que lleva dentro (también las secuencias que llama), un paso que pide
 * al jugador. Devuelve su nombre (`'elige'` o `'juego'`), o `undefined` si no hay ninguno.
 */
function buscarPasoQuePideAlJugador(paso: Paso, busqueda: Busqueda): string | undefined {
  if (PASOS_QUE_PIDEN_AL_JUGADOR.includes(paso.tipo)) return paso.tipo;

  switch (paso.tipo) {
    case 'condicional':
    case 'juntos':
      return buscarEnLista(paso.pasos, busqueda);
    case 'secuencia':
      return buscarEnSecuencia(paso.nombre, busqueda);
    default:
      return undefined; // los demás pasos no llevan otros pasos dentro
  }
}

function buscarEnLista(pasos: readonly Paso[], busqueda: Busqueda): string | undefined {
  for (const paso of pasos) {
    const encontrado = buscarPasoQuePideAlJugador(paso, busqueda);
    if (encontrado !== undefined) return encontrado;
  }
  return undefined;
}

function buscarEnSecuencia(nombre: string, busqueda: Busqueda): string | undefined {
  const secuencias = busqueda.revision.contenido.secuencias;
  // Una secuencia que no existe ya se reporta en revisar-enlaces.ts; una ya vista no se vuelve a recorrer.
  if (!Object.hasOwn(secuencias, nombre) || busqueda.secuenciasVistas.includes(nombre)) return undefined;

  const pasos = secuencias[nombre]!; // `hasOwn` acaba de comprobar que existe
  return buscarEnLista(pasos, { ...busqueda, secuenciasVistas: [...busqueda.secuenciasVistas, nombre] });
}

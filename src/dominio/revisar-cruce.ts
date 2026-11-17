// Cruza el mapa (el DÓNDE) con el contenido (el QUÉ PASA): lo que uno nombra debe existir en el otro.
//
// - Cada NPC del mapa es un personaje del contenido. Su diálogo es opcional: sin él, no se puede tocar.
// - Cada diálogo de `npcs` e `interactivos` tiene su objeto en el mapa, y cada objeto interactivo su diálogo.
// - Hay piso, y si el nivel tiene jugador, exactamente un inicio dentro del piso.
// - Los puntos de los pasos `camina`, los grupos de las zonas y la salida existen en los dos lados.

import type { Contenido } from './contenido.ts';
import type { Diagnostico } from './diagnostico.ts';
import { puntoDentroDePoligono } from './geometria.ts';
import type { Mundo } from './mundo.ts';
import type { PasoDeCaminata } from './paso.ts';
import { recorrerPasos } from './recorrer-pasos.ts';

export function revisarCruce(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  revisarNpcs(contenido, mundo, diagnostico);
  revisarInteractivos(contenido, mundo, diagnostico);
  revisarPisoEInicio(contenido, mundo, diagnostico);
  revisarZonas(contenido, mundo, diagnostico);
  revisarSalida(contenido, mundo, diagnostico);

  recorrerPasos(contenido, {
    alVerPaso(paso, ruta) {
      if (paso.tipo === 'camina') {
        revisarCaminata(paso, ruta, contenido, mundo, diagnostico);
      }
    },
    alVerSecuenciaPorNombre() {
      // Una secuencia por nombre no nombra nada del mapa: sus pasos ya se recorren en `secuencias`.
    },
  });
}

function revisarNpcs(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  for (const id of Object.keys(mundo.npcs)) {
    if (!Object.hasOwn(contenido.meta.personajes, id)) {
      const npc = mundo.npcs[id]!; // `id` viene de `Object.keys`, así que existe
      diagnostico.errores.push(`mapa: ${npc.descripcion} (npc) tiene id "${id}", que no existe en meta.personajes`);
    }
  }
  for (const id of Object.keys(contenido.npcs)) {
    if (!Object.hasOwn(mundo.npcs, id)) {
      diagnostico.errores.push(`npcs.${id} no tiene un objeto con ese id en la capa "npcs" del mapa`);
    }
  }
}

function revisarInteractivos(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  const idsEnElMapa = new Set<string>();

  for (const objeto of mundo.decorado) {
    if (objeto.id === undefined) continue;
    if (idsEnElMapa.has(objeto.id)) {
      diagnostico.errores.push(`mapa: ${objeto.descripcion} (decorado) repite el id "${objeto.id}" de otro objeto`);
    }
    idsEnElMapa.add(objeto.id);
    if (!Object.hasOwn(contenido.interactivos, objeto.id)) {
      diagnostico.errores.push(
        `mapa: ${objeto.descripcion} (decorado) tiene id "${objeto.id}", que no existe en interactivos`,
      );
    }
  }
  for (const id of Object.keys(contenido.interactivos)) {
    if (!idsEnElMapa.has(id)) {
      diagnostico.errores.push(`interactivos.${id} no tiene un objeto con ese id en la capa "decorado" del mapa`);
    }
  }
}

function revisarPisoEInicio(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  if (mundo.pisos.length === 0) {
    diagnostico.errores.push('mapa: la capa "piso" necesita al menos un polígono por donde caminar');
  }

  const inicios = mundo.iniciosDelJugador;
  if (contenido.jugador === undefined) {
    if (inicios.length > 0) {
      diagnostico.advertencias.push('mapa: hay un objeto inicioJugador, pero el contenido no tiene "jugador"; se ignora');
    }
    return;
  }

  if (inicios.length !== 1) {
    diagnostico.errores.push(
      `mapa: el nivel tiene jugador, así que la capa "interaccion" necesita exactamente un objeto de clase ` +
        `inicioJugador (hay ${inicios.length})`,
    );
    return;
  }
  const inicio = inicios[0]!; // acabamos de comprobar que hay exactamente uno
  const estaSobreElPiso = mundo.pisos.some((piso) => puntoDentroDePoligono(inicio.posicion, piso));
  if (!estaSobreElPiso) {
    diagnostico.errores.push(
      `mapa: ${inicio.descripcion} (inicioJugador) debe estar dentro de un polígono de la capa "piso"`,
    );
  }
}

function revisarZonas(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  for (const nombre of Object.keys(mundo.zonas)) {
    const zona = mundo.zonas[nombre]!; // `nombre` viene de `Object.keys`, así que existe
    if (zona.grupo !== undefined && !Object.hasOwn(contenido.comentarios, zona.grupo)) {
      diagnostico.errores.push(
        `mapa: ${zona.descripcion} (zona) usa el grupo "${zona.grupo}", que no existe en comentarios`,
      );
    }
  }
}

function revisarSalida(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  if (contenido.salida !== undefined && mundo.salida === undefined) {
    diagnostico.errores.push('salida: falta un objeto de clase salida en la capa "interaccion" del mapa');
  }
  if (contenido.salida === undefined && mundo.salida !== undefined) {
    diagnostico.advertencias.push(
      `mapa: ${mundo.salida.descripcion} (salida) no hace nada: el contenido no tiene la sección "salida"`,
    );
  }
}

/** El destino de una caminata es un punto del mapa, y quien camina está en el escenario. */
function revisarCaminata(
  paso: PasoDeCaminata,
  ruta: string,
  contenido: Contenido,
  mundo: Mundo,
  diagnostico: Diagnostico,
): void {
  if (!Object.hasOwn(mundo.puntos, paso.punto)) {
    diagnostico.errores.push(`camina "${paso.punto}" en ${ruta}: no hay un punto con ese nombre en el mapa`);
  }

  // Sin `quien` camina el jugador; que el nivel tenga jugador ya lo revisó la fase de enlaces.
  if (paso.personaje === undefined) return;
  const esElJugador = contenido.jugador !== undefined && contenido.jugador.personaje === paso.personaje;
  const esUnNpcDelMapa = Object.hasOwn(mundo.npcs, paso.personaje);
  if (!esElJugador && !esUnNpcDelMapa) {
    diagnostico.errores.push(
      `camina en ${ruta}: "${paso.personaje}" no está en el escenario: no es el jugador ni un NPC del mapa`,
    );
  }
}

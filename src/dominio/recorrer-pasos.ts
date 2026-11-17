// Recorre todos los pasos de un contenido, incluidos los que están dentro de otros pasos.
// Así cada revisión solo dice qué mirar en cada paso, no cómo encontrarlos.
//
// Las rutas usan los nombres del archivo de contenido (por ejemplo "npcs.tortu.dialogo[1].dice[2]"),
// para que los mensajes de error apunten a lo que escribió quien hizo el nivel.

import type { Contenido, Interlocutor } from './contenido.ts';
import type { Paso, PasosOSecuencia } from './paso.ts';

/** Lo que quiere saber quien recorre los pasos. */
export interface VisitanteDePasos {
  /** Se llama una vez por cada paso. */
  alVerPaso(paso: Paso, ruta: string): void;
  /** Se llama cada vez que un lugar usa una secuencia por su nombre. */
  alVerSecuenciaPorNombre(nombre: string, ruta: string): void;
}

export function recorrerPasos(contenido: Contenido, visitante: VisitanteDePasos): void {
  for (const nombre of Object.keys(contenido.secuencias)) {
    const pasos = contenido.secuencias[nombre]!; // `nombre` viene de `Object.keys`, así que existe
    recorrerLista(pasos, `secuencias.${nombre}`, visitante);
  }

  for (const id of Object.keys(contenido.npcs)) {
    recorrerInterlocutor(contenido.npcs[id]!, `npcs.${id}`, visitante);
  }
  for (const id of Object.keys(contenido.interactivos)) {
    recorrerInterlocutor(contenido.interactivos[id]!, `interactivos.${id}`, visitante);
  }

  for (const grupo of Object.keys(contenido.comentarios)) {
    recorrerLista(contenido.comentarios[grupo]!, `comentarios.${grupo}`, visitante);
  }

  if (contenido.salida !== undefined && contenido.salida.siBloqueada !== undefined) {
    recorrerPasosOSecuencia(contenido.salida.siBloqueada, 'salida.siBloqueada', visitante);
  }

  for (const id of Object.keys(contenido.cinematicas)) {
    const guion = contenido.cinematicas[id]!.guion; // `id` viene de `Object.keys`, así que existe
    // Una cinemática escrita en código no tiene pasos en el nivel que recorrer.
    if (guion.tipo === 'pasos') {
      recorrerLista(guion.pasos, `cinematicas.${id}.pasos`, visitante);
    }
  }
}

function recorrerInterlocutor(interlocutor: Interlocutor, ruta: string, visitante: VisitanteDePasos): void {
  for (let i = 0; i < interlocutor.dialogo.length; i++) {
    const rama = interlocutor.dialogo[i]!; // `i` es menor que el largo de la lista
    recorrerLista(rama.pasos, `${ruta}.dialogo[${i}].dice`, visitante);
  }
  if (interlocutor.alVolver !== undefined) {
    recorrerPasosOSecuencia(interlocutor.alVolver.siLogrado, `${ruta}.alVolver.siLogrado`, visitante);
    recorrerPasosOSecuencia(interlocutor.alVolver.siNo, `${ruta}.alVolver.siNo`, visitante);
  }
}

function recorrerLista(pasos: readonly Paso[], ruta: string, visitante: VisitanteDePasos): void {
  for (let i = 0; i < pasos.length; i++) {
    recorrerPaso(pasos[i]!, `${ruta}[${i}]`, visitante); // `i` es menor que el largo de la lista
  }
}

function recorrerPasosOSecuencia(valor: PasosOSecuencia, ruta: string, visitante: VisitanteDePasos): void {
  switch (valor.tipo) {
    case 'secuencia':
      visitante.alVerSecuenciaPorNombre(valor.nombre, ruta);
      break;
    case 'pasos':
      recorrerLista(valor.pasos, ruta, visitante);
      break;
  }
}

function recorrerPaso(paso: Paso, ruta: string, visitante: VisitanteDePasos): void {
  visitante.alVerPaso(paso, ruta);

  switch (paso.tipo) {
    case 'condicional':
      recorrerLista(paso.pasos, `${ruta}.dice`, visitante);
      break;

    case 'elige':
      for (let i = 0; i < paso.opciones.length; i++) {
        const opcion = paso.opciones[i]!; // `i` es menor que el largo de la lista
        recorrerPasosOSecuencia(opcion.alElegir, `${ruta}.opciones[${i}].secuencia`, visitante);
      }
      break;

    case 'secuencia':
      visitante.alVerSecuenciaPorNombre(paso.nombre, ruta);
      break;

    case 'juntos':
      recorrerLista(paso.pasos, `${ruta}.juntos`, visitante);
      break;

    case 'linea':
    case 'efecto':
    case 'pon':
    case 'juego':
    case 'camina':
    case 'espera':
    case 'camara':
    case 'mira':
    case 'anima':
    case 'aparece':
    case 'desaparece':
    case 'musica':
    case 'sonido':
    case 'fundido':
    case 'video':
    case 'sale':
      break; // estos pasos no llevan otros pasos dentro
  }
}

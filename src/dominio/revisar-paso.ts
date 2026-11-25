// Revisa un paso de diálogo: que exista todo lo que nombra (hablante, efecto, minijuego, variables).
// Las secuencias por nombre no se revisan aquí, sino en revisar-enlaces.ts, porque también
// se usan desde lugares que no son pasos (por ejemplo, `salida.siBloqueada`).

import type { Paso, PasoDeCaminata, PasoDeEleccion, PasoDeLinea } from './paso.ts';
import { EFECTOS_DISPONIBLES } from './paso.ts';
import { revisarPasoDeEscena } from './revisar-paso-de-escena.ts';
import { revisarCondicion, revisarVariableDePon } from './revisar-variables.ts';
import type { Revision } from './revision.ts';
import { variablesDesconocidasEn } from './texto-con-variables.ts';

export function revisarPaso(paso: Paso, ruta: string, revision: Revision): void {
  const errores = revision.diagnostico.errores;

  switch (paso.tipo) {
    case 'linea':
      revisarLinea(paso, ruta, revision);
      break;

    case 'elige':
      revisarEleccion(paso, ruta, revision);
      break;

    case 'efecto':
      if (!EFECTOS_DISPONIBLES.includes(paso.nombre)) {
        const disponibles = EFECTOS_DISPONIBLES.join(', ');
        errores.push(`efecto "${paso.nombre}" en ${ruta} no existe; los disponibles son: ${disponibles}`);
      }
      break;

    case 'pon':
      for (const nombre of Object.keys(paso.valores)) {
        revisarVariableDePon(nombre, ruta, revision);
      }
      break;

    case 'juego':
      if (revision.minijuegos !== undefined && !revision.minijuegos.includes(paso.nombre)) {
        errores.push(`minijuego "${paso.nombre}" usado en ${ruta} pero el host no lo registró en "minijuegos"`);
      }
      break;

    case 'camina':
      revisarCaminata(paso, ruta, revision);
      break;

    case 'condicional':
      revisarCondicion(paso.condicion, ruta, revision);
      break;

    case 'secuencia':
      break; // el nombre de la secuencia se revisa en revisar-enlaces.ts

    default:
      revisarPasoDeEscena(paso, ruta, revision);
  }
}

function revisarLinea(paso: PasoDeLinea, ruta: string, revision: Revision): void {
  if (!Object.hasOwn(revision.contenido.meta.personajes, paso.hablante)) {
    revision.diagnostico.errores.push(`${ruta}: el hablante "${paso.hablante}" no existe en meta.personajes`);
  }
  for (const personaje of Object.keys(paso.reacciones ?? {})) {
    if (!Object.hasOwn(revision.contenido.meta.personajes, personaje)) {
      revision.diagnostico.errores.push(`${ruta}.reacciona: el personaje "${personaje}" no existe en meta.personajes`);
    }
  }
  revisarVariablesDeTexto(paso.texto, ruta, revision);
}

function revisarEleccion(paso: PasoDeEleccion, ruta: string, revision: Revision): void {
  revisarVariablesDeTexto(paso.pregunta, ruta, revision);

  let todasTienenCondicion = true;
  for (let i = 0; i < paso.opciones.length; i++) {
    const opcion = paso.opciones[i]!; // `i` es menor que el largo de la lista
    const rutaDeLaOpcion = `${ruta}.opciones[${i}]`;

    revisarCondicion(opcion.condicion, rutaDeLaOpcion, revision);
    if (opcion.condicion === undefined) {
      todasTienenCondicion = false;
    }
    if (opcion.imagen === undefined) {
      revision.diagnostico.advertencias.push(
        `${rutaDeLaOpcion}: opción sin "imagen"; quien todavía no lee no puede distinguirla`,
      );
    }
  }

  if (todasTienenCondicion) {
    revision.diagnostico.advertencias.push(
      `${ruta}: todas las opciones tienen "cuando"; si ninguna se cumple, el paso se salta`,
    );
  }
}

function revisarCaminata(paso: PasoDeCaminata, ruta: string, revision: Revision): void {
  const errores = revision.diagnostico.errores;
  const contenido = revision.contenido;

  if (paso.personaje === undefined) {
    if (contenido.jugador === undefined) {
      errores.push(`camina en ${ruta}: el nivel no tiene jugador; indica quién camina con "quien"`);
    }
    return;
  }
  if (!Object.hasOwn(contenido.meta.personajes, paso.personaje)) {
    errores.push(`camina en ${ruta}: "quien": "${paso.personaje}" no existe en meta.personajes`);
  }
}

function revisarVariablesDeTexto(texto: string, ruta: string, revision: Revision): void {
  for (const nombre of variablesDesconocidasEn(texto)) {
    revision.diagnostico.errores.push(
      `${ruta}: el texto usa {${nombre}}, que no existe; se puede usar {faltan} y {dinero}`,
    );
  }
}

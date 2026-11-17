// Cruza con el mapa lo que nombran los pasos de escena, los planos de cámara y las cinemáticas:
// - el punto donde alguien aparece, y hacia dónde voltea alguien;
// - a qué apunta cada plano de cámara;
// - la zona que hace empezar una cinemática;
// - que todo personaje al que se mueve, voltea o anima esté alguna vez en el escenario.

import type { Contenido } from './contenido.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Mundo } from './mundo.ts';
import type { Paso } from './paso.ts';
import { recorrerPasos } from './recorrer-pasos.ts';

/** Lo que comparten las revisiones de este archivo. */
interface CruceDeEscena {
  readonly contenido: Contenido;
  readonly mundo: Mundo;
  /** Los personajes que están en el escenario en algún momento del nivel. */
  readonly personajesEnEscena: ReadonlySet<string>;
  readonly diagnostico: Diagnostico;
}

export function revisarCruceDeEscena(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  const cruce: CruceDeEscena = {
    contenido,
    mundo,
    personajesEnEscena: reunirPersonajesEnEscena(contenido, mundo),
    diagnostico,
  };

  revisarPlanos(cruce);
  revisarZonasDeCinematicas(cruce);
  recorrerPasos(contenido, {
    alVerPaso(paso, ruta) {
      revisarPaso(paso, ruta, cruce);
    },
    alVerSecuenciaPorNombre() {
      // Una secuencia por nombre no nombra nada del mapa: sus pasos ya se recorren en `secuencias`.
    },
  });
}

/** Están en el escenario: el jugador, los NPCs del mapa y quien entre con un paso `aparece`. */
function reunirPersonajesEnEscena(contenido: Contenido, mundo: Mundo): Set<string> {
  const enEscena = new Set<string>(Object.keys(mundo.npcs));
  if (contenido.jugador !== undefined) {
    enEscena.add(contenido.jugador.personaje);
  }
  recorrerPasos(contenido, {
    alVerPaso(paso) {
      if (paso.tipo === 'aparece') {
        enEscena.add(paso.personaje);
      }
    },
    alVerSecuenciaPorNombre() {
      // No hace falta: los pasos de cada secuencia ya se recorren.
    },
  });
  return enEscena;
}

function revisarPlanos(cruce: CruceDeEscena): void {
  const planos = cruce.contenido.mundo.planos;
  for (const nombre of Object.keys(planos)) {
    const mira = planos[nombre]!.mira; // `nombre` viene de `Object.keys`, así que existe
    const esUnPersonaje = Object.hasOwn(cruce.contenido.meta.personajes, mira);
    const esUnPunto = Object.hasOwn(cruce.mundo.puntos, mira);
    const esUnObjeto = cruce.mundo.decorado.some((objeto) => objeto.id === mira);
    if (!esUnPersonaje && !esUnPunto && !esUnObjeto) {
      cruce.diagnostico.errores.push(
        `mundo.planos.${nombre}.mira: "${mira}" no es un personaje, ni un punto del mapa, ` +
          'ni un objeto del decorado con id',
      );
    }
  }
}

function revisarZonasDeCinematicas(cruce: CruceDeEscena): void {
  const cinematicas = cruce.contenido.cinematicas;
  for (const id of Object.keys(cinematicas)) {
    const inicio = cinematicas[id]!.inicio; // `id` viene de `Object.keys`, así que existe
    if (inicio.tipo === 'zona' && !Object.hasOwn(cruce.mundo.zonas, inicio.zona)) {
      cruce.diagnostico.errores.push(`cinematicas.${id}.inicia: no hay una zona llamada "${inicio.zona}" en el mapa`);
    }
  }
}

function revisarPaso(paso: Paso, ruta: string, cruce: CruceDeEscena): void {
  const errores = cruce.diagnostico.errores;

  switch (paso.tipo) {
    case 'camina':
      // Sin `quien` camina el jugador, que siempre está en el escenario.
      if (paso.personaje !== undefined) {
        revisarQueEsteEnEscena(paso.personaje, ruta, cruce);
      }
      break;

    case 'aparece':
      if (!Object.hasOwn(cruce.mundo.puntos, paso.punto)) {
        errores.push(`aparece "${paso.personaje}" en ${ruta}: no hay un punto llamado "${paso.punto}" en el mapa`);
      }
      break;

    case 'mira': {
      revisarQueEsteEnEscena(paso.personaje, ruta, cruce);
      const miraAUnPersonaje = Object.hasOwn(cruce.contenido.meta.personajes, paso.hacia);
      const miraAUnPunto = Object.hasOwn(cruce.mundo.puntos, paso.hacia);
      if (!miraAUnPersonaje && !miraAUnPunto) {
        errores.push(`mira en ${ruta}: "hacia": "${paso.hacia}" no es un personaje ni un punto del mapa`);
      }
      break;
    }

    case 'anima':
    case 'desaparece':
      revisarQueEsteEnEscena(paso.personaje, ruta, cruce);
      break;

    default:
      break; // los demás pasos no nombran nada que se cruce aquí con el mapa
  }
}

function revisarQueEsteEnEscena(personaje: string, ruta: string, cruce: CruceDeEscena): void {
  // Un personaje que no existe ya se reporta en la fase de enlaces; aquí solo se revisa a los que sí existen.
  if (!Object.hasOwn(cruce.contenido.meta.personajes, personaje)) return;
  if (cruce.personajesEnEscena.has(personaje)) return;

  cruce.diagnostico.errores.push(
    `${ruta}: "${personaje}" nunca está en el escenario: no es el jugador, ni un NPC del mapa, ` +
      'ni entra con un paso "aparece"',
  );
}

// Convierte las capas del mapa que dicen dónde pasan las cosas: `npcs` e `interaccion`
// (inicio del jugador, puntos con nombre, salida y zonas).

import type { Punto } from '../../dominio/geometria.ts';
import { ESPERA_DE_ZONA_POR_DEFECTO_EN_SEGUNDOS } from '../../dominio/mundo.ts';
import type { LugarDePersonaje, SalidaDelMapa, Zona } from '../../dominio/mundo.ts';
import {
  anotarError,
  esCapaDeObjetos,
  formaEnMetros,
  leerMira,
  numeroDePropiedad,
  posicionEnMetros,
  textoDePropiedad,
} from './conversion.ts';
import type { Conversion } from './conversion.ts';
import type { CapaDeTiled, ObjetoDeTiled } from './mapa-de-tiled.ts';

/** Lo que sale de la capa `interaccion`. Los campos se van llenando al recorrer sus objetos. */
export interface LugaresDeInteraccion {
  readonly iniciosDelJugador: LugarDePersonaje[];
  readonly puntos: Record<string, Punto>;
  readonly zonas: Record<string, Zona>;
  salida: SalidaDelMapa | undefined;
}

const CLASES_DE_INTERACCION = 'inicioJugador, punto, salida, zona';

/** Cada objeto de `npcs` es un personaje: su posición, la propiedad `id` y, opcional, `mira`. */
export function convertirNpcs(capa: CapaDeTiled, conversion: Conversion): Record<string, LugarDePersonaje> {
  const npcs: Record<string, LugarDePersonaje> = {};
  if (!esCapaDeObjetos(capa, conversion)) return npcs;

  for (const objeto of capa.objetos) {
    const id = textoDePropiedad(objeto.propiedades, 'id');
    if (id === undefined) {
      anotarError(objeto, capa, 'falta la propiedad "id" con el id de su personaje', conversion);
      continue;
    }
    if (Object.hasOwn(npcs, id)) {
      anotarError(objeto, capa, `ya hay otro NPC con el id "${id}"`, conversion);
      continue;
    }
    npcs[id] = {
      descripcion: objeto.descripcion,
      posicion: posicionEnMetros(objeto, conversion),
      mira: leerMira(objeto, capa, conversion),
    };
  }
  return npcs;
}

/** En `interaccion`, la clase de cada objeto dice qué es. */
export function convertirInteraccion(capa: CapaDeTiled, conversion: Conversion): LugaresDeInteraccion {
  const lugares: LugaresDeInteraccion = { iniciosDelJugador: [], puntos: {}, zonas: {}, salida: undefined };
  if (!esCapaDeObjetos(capa, conversion)) return lugares;

  for (const objeto of capa.objetos) {
    switch (objeto.clase) {
      case 'inicioJugador':
        lugares.iniciosDelJugador.push({
          descripcion: objeto.descripcion,
          posicion: posicionEnMetros(objeto, conversion),
          mira: leerMira(objeto, capa, conversion),
        });
        break;
      case 'punto':
        agregarPunto(objeto, capa, lugares, conversion);
        break;
      case 'salida':
        agregarSalida(objeto, capa, lugares, conversion);
        break;
      case 'zona':
        agregarZona(objeto, capa, lugares, conversion);
        break;
      default:
        anotarError(
          objeto,
          capa,
          `la clase "${objeto.clase}" no existe; las clases de esta capa son: ${CLASES_DE_INTERACCION}`,
          conversion,
        );
    }
  }
  return lugares;
}

function agregarPunto(
  objeto: ObjetoDeTiled,
  capa: CapaDeTiled,
  lugares: LugaresDeInteraccion,
  conversion: Conversion,
): void {
  if (!esNombreUsable(objeto.nombre)) {
    anotarError(objeto, capa, 'un punto necesita nombre: es como lo usan los pasos "camina"', conversion);
    return;
  }
  if (Object.hasOwn(lugares.puntos, objeto.nombre)) {
    anotarError(objeto, capa, `ya hay otro punto llamado "${objeto.nombre}"`, conversion);
    return;
  }
  lugares.puntos[objeto.nombre] = posicionEnMetros(objeto, conversion);
}

function agregarSalida(
  objeto: ObjetoDeTiled,
  capa: CapaDeTiled,
  lugares: LugaresDeInteraccion,
  conversion: Conversion,
): void {
  if (lugares.salida !== undefined) {
    anotarError(objeto, capa, 'solo puede haber una salida en el mapa', conversion);
    return;
  }
  const forma = formaEnMetros(objeto, conversion);
  if (forma === undefined) {
    anotarError(objeto, capa, 'la salida se dibuja como un rectángulo o un polígono', conversion);
    return;
  }
  lugares.salida = { descripcion: objeto.descripcion, forma };
}

function agregarZona(
  objeto: ObjetoDeTiled,
  capa: CapaDeTiled,
  lugares: LugaresDeInteraccion,
  conversion: Conversion,
): void {
  if (!esNombreUsable(objeto.nombre)) {
    anotarError(objeto, capa, 'una zona necesita nombre', conversion);
    return;
  }
  if (Object.hasOwn(lugares.zonas, objeto.nombre)) {
    anotarError(objeto, capa, `ya hay otra zona llamada "${objeto.nombre}"`, conversion);
    return;
  }
  const forma = formaEnMetros(objeto, conversion);
  if (forma === undefined) {
    anotarError(objeto, capa, 'una zona se dibuja como un rectángulo o un polígono', conversion);
    return;
  }

  let esperaEnSegundos = ESPERA_DE_ZONA_POR_DEFECTO_EN_SEGUNDOS;
  const esperaDelMapa = numeroDePropiedad(objeto.propiedades, 'espera');
  if (esperaDelMapa !== undefined && esperaDelMapa >= 0) {
    esperaEnSegundos = esperaDelMapa;
  }

  lugares.zonas[objeto.nombre] = {
    descripcion: objeto.descripcion,
    forma,
    grupo: textoDePropiedad(objeto.propiedades, 'grupo'),
    esperaEnSegundos,
  };
}

/** Un nombre sirve como clave si no está vacío y no es "__proto__" (que cambiaría el prototipo del objeto). */
function esNombreUsable(nombre: string): boolean {
  return nombre !== '' && nombre !== '__proto__';
}

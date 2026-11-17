// Convierte un mapa de Tiled (.tmj) en el `Mundo` del dominio (docs/DISENO-3.0.md §9.1).
// El mapa es el plano del lugar visto desde arriba; cada capa se reconoce por su nombre exacto:
//
//   suelo         capa de imagen     la textura del piso
//   telones       capa de objetos    líneas donde se levanta un fondo vertical
//   decorado      capa de objetos    rectángulos: la huella de cada objeto
//   npcs          capa de objetos    un objeto por personaje
//   interaccion   capa de objetos    inicioJugador, punto, salida, zona
//   piso          capa de objetos    polígonos por donde se puede caminar
//
// Cualquier otra capa da una advertencia, salvo que lleve la propiedad `ignorar` = true (notas del equipo).

import type { Diagnostico } from '../../dominio/diagnostico.ts';
import type { Punto } from '../../dominio/geometria.ts';
import type { Decorado, LugarDePersonaje, Mundo, Suelo, Telon } from '../../dominio/mundo.ts';
import type { LectorDeMapas } from '../../puertos/lector-de-mapas.ts';
import { aMetros } from './conversion.ts';
import type { Conversion } from './conversion.ts';
import { convertirDecorado, convertirPisos, convertirSuelo, convertirTelones } from './convertir-escenografia.ts';
import { convertirInteraccion, convertirNpcs } from './convertir-lugares.ts';
import type { LugaresDeInteraccion } from './convertir-lugares.ts';
import { leerMapaDeTiled } from './mapa-de-tiled.ts';
import type { CapaDeTiled } from './mapa-de-tiled.ts';

export class LectorDeMapasDeTiled implements LectorDeMapas {
  leerMundo(json: unknown, pixelesPorMetro: number, diagnostico: Diagnostico): Mundo | undefined {
    const mapa = leerMapaDeTiled(json);
    if (mapa === undefined) {
      diagnostico.errores.push(
        'mapa: el archivo no es un mapa de Tiled en formato JSON: le falta la lista "layers"; ' +
          'en Tiled, guárdalo con «Guardar como» y el formato .tmj',
      );
      return undefined;
    }
    const conversion: Conversion = { pixelesPorMetro, diagnostico };

    let suelo: Suelo | undefined;
    let telones: Telon[] = [];
    let decorado: Decorado[] = [];
    let npcs: Record<string, LugarDePersonaje> = {};
    let pisos: Punto[][] = [];
    let lugares: LugaresDeInteraccion = { iniciosDelJugador: [], puntos: {}, zonas: {}, salida: undefined };

    for (const capa of mapa.capas) {
      switch (capa.nombre) {
        case 'suelo':
          suelo = convertirSuelo(capa, conversion);
          break;
        case 'telones':
          telones = convertirTelones(capa, conversion);
          break;
        case 'decorado':
          decorado = convertirDecorado(capa, conversion);
          break;
        case 'npcs':
          npcs = convertirNpcs(capa, conversion);
          break;
        case 'interaccion':
          lugares = convertirInteraccion(capa, conversion);
          break;
        case 'piso':
          pisos = convertirPisos(capa, conversion);
          break;
        default:
          avisarCapaDesconocida(capa, diagnostico);
      }
    }

    return {
      anchoEnMetros: aMetros(mapa.anchoEnPixeles, conversion),
      profundidadEnMetros: aMetros(mapa.altoEnPixeles, conversion),
      suelo,
      telones,
      decorado,
      npcs,
      iniciosDelJugador: lugares.iniciosDelJugador,
      puntos: lugares.puntos,
      salida: lugares.salida,
      zonas: lugares.zonas,
      pisos,
    };
  }
}

function avisarCapaDesconocida(capa: CapaDeTiled, diagnostico: Diagnostico): void {
  const seIgnoraAProposito = Object.hasOwn(capa.propiedades, 'ignorar') && capa.propiedades['ignorar'] === true;
  if (seIgnoraAProposito) return;

  diagnostico.advertencias.push(
    `mapa: la capa "${capa.nombre}" no es una de las que usa el motor ` +
      '(suelo, telones, decorado, npcs, interaccion, piso) y se ignora; ' +
      'si es a propósito, ponle la propiedad booleana "ignorar" marcada',
  );
}

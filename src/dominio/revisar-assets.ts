// Cruza el contenido de un nivel con sus assets: revisa que exista cada imagen y cada voz que se nombra.
//
// - Una imagen que falta es un error: el nivel no puede dibujarse.
// - Una voz que falta es una advertencia: el motor usa voz sintetizada (nada requiere leer).
// - Una clave que existe pero es de otro tipo (una imagen donde va un audio) es un error.

import type { AssetsDeNivel } from './assets-de-nivel.ts';
import type { Contenido } from './contenido.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Asset } from './manifiesto.ts';
import type { Paso } from './paso.ts';
import { recorrerPasos } from './recorrer-pasos.ts';

/** Lo que comparten las revisiones de este archivo. */
interface RevisionDeAssets {
  readonly assets: AssetsDeNivel;
  readonly diagnostico: Diagnostico;
}

export function revisarAssets(contenido: Contenido, assets: AssetsDeNivel, diagnostico: Diagnostico): void {
  const revision: RevisionDeAssets = { assets, diagnostico };

  for (const id of Object.keys(contenido.meta.personajes)) {
    const personaje = contenido.meta.personajes[id]!; // `id` viene de `Object.keys`, así que existe
    revisarImagen(personaje.sprite, `meta.personajes.${id}.sprite`, revision);
  }

  recorrerPasos(contenido, {
    alVerPaso(paso, ruta) {
      revisarAssetsDePaso(paso, ruta, revision);
    },
    alVerSecuenciaPorNombre() {
      // Una secuencia por nombre no nombra assets: sus pasos ya se recorren en `secuencias`.
    },
  });
}

function revisarAssetsDePaso(paso: Paso, ruta: string, revision: RevisionDeAssets): void {
  switch (paso.tipo) {
    case 'linea':
      revisarVoz(paso.audio, `${ruta}.audio`, revision);
      break;

    case 'elige':
      for (let i = 0; i < paso.opciones.length; i++) {
        const opcion = paso.opciones[i]!; // `i` es menor que el largo de la lista
        if (opcion.imagen !== undefined) {
          revisarImagen(opcion.imagen, `${ruta}.opciones[${i}].imagen`, revision);
        }
        revisarVoz(opcion.audio, `${ruta}.opciones[${i}].audio`, revision);
      }
      break;

    case 'efecto':
    case 'pon':
    case 'juego':
    case 'camina':
    case 'secuencia':
    case 'condicional':
      break; // estos pasos no nombran assets
  }
}

/**
 * Por qué una clave no sirve como imagen, o `undefined` si sí sirve.
 * Una imagen puede ser fija o una animación.
 */
export function problemaDeImagen(clave: string, assets: AssetsDeNivel): string | undefined {
  const asset = buscarAsset(clave, assets);
  if (asset === undefined) {
    return `no existe la imagen "${clave}" en los assets del nivel`;
  }
  if (asset.tipo !== 'imagen' && asset.tipo !== 'animacion') {
    return `"${clave}" es un asset de tipo ${asset.tipo}, y aquí va una imagen`;
  }
  return undefined;
}

function revisarImagen(clave: string, ruta: string, revision: RevisionDeAssets): void {
  const problema = problemaDeImagen(clave, revision.assets);
  if (problema !== undefined) {
    revision.diagnostico.errores.push(`${ruta}: ${problema}`);
  }
}

/** Una voz ausente (`undefined`) no se revisa: la línea se dirá con voz sintetizada. */
function revisarVoz(clave: string | undefined, ruta: string, revision: RevisionDeAssets): void {
  if (clave === undefined) return;

  const asset = buscarAsset(clave, revision.assets);
  if (asset === undefined) {
    revision.diagnostico.advertencias.push(`${ruta}: no existe la voz "${clave}"; se usará voz sintetizada`);
    return;
  }
  if (asset.tipo !== 'audio') {
    revision.diagnostico.errores.push(`${ruta}: "${clave}" es un asset de tipo ${asset.tipo}, y aquí va un audio`);
  }
}

function buscarAsset(clave: string, assets: AssetsDeNivel): Asset | undefined {
  if (!Object.hasOwn(assets, clave)) return undefined;
  return assets[clave]!.asset; // `hasOwn` acaba de comprobar que existe
}

// Convierte un nivel ya validado en lo que el escenario necesita para dibujarlo:
// la escenografía (suelo, telones, decorado) y los personajes, cada imagen con su dirección y su tamaño en metros.

import type { Asset } from '../dominio/manifiesto.ts';
import type { LugarDePersonaje } from '../dominio/mundo.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type {
  DecoradoDeEscena,
  Escenografia,
  ImagenDeEscena,
  PersonajeDeEscena,
  TelonDeEscena,
} from '../puertos/escenario.ts';
import { direccionDeArchivoDeAssets } from './direccion-de-asset.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';

/** Color de lo que queda vacío alrededor del escenario: un cielo claro. */
const COLOR_DE_FONDO = '#bfe6f5';

export function prepararEscenografia(nivel: Nivel, ubicacion: UbicacionDeAssets): Escenografia {
  const mundo = nivel.mundo;

  const telones: TelonDeEscena[] = [];
  for (const telon of mundo.telones) {
    telones.push({
      imagen: crearImagenDeEscena(telon.asset, nivel, ubicacion),
      desde: telon.desde,
      hasta: telon.hasta,
      altoEnMetros: telon.altoEnMetros,
    });
  }

  const decorado: DecoradoDeEscena[] = [];
  for (const objeto of mundo.decorado) {
    decorado.push({
      clase: objeto.clase,
      imagen: crearImagenDeEscena(objeto.asset, nivel, ubicacion),
      huella: objeto.huella,
      alturaEnMetros: objeto.alturaEnMetros,
      id: objeto.id,
    });
  }

  if (mundo.suelo === undefined) {
    return { colorDeFondo: COLOR_DE_FONDO, telones, decorado };
  }
  const suelo = { imagen: crearImagenDeEscena(mundo.suelo.asset, nivel, ubicacion), esquina: mundo.suelo.esquina };
  return { colorDeFondo: COLOR_DE_FONDO, suelo, telones, decorado };
}

/** Los personajes que están en el escenario al empezar: los NPCs del mapa y, si el nivel tiene, el jugador. */
export function prepararPersonajes(nivel: Nivel, ubicacion: UbicacionDeAssets): PersonajeDeEscena[] {
  const personajes: PersonajeDeEscena[] = [];

  for (const id of Object.keys(nivel.mundo.npcs)) {
    const lugar = nivel.mundo.npcs[id]!; // `id` viene de `Object.keys`, así que existe
    // Un NPC sin diálogo en el contenido está en el escenario, pero no se puede tocar.
    const tieneDialogo = Object.hasOwn(nivel.contenido.npcs, id);
    personajes.push(crearPersonajeDeEscena({ id, lugar, sePuedeTocar: tieneDialogo }, nivel, ubicacion));
  }

  const jugador = nivel.contenido.jugador;
  if (jugador !== undefined) {
    const lugar = nivel.mundo.iniciosDelJugador[0]!; // la validación garantiza un inicio si hay jugador
    personajes.push(crearPersonajeDeEscena({ id: jugador.personaje, lugar, sePuedeTocar: false }, nivel, ubicacion));
  }
  return personajes;
}

function crearPersonajeDeEscena(
  datos: { readonly id: string; readonly lugar: LugarDePersonaje; readonly sePuedeTocar: boolean },
  nivel: Nivel,
  ubicacion: UbicacionDeAssets,
): PersonajeDeEscena {
  const personaje = nivel.contenido.meta.personajes[datos.id]!; // la validación garantiza que el personaje existe
  return {
    id: datos.id,
    imagen: crearImagenDeEscena(personaje.sprite, nivel, ubicacion),
    posicion: datos.lugar.posicion,
    mira: datos.lugar.mira,
    sePuedeTocar: datos.sePuedeTocar,
  };
}

/** La imagen de una clave de assets, con la dirección de cada cuadro y su tamaño en metros. */
function crearImagenDeEscena(clave: string, nivel: Nivel, ubicacion: UbicacionDeAssets): ImagenDeEscena {
  const ubicado = nivel.assets[clave]!; // la validación garantiza que la clave existe y es una imagen
  const asset: Asset = ubicado.asset;

  let archivos: readonly string[];
  let cuadrosPorSegundo = 0;
  switch (asset.tipo) {
    case 'imagen':
      archivos = [asset.archivo];
      break;
    case 'animacion':
      archivos = asset.cuadros;
      cuadrosPorSegundo = asset.cuadrosPorSegundo;
      break;
    case 'audio':
    case 'video':
      throw new Error(`[escenario-engine] "${clave}" es un ${asset.tipo} y se quiso dibujar como imagen`);
  }

  const direcciones = archivos.map((archivo) => direccionDeArchivoDeAssets(ubicado.carpeta, archivo, ubicacion));
  const pixelesPorMetro = nivel.contenido.mundo.pixelesPorMetro;
  return {
    direcciones,
    cuadrosPorSegundo,
    anchoEnPixeles: asset.anchoEnPixeles,
    altoEnPixeles: asset.altoEnPixeles,
    anchoEnMetros: asset.anchoEnPixeles / pixelesPorMetro,
    altoEnMetros: asset.altoEnPixeles / pixelesPorMetro,
  };
}

// Convierte un nivel ya validado en lo que el escenario necesita para dibujarlo:
// la escenografía (suelo, telones, decorado), los personajes y las imágenes que las escenas usarán después,
// cada imagen con su dirección y su tamaño en metros.

import type { Asset } from '../dominio/manifiesto.ts';
import type { LugarDePersonaje } from '../dominio/mundo.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { PasoDeLinea } from '../dominio/paso.ts';
import { recorrerPasos } from '../dominio/recorrer-pasos.ts';
import type {
  DecoradoDeEscena,
  Escenografia,
  ImagenDeEscena,
  PersonajeDeEscena,
  TelonDeEscena,
} from '../puertos/escenario.ts';
import { direccionDeArchivoDeAssets } from './direccion-de-asset.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';

export function prepararEscenografia(nivel: Nivel, ubicacion: UbicacionDeAssets): Escenografia {
  const mundo = nivel.mundo;
  const colorDeFondo = nivel.contenido.mundo.colorDeFondo;

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
      id: idParaTocar(objeto.id, nivel),
    });
  }

  if (mundo.suelo === undefined) {
    return { colorDeFondo, telones, decorado };
  }
  const suelo = { imagen: crearImagenDeEscena(mundo.suelo.asset, nivel, ubicacion), esquina: mundo.suelo.esquina };
  return { colorDeFondo, suelo, telones, decorado };
}

/**
 * Solo se puede tocar un objeto que tiene diálogo en `interactivos`. Uno que lleva id solo para que lo mire un
 * plano o lo anime un paso `anima` no se toca.
 */
function idParaTocar(id: string | undefined, nivel: Nivel): string | undefined {
  if (id === undefined || !Object.hasOwn(nivel.contenido.interactivos, id)) return undefined;
  return id;
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

/**
 * Las imágenes que los pasos de las escenas van a necesitar más tarde: las animaciones de los pasos `anima`,
 * las poses de las líneas (`con` y `reacciona`) y el dibujo de quien entra con un paso `aparece`. Sirve para descargarlas antes de que les toque.
 */
export function prepararImagenesDeEscenas(nivel: Nivel, ubicacion: UbicacionDeAssets): ImagenDeEscena[] {
  const claves = new Set<string>();
  recorrerPasos(nivel.contenido, {
    alVerPaso(paso) {
      if (paso.tipo === 'anima') {
        claves.add(paso.clave);
      }
      if (paso.tipo === 'linea') {
        for (const clave of clavesDeLasPosesDe(paso)) {
          claves.add(clave);
        }
      }
      if (paso.tipo === 'aparece') {
        const personaje = nivel.contenido.meta.personajes[paso.personaje]!; // la validación garantiza que existe
        claves.add(personaje.sprite);
      }
    },
    alVerSecuenciaPorNombre() {
      // No hace falta: los pasos de cada secuencia ya se recorren.
    },
  });

  // Quien empieza en una pose vuelve a su `sprite` en cuanto un paso `anima` sin `repite` termina.
  for (const clave of clavesDeLosSpritesTrasUnaPoseInicial(nivel)) {
    claves.add(clave);
  }

  const imagenes: ImagenDeEscena[] = [];
  for (const clave of claves) {
    imagenes.push(crearImagenDeEscena(clave, nivel, ubicacion));
  }
  return imagenes;
}

/** Los `sprite` de los personajes que empiezan con otro dibujo (la propiedad `anima` del mapa). */
function clavesDeLosSpritesTrasUnaPoseInicial(nivel: Nivel): string[] {
  const claves: string[] = [];
  const personajes = nivel.contenido.meta.personajes;
  for (const id of Object.keys(nivel.mundo.npcs)) {
    const lugar = nivel.mundo.npcs[id]!; // `id` viene de `Object.keys`, así que existe
    if (lugar.dibujoInicial === undefined) continue;
    claves.push(personajes[id]!.sprite); // la validación garantiza que cada NPC del mapa es un personaje
  }
  const jugador = nivel.contenido.jugador;
  const inicio = nivel.mundo.iniciosDelJugador[0];
  if (jugador !== undefined && inicio !== undefined && inicio.dibujoInicial !== undefined) {
    claves.push(personajes[jugador.personaje]!.sprite); // la validación garantiza que el jugador es un personaje
  }
  return claves;
}

/** Las claves de los dibujos que una línea pone mientras dura: el de quien habla y los de quienes escuchan. */
function clavesDeLasPosesDe(linea: PasoDeLinea): string[] {
  const claves: string[] = [];
  if (linea.pose !== undefined) {
    claves.push(linea.pose);
  }
  claves.push(...Object.values(linea.reacciones ?? {}));
  return claves;
}

function crearPersonajeDeEscena(
  datos: { readonly id: string; readonly lugar: LugarDePersonaje; readonly sePuedeTocar: boolean },
  nivel: Nivel,
  ubicacion: UbicacionDeAssets,
): PersonajeDeEscena {
  const personaje = nivel.contenido.meta.personajes[datos.id]!; // la validación garantiza que el personaje existe
  // Con `anima` en el mapa, empieza ya en su pose (sentado, viendo la tele); si no, con su dibujo normal.
  const dibujo = datos.lugar.dibujoInicial ?? personaje.sprite;
  return {
    id: datos.id,
    imagen: crearImagenDeEscena(dibujo, nivel, ubicacion),
    posicion: datos.lugar.posicion,
    mira: datos.lugar.mira,
    sePuedeTocar: datos.sePuedeTocar,
  };
}

/** La imagen de una clave de assets, con la dirección de cada cuadro y su tamaño en metros. */
export function crearImagenDeEscena(clave: string, nivel: Nivel, ubicacion: UbicacionDeAssets): ImagenDeEscena {
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

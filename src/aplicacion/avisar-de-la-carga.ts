// Cuenta las imágenes de un nivel conforme cargan y le avisa del avance a quien lo pidió,
// para que el host dibuje su barra de carga (opción `alCargar`, docs/DISENO-3.0.md §4).

import type { ProgresoDeCarga } from '../dominio/progreso-de-carga.ts';
import type { Escenario, Escenografia, ImagenDeEscena, PersonajeDeEscena } from '../puertos/escenario.ts';

/** Todo lo que un nivel va a pedirle al escenario que cargue antes de poder jugarse. */
export interface ImagenesDelNivel {
  readonly escenografia: Escenografia;
  readonly personajes: readonly PersonajeDeEscena[];
  /** Las imágenes que se descargan por adelantado para las escenas. */
  readonly imagenesDeEscenas: readonly ImagenDeEscena[];
}

/**
 * Empieza a avisar del avance: una vez al principio (0 de `total`) y otra por cada archivo que carga.
 * Devuelve una función que deja de avisar; hay que llamarla cuando el nivel ya cargó (o si falló).
 */
export function avisarDeLaCarga(
  imagenes: ImagenesDelNivel,
  escenario: Escenario,
  alCargar: (progreso: ProgresoDeCarga) => void,
): () => void {
  const total = contarArchivos(imagenes);
  let cargados = 0;
  alCargar({ cargados, total });

  return escenario.alCargarImagen(() => {
    // El escenario avisa de cada archivo que se le pidió; el tope solo cuida que la barra nunca se pase.
    cargados = Math.min(total, cargados + 1);
    alCargar({ cargados, total });
  });
}

/** Cuántos archivos de imagen se van a pedir. Una animación cuenta un archivo por cuadro. */
function contarArchivos(imagenes: ImagenesDelNivel): number {
  let total = 0;
  const escenografia = imagenes.escenografia;
  if (escenografia.suelo !== undefined) {
    total += escenografia.suelo.imagen.direcciones.length;
  }
  for (const telon of escenografia.telones) {
    total += telon.imagen.direcciones.length;
  }
  for (const objeto of escenografia.decorado) {
    total += objeto.imagen.direcciones.length;
  }
  for (const personaje of imagenes.personajes) {
    total += personaje.imagen.direcciones.length;
  }
  for (const imagen of imagenes.imagenesDeEscenas) {
    total += imagen.direcciones.length;
  }
  return total;
}

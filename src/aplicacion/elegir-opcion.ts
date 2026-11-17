// Hace que un paso `elige` se vea y se oiga: muestra la pregunta con sus opciones como tarjetas,
// las lee en voz alta una por una mientras las resalta (nada requiere leer) y espera la elección.

import type { Opcion } from '../dominio/paso.ts';
import type { OpcionPorMostrar } from '../puertos/interfaz.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** Lo que se devuelve cuando el diálogo se interrumpe antes de que el jugador elija. */
const SIN_ELECCION = -1;

/**
 * Devuelve la posición, dentro de `opciones`, de la que eligió el jugador.
 * Si el diálogo se interrumpe antes, devuelve -1.
 */
export async function elegirOpcion(
  pregunta: string,
  opciones: readonly Opcion[],
  senal: AbortSignal,
  piezas: PiezasDeEscena,
): Promise<number> {
  const tarjetas: OpcionPorMostrar[] = [];
  for (const opcion of opciones) {
    let direccionDeLaImagen: string | undefined;
    if (opcion.imagen !== undefined) {
      direccionDeLaImagen = piezas.direccionDeAsset(opcion.imagen);
    }
    tarjetas.push({ texto: opcion.texto, traduccion: opcion.traduccion, direccionDeLaImagen });
  }
  piezas.interfaz.mostrarOpciones(pregunta, tarjetas);

  // `cierre` se dispara cuando el jugador elige o el diálogo se interrumpe; la lectura en voz alta lo obedece.
  const cierre = new AbortController();
  const alInterrumpir = (): void => {
    cierre.abort();
  };
  senal.addEventListener('abort', alInterrumpir, { once: true });

  let dejarDeEscucharLaEleccion = (): void => {};
  const eleccion = new Promise<number>((terminar) => {
    dejarDeEscucharLaEleccion = piezas.interfaz.alElegirOpcion((posicion) => {
      const esUnaPosicionValida = posicion >= 0 && posicion < opciones.length;
      if (!esUnaPosicionValida) return;
      terminar(posicion);
      cierre.abort();
    });
    // Si el cierre llega sin elección (una interrupción), la promesa termina igual: nada queda colgado.
    cierre.signal.addEventListener('abort', () => terminar(SIN_ELECCION), { once: true });
  });

  try {
    const lectura = leerEnVozAlta(pregunta, opciones, cierre.signal, piezas);
    // Se esperan las dos: la lectura termina enseguida en cuanto hay elección, porque `cierre` ya se disparó.
    const [posicionElegida] = await Promise.all([eleccion, lectura]);
    return posicionElegida;
  } finally {
    senal.removeEventListener('abort', alInterrumpir);
    dejarDeEscucharLaEleccion();
    cierre.abort();
    piezas.interfaz.ocultarOpciones();
  }
}

/** Dice la pregunta y luego cada opción, resaltando la tarjeta de la que se está diciendo. */
async function leerEnVozAlta(
  pregunta: string,
  opciones: readonly Opcion[],
  senal: AbortSignal,
  piezas: PiezasDeEscena,
): Promise<void> {
  await piezas.audio.decir(pregunta, piezas.idiomaBase, undefined, senal);

  for (let i = 0; i < opciones.length; i++) {
    if (senal.aborted) return;
    const opcion = opciones[i]!; // `i` es menor que el largo de la lista
    piezas.interfaz.resaltarOpcion(i);

    let direccionDeLaVoz: string | undefined;
    if (opcion.audio !== undefined) {
      direccionDeLaVoz = piezas.direccionDeAsset(opcion.audio);
    }
    const hayAlgoQueDecir = opcion.texto !== undefined || direccionDeLaVoz !== undefined;
    if (hayAlgoQueDecir) {
      await piezas.audio.decir(opcion.texto ?? '', piezas.idiomaBase, direccionDeLaVoz, senal);
    }
  }
  if (!senal.aborted) {
    piezas.interfaz.resaltarOpcion(undefined);
  }
}

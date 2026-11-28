// Hace que una línea de diálogo se vea y se oiga: globo sobre quien habla, voz, tarjeta de vocabulario
// y, si la línea las trae, las poses de quien habla y de quienes escuchan (poses-de-linea.ts).
//
// Cómo termina una línea (lo primero que pase):
//   - el jugador toca la pantalla (salvo en los comentarios, que no esperan toques), pero solo cuando la línea
//     ya lleva un momento a la vista: así un doble toque no se salta la línea que acaba de empezar;
//   - la voz termina y pasa un momento;
//   - el diálogo se interrumpe.
//
// Diferencia con la versión 2.0: el texto aparece completo de una vez, no letra por letra.

import type { PasoDeLinea } from '../dominio/paso.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { ponerPosesDeLinea } from './poses-de-linea.ts';

/** Pausa entre que termina la voz y el globo se cierra solo. */
const ESPERA_AL_TERMINAR_LA_VOZ_EN_SEGUNDOS = 0.7;

/** Si el dispositivo no tiene voz, el globo se queda el tiempo que tomaría leerlo. */
const SEGUNDOS_DE_LECTURA_POR_LETRA = 0.06;
const SEGUNDOS_MINIMOS_DE_LECTURA = 1.5;

/**
 * Tiempo que una línea se queda a la vista antes de que un toque la cierre.
 * Niñas y niños tocan dos veces muy seguido: el segundo toque llegaba justo cuando empezaba la línea siguiente
 * y se la saltaba (la palabra en inglés de Bobby, la respuesta cariñosa al salir de un minijuego).
 * Los toques que llegan antes no se pierden en el mapa: la capa de toque ya los atrapa, solo no cierran nada.
 */
const SEGUNDOS_ANTES_DE_ACEPTAR_UN_TOQUE = 0.5;

/** Una línea lista para decirse. */
export interface LineaPorDecir {
  readonly paso: PasoDeLinea;
  /** El texto con sus variables entre llaves (`{faltan}`, `{dinero}`...) ya reemplazadas. */
  readonly textoCompleto: string;
  /**
   * `true` en un diálogo: un toque cierra la línea. `false` en un comentario del jugador:
   * el globo no atrapa toques, para que se pueda seguir caminando mientras se oye.
   */
  readonly seCierraConUnToque: boolean;
}

export async function decirLinea(porDecir: LineaPorDecir, senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  const linea = porDecir.paso;
  const textoCompleto = porDecir.textoCompleto;
  const personaje = piezas.contenido.meta.personajes[linea.hablante]!; // la validación garantiza que el hablante existe
  // La traducción solo se muestra y se dice si el personaje habla otro idioma que el del sitio.
  const hablaOtroIdioma = personaje.idioma !== piezas.idiomaBase;
  const traduccion = hablaOtroIdioma ? linea.traduccion : undefined;

  // Las poses van antes que el globo: la cara de sorpresa se ve en cuanto empieza la línea.
  const devolverLosDibujos = ponerPosesDeLinea(linea, piezas);

  const quitarGlobo = piezas.interfaz.mostrarGlobo({
    texto: textoCompleto,
    traduccion,
    palabra: linea.palabra,
    esPensamiento: linea.esPensamiento,
  });
  if (linea.palabra !== undefined) {
    piezas.alVerPalabra(linea.palabra);
  }

  // `cierre` se dispara con lo primero que cierre la línea; la voz y la espera final lo obedecen.
  const cierre = new AbortController();
  const cerrar = (): void => {
    cierre.abort();
  };
  senal.addEventListener('abort', cerrar, { once: true });
  let dejarDeEscucharToques = (): void => {};
  if (porDecir.seCierraConUnToque) {
    dejarDeEscucharToques = cerrarConUnToqueDentroDeUnMomento(cierre, piezas);
  }

  // El globo sigue a quien habla aunque la cámara o el personaje se muevan.
  const apuntarGlobo = (): void => {
    piezas.interfaz.apuntarGlobo(piezas.escenario.lugarEnPantallaDe(linea.hablante));
  };
  apuntarGlobo();
  const dejarDeApuntar = piezas.reloj.enCadaCuadro(apuntarGlobo);

  try {
    let direccionDeLaVoz: string | undefined;
    if (linea.audio !== undefined) {
      direccionDeLaVoz = piezas.direccionDeAsset(linea.audio);
    }
    // La voz de quien habla (tono y velocidad) solo se usa en su frase; la traducción la dice la voz normal.
    const fraseOriginal = { texto: textoCompleto, idioma: personaje.idioma, direccionDeLaVoz, voz: personaje.voz };
    // En el juego, `piezas.audio` es la fila de voces (voz-en-orden.ts): espera su turno y pone el tope de tiempo.
    const resultado = await piezas.audio.decir(fraseOriginal, cierre.signal);
    if (traduccion !== undefined && !cierre.signal.aborted) {
      await piezas.audio.decir({ texto: traduccion, idioma: piezas.idiomaBase }, cierre.signal);
    }

    let esperaFinalEnSegundos = ESPERA_AL_TERMINAR_LA_VOZ_EN_SEGUNDOS;
    if (resultado === 'sin_voz') {
      esperaFinalEnSegundos = calcularSegundosDeLectura(textoCompleto, traduccion);
    }
    await piezas.reloj.esperar(esperaFinalEnSegundos, cierre.signal);
  } finally {
    senal.removeEventListener('abort', cerrar);
    dejarDeEscucharToques();
    dejarDeApuntar();
    // Si la línea termina por un error, esto calla la voz que hubiera quedado sonando.
    cierre.abort();
    quitarGlobo();
    devolverLosDibujos();
  }
}

/**
 * Hace que un toque cierre la línea, pero solo cuando ya lleva `SEGUNDOS_ANTES_DE_ACEPTAR_UN_TOQUE` a la vista.
 * Se escucha desde el principio para que la capa de toque atrape también los toques tempranos (si no, un toque
 * temprano caería en el mapa y haría caminar al jugador). El momento se mide con el reloj del juego:
 * si el juego se pausa, la espera también. Devuelve la función que deja de escuchar.
 */
function cerrarConUnToqueDentroDeUnMomento(cierre: AbortController, piezas: PiezasDeEscena): () => void {
  let yaSeAceptanToques = false;
  const aceptarToquesDentroDeUnMomento = async (): Promise<void> => {
    // Si la línea se cierra antes, la espera termina ahí (nunca queda colgada) y el valor ya no importa.
    await piezas.reloj.esperar(SEGUNDOS_ANTES_DE_ACEPTAR_UN_TOQUE, cierre.signal);
    yaSeAceptanToques = true;
  };
  void aceptarToquesDentroDeUnMomento();
  return piezas.interfaz.alTocarParaSeguir(() => {
    if (!yaSeAceptanToques) return;
    cierre.abort();
  });
}

function calcularSegundosDeLectura(texto: string, traduccion: string | undefined): number {
  let letras = texto.length;
  if (traduccion !== undefined) {
    letras += traduccion.length;
  }
  return Math.max(SEGUNDOS_MINIMOS_DE_LECTURA, letras * SEGUNDOS_DE_LECTURA_POR_LETRA);
}

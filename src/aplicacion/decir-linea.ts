// Hace que una línea de diálogo se vea y se oiga: globo sobre quien habla, voz, y tarjeta de vocabulario.
//
// Cómo termina una línea (lo primero que pase):
//   - el jugador toca la pantalla (salvo en los comentarios, que no esperan toques);
//   - la voz termina y pasa un momento;
//   - el diálogo se interrumpe.
//
// Diferencia con la versión 2.0: el texto aparece completo de una vez, no letra por letra.

import type { PasoDeLinea } from '../dominio/paso.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** Pausa entre que termina la voz y el globo se cierra solo. */
const ESPERA_AL_TERMINAR_LA_VOZ_EN_SEGUNDOS = 0.7;

/** Si el dispositivo no tiene voz, el globo se queda el tiempo que tomaría leerlo. */
const SEGUNDOS_DE_LECTURA_POR_LETRA = 0.06;
const SEGUNDOS_MINIMOS_DE_LECTURA = 1.5;

/** Una línea lista para decirse. */
export interface LineaPorDecir {
  readonly paso: PasoDeLinea;
  /** El texto con `{faltan}` y `{dinero}` ya reemplazados. */
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

  const quitarGlobo = piezas.interfaz.mostrarGlobo({ texto: textoCompleto, traduccion, palabra: linea.palabra });
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
    dejarDeEscucharToques = piezas.interfaz.alTocarParaSeguir(cerrar);
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
    const fraseOriginal = { texto: textoCompleto, idioma: personaje.idioma, direccionDeLaVoz };
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
  }
}

function calcularSegundosDeLectura(texto: string, traduccion: string | undefined): number {
  let letras = texto.length;
  if (traduccion !== undefined) {
    letras += traduccion.length;
  }
  return Math.max(SEGUNDOS_MINIMOS_DE_LECTURA, letras * SEGUNDOS_DE_LECTURA_POR_LETRA);
}

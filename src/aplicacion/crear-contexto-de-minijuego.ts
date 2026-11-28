// Arma lo que el motor le entrega a un minijuego (docs/DISENO-3.0.md §6): su elemento, la configuración
// del nivel, y el estado, el audio, los assets y el azar del motor vistos desde el minijuego.
//
// El minijuego es código del host: todo lo que pide se revisa, y nada de lo que pide puede fallar con un error.

import type { AjustesDeVoz } from '../dominio/ajustes-de-voz.ts';
import { cumpleCondicion, leerCondicionDeTexto } from '../dominio/condicion.ts';
import { valorDe } from '../dominio/estado.ts';
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import type { Idioma } from '../dominio/idioma.ts';
import { VOLUMEN_MAXIMO, VOLUMEN_MINIMO } from '../dominio/volumenes.ts';
import type { OpcionesDeSonido } from '../puertos/audio.ts';
import type {
  AnimacionDeImagen,
  AssetsParaMinijuego,
  AudioParaMinijuego,
  ContextoDeMinijuego,
  CuadrosDeAsset,
  ImagenAnimable,
} from '../puertos/minijuego.ts';
import { animarImagenDeMinijuego } from './animar-imagen-de-minijuego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/**
 * Lo más lento y lo más rápido que un minijuego puede tocar un sonido: dos octavas abajo y dos arriba.
 * Más allá, el navegador ya no lo reproduce bien o deja de sonar como el mismo sonido.
 */
const TONO_MINIMO_DE_UN_SONIDO = 0.25;
const TONO_MAXIMO_DE_UN_SONIDO = 4;

/** Lo que es propio de cada vez que se abre un minijuego. */
export interface AperturaDeMinijuego {
  /** El espacio a pantalla completa que el motor abrió para el minijuego. */
  readonly elemento: HTMLElement;
  /** Lo que el nivel le pasa al minijuego. */
  readonly config: unknown;
  /** Se dispara cuando el minijuego se cierra: termina, falla o se interrumpe. */
  readonly senal: AbortSignal;
}

export function crearContextoDeMinijuego(apertura: AperturaDeMinijuego, piezas: PiezasDeEscena): ContextoDeMinijuego {
  return {
    elemento: apertura.elemento,
    config: apertura.config,
    senal: apertura.senal,
    estado: {
      obtener: (nombre) => valorDe(piezas.estado.actual, nombre),
      cumple: (condicion) => cumpleCondicion(leerCondicionDeTexto(condicion), piezas.estado.actual),
    },
    audio: crearAudio(apertura.senal, piezas),
    assets: crearAssets(apertura.senal, piezas),
    azar: () => piezas.azar(),
  };
}

function crearAssets(senalDelMinijuego: AbortSignal, piezas: PiezasDeEscena): AssetsParaMinijuego {
  // La animación de cada imagen, para que volver a animar una la cambie en vez de ponerle dos encima.
  const animaciones = new WeakMap<ImagenAnimable, AnimacionDeImagen>();

  /** Los cuadros de una clave; sin direcciones (y con una advertencia) si no es una imagen del nivel. */
  function cuadros(clave: string): CuadrosDeAsset {
    const encontrados = piezas.cuadrosDeAsset(clave);
    if (encontrados === undefined) {
      console.warn(`[escenario-engine] un minijuego pidió los cuadros de "${clave}", que no es una imagen del nivel`);
      return { urls: [], cuadrosPorSegundo: 0 };
    }
    return encontrados;
  }

  return {
    url(clave) {
      const direccion = piezas.direccionDeAsset(clave);
      if (direccion === undefined) {
        console.warn(`[escenario-engine] un minijuego pidió "${clave}", que no está en los assets del nivel`);
        return '';
      }
      return direccion;
    },
    cuadros,
    animar(imagen, clave, senal) {
      animaciones.get(imagen)?.detener();

      const senales = [senalDelMinijuego];
      if (senal !== undefined) {
        senales.push(senal);
      }
      const animacion = animarImagenDeMinijuego({
        imagen,
        cuadros: cuadros(clave),
        reloj: piezas.reloj,
        buscarCuadros: cuadros,
        senales,
      });
      animaciones.set(imagen, animacion);
      return animacion;
    },
  };
}

function crearAudio(senalDelMinijuego: AbortSignal, piezas: PiezasDeEscena): AudioParaMinijuego {
  // Solo se dice una frase a la vez: una frase nueva corta la que estuviera sonando.
  let cortarLaFraseAnterior = (): void => {};

  async function decir(texto: string, idioma: Idioma, clave?: string, quien?: string): Promise<void> {
    cortarLaFraseAnterior();
    if (senalDelMinijuego.aborted) return;

    // `corte` se dispara con lo primero que pase: otra frase empieza, o el minijuego se cierra.
    const corte = new AbortController();
    const cortar = (): void => {
      corte.abort();
    };
    cortarLaFraseAnterior = cortar;
    senalDelMinijuego.addEventListener('abort', cortar, { once: true });

    const direccionDeLaVoz = buscarVozGrabada(clave, piezas);
    const voz = buscarVozDelPersonaje(quien, piezas);
    try {
      // En el juego, `piezas.audio` es la fila de voces (voz-en-orden.ts): espera su turno y pone el tope de tiempo.
      await piezas.audio.decir({ texto, idioma, direccionDeLaVoz, voz }, corte.signal);
    } finally {
      senalDelMinijuego.removeEventListener('abort', cortar);
    }
  }

  return {
    tocar(clave, opciones) {
      const direccion = piezas.direccionDeAsset(clave);
      if (direccion === undefined) {
        console.warn(`[escenario-engine] un minijuego pidió tocar "${clave}", que no está en los assets del nivel`);
        return;
      }
      piezas.audio.tocar(direccion, leerOpcionesDeSonido(clave, opciones));
    },
    tocarTono(frecuenciaEnHertz, duracionEnSegundos) {
      const sonValidos = esNumeroPositivo(frecuenciaEnHertz) && esNumeroPositivo(duracionEnSegundos);
      if (!sonValidos) {
        console.warn('[escenario-engine] un minijuego pidió un tono sin una frecuencia y una duración mayores que cero');
        return;
      }
      piezas.audio.tocarTono(frecuenciaEnHertz, duracionEnSegundos);
    },
    decir,
  };
}

/** La dirección de la voz grabada que pidió el minijuego. `undefined` = la dice la voz sintetizada. */
function buscarVozGrabada(clave: unknown, piezas: PiezasDeEscena): string | undefined {
  if (clave === undefined) return undefined;
  // El minijuego puede estar escrito en JavaScript sin tipos: lo que no es texto se ignora, no se rompe.
  if (typeof clave !== 'string') {
    console.warn('[escenario-engine] contexto.audio.decir: la clave de la voz no es un texto; se usa voz sintetizada');
    return undefined;
  }
  return piezas.voces.direccionDeVoz(clave, 'contexto.audio.decir');
}

/** El tono y la velocidad del personaje que pidió el minijuego. `undefined` = la voz normal. */
function buscarVozDelPersonaje(quien: unknown, piezas: PiezasDeEscena): AjustesDeVoz | undefined {
  if (quien === undefined) return undefined;
  if (typeof quien !== 'string') {
    console.warn('[escenario-engine] contexto.audio.decir: quien no es el id de un personaje; se usa la voz normal');
    return undefined;
  }
  return piezas.voces.vozDe(quien, 'contexto.audio.decir');
}

/**
 * Lo que el minijuego pidió para un sonido, sin lo que no sirve. Una opción mala se ignora con una advertencia:
 * el sonido igual suena, como si no la hubiera pedido. `undefined` = sin opciones.
 */
function leerOpcionesDeSonido(clave: string, opciones: unknown): OpcionesDeSonido | undefined {
  if (opciones === undefined) return undefined;
  if (!esObjetoPlano(opciones)) {
    console.warn(`[escenario-engine] un minijuego tocó "${clave}" con opciones que no son un objeto; se ignoran`);
    return undefined;
  }
  let volumen: number | undefined;
  const volumenPedido = opciones['volumen'];
  if (esNumeroEntre(volumenPedido, VOLUMEN_MINIMO, VOLUMEN_MAXIMO)) {
    volumen = volumenPedido;
  } else if (volumenPedido !== undefined) {
    console.warn(
      `[escenario-engine] un minijuego tocó "${clave}" con un volumen que no va de ` +
        `${VOLUMEN_MINIMO} a ${VOLUMEN_MAXIMO}; se ignora`,
    );
  }
  let tono: number | undefined;
  const tonoPedido = opciones['tono'];
  if (esNumeroEntre(tonoPedido, TONO_MINIMO_DE_UN_SONIDO, TONO_MAXIMO_DE_UN_SONIDO)) {
    tono = tonoPedido;
  } else if (tonoPedido !== undefined) {
    console.warn(
      `[escenario-engine] un minijuego tocó "${clave}" con un tono que no va de ` +
        `${TONO_MINIMO_DE_UN_SONIDO} a ${TONO_MAXIMO_DE_UN_SONIDO}; se ignora`,
    );
  }
  return { volumen, tono };
}

function esNumeroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return false;
  return valor >= minimo && valor <= maximo;
}

function esNumeroPositivo(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

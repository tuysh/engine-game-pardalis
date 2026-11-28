// Arma lo que el motor le entrega a un minijuego (docs/DISENO-3.0.md §6): su elemento, la configuración
// del nivel, y el estado, el audio, los assets y el azar del motor vistos desde el minijuego.
//
// El minijuego es código del host: todo lo que pide se revisa, y nada de lo que pide puede fallar con un error.

import { cumpleCondicion, leerCondicionDeTexto } from '../dominio/condicion.ts';
import { valorDe } from '../dominio/estado.ts';
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import type { Idioma } from '../dominio/idioma.ts';
import { VOLUMEN_MAXIMO, VOLUMEN_MINIMO } from '../dominio/volumenes.ts';
import type { OpcionesDeSonido } from '../puertos/audio.ts';
import type { AudioParaMinijuego, ContextoDeMinijuego } from '../puertos/minijuego.ts';
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
    assets: {
      url(clave) {
        const direccion = piezas.direccionDeAsset(clave);
        if (direccion === undefined) {
          console.warn(`[escenario-engine] un minijuego pidió "${clave}", que no está en los assets del nivel`);
          return '';
        }
        return direccion;
      },
    },
    azar: () => piezas.azar(),
  };
}

function crearAudio(senalDelMinijuego: AbortSignal, piezas: PiezasDeEscena): AudioParaMinijuego {
  // Solo se dice una frase a la vez: una frase nueva corta la que estuviera sonando.
  let cortarLaFraseAnterior = (): void => {};

  async function decir(texto: string, idioma: Idioma, clave?: string): Promise<void> {
    cortarLaFraseAnterior();
    if (senalDelMinijuego.aborted) return;

    // `corte` se dispara con lo primero que pase: otra frase empieza, o el minijuego se cierra.
    const corte = new AbortController();
    const cortar = (): void => {
      corte.abort();
    };
    cortarLaFraseAnterior = cortar;
    senalDelMinijuego.addEventListener('abort', cortar, { once: true });

    let direccionDeLaVoz: string | undefined;
    if (clave !== undefined) {
      direccionDeLaVoz = piezas.direccionDeAsset(clave);
    }
    try {
      // En el juego, `piezas.audio` es la fila de voces (voz-en-orden.ts): espera su turno y pone el tope de tiempo.
      await piezas.audio.decir({ texto, idioma, direccionDeLaVoz }, corte.signal);
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
    console.warn(`[escenario-engine] un minijuego tocó "${clave}" con un volumen que no va de 0 a 1; se ignora`);
  }
  let tono: number | undefined;
  const tonoPedido = opciones['tono'];
  if (esNumeroEntre(tonoPedido, TONO_MINIMO_DE_UN_SONIDO, TONO_MAXIMO_DE_UN_SONIDO)) {
    tono = tonoPedido;
  } else if (tonoPedido !== undefined) {
    console.warn(`[escenario-engine] un minijuego tocó "${clave}" con un tono que no va de 0.25 a 4; se ignora`);
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

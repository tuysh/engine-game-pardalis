// Arma lo que el motor le entrega a un minijuego (docs/DISENO-3.0.md §6): su elemento, la configuración
// del nivel, y el estado, el audio, los assets y el azar del motor vistos desde el minijuego.
//
// El minijuego es código del host: todo lo que pide se revisa, y nada de lo que pide puede fallar con un error.

import { cumpleCondicion, leerCondicionDeTexto } from '../dominio/condicion.ts';
import { valorDe } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type {
  AnimacionDeImagen,
  AssetsParaMinijuego,
  AudioParaMinijuego,
  ContextoDeMinijuego,
  CuadrosDeAsset,
  ImagenAnimable,
} from '../puertos/minijuego.ts';
import { animarImagenDeMinijuego } from './animar-imagen-de-minijuego.ts';
import { decirSinEsperarDeMas } from './decir-sin-esperar-de-mas.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

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
      await decirSinEsperarDeMas({ texto, idioma, direccionDeLaVoz }, corte.signal, piezas);
    } finally {
      senalDelMinijuego.removeEventListener('abort', cortar);
    }
  }

  return {
    tocar(clave) {
      const direccion = piezas.direccionDeAsset(clave);
      if (direccion === undefined) {
        console.warn(`[escenario-engine] un minijuego pidió tocar "${clave}", que no está en los assets del nivel`);
        return;
      }
      piezas.audio.tocar(direccion);
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

function esNumeroPositivo(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

// Hace que un paso `juego` ocurra: abre un espacio a pantalla completa, llama al minijuego que registró
// el host y espera su resultado (docs/DISENO-3.0.md §6).
//
// El minijuego es código del host: no es confiable. Por eso:
// - si lanza un error, cuenta como `{ exito: false }` y el diálogo sigue por el camino amable `siNo`;
// - su resultado se limpia antes de usarse;
// - si el diálogo se interrumpe y el minijuego no termina, su espacio se cierra de todos modos.

import { cumpleCondicion, leerCondicionDeTexto } from '../dominio/condicion.ts';
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import { valorDe } from '../dominio/estado.ts';
import type { ValorDeEstado } from '../dominio/estado.ts';
import type { ContextoDeMinijuego, Minijuego, ResultadoDeMinijuego } from '../puertos/minijuego.ts';
import { esperarOCancelar } from './esperar-o-cancelar.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** El paso `juego` que se va a ejecutar. */
export interface MinijuegoPorJugar {
  /** Nombre con el que el host registró el minijuego. */
  readonly nombre: string;
  /** Lo que el nivel le pasa al minijuego. */
  readonly config: unknown;
}

const SIN_EXITO: ResultadoDeMinijuego = { exito: false };

export async function jugarMinijuego(
  porJugar: MinijuegoPorJugar,
  senal: AbortSignal,
  piezas: PiezasDeEscena,
): Promise<ResultadoDeMinijuego> {
  if (!Object.hasOwn(piezas.minijuegos, porJugar.nombre)) {
    // No pasa si el nivel se validó con los minijuegos del host; si pasa, el juego sigue por `siNo`.
    console.error(`[escenario-engine] el minijuego "${porJugar.nombre}" no está registrado`);
    return SIN_EXITO;
  }
  const minijuego = piezas.minijuegos[porJugar.nombre]!; // `hasOwn` acaba de comprobar que existe

  // El minijuego recibe su propia señal. Se dispara si el diálogo se interrumpe y también
  // cuando el minijuego termina, para que quite sus oyentes y temporizadores.
  const cierre = new AbortController();
  const alInterrumpir = (): void => {
    cierre.abort();
  };
  senal.addEventListener('abort', alInterrumpir, { once: true });

  const elemento = piezas.interfaz.abrirEspacioDeMinijuego();
  try {
    const contexto = crearContexto(elemento, porJugar.config, cierre.signal, piezas);
    const espera = await esperarOCancelar(llamarSinQueFalle(minijuego, contexto, porJugar.nombre), senal);
    if (espera.tipo === 'cancelada') return SIN_EXITO;
    return espera.valor;
  } finally {
    senal.removeEventListener('abort', alInterrumpir);
    cierre.abort();
    piezas.interfaz.cerrarEspacioDeMinijuego();
  }
}

/** Llama al minijuego. Si lanza un error o rechaza, lo anota en la consola y responde que no hubo éxito. */
async function llamarSinQueFalle(
  minijuego: Minijuego,
  contexto: ContextoDeMinijuego,
  nombre: string,
): Promise<ResultadoDeMinijuego> {
  try {
    const resultado: unknown = await minijuego(contexto);
    return limpiarResultado(resultado);
  } catch (error) {
    console.error(`[escenario-engine] el minijuego "${nombre}" falló; el diálogo sigue por "siNo":`, error);
    return SIN_EXITO;
  }
}

function crearContexto(
  elemento: HTMLElement,
  config: unknown,
  senal: AbortSignal,
  piezas: PiezasDeEscena,
): ContextoDeMinijuego {
  return {
    elemento,
    config,
    senal,
    estado: {
      obtener: (nombre) => valorDe(piezas.estado.actual, nombre),
      cumple: (condicion) => cumpleCondicion(leerCondicionDeTexto(condicion), piezas.estado.actual),
    },
    audio: {
      tocar(clave) {
        const direccion = piezas.direccionDeAsset(clave);
        if (direccion === undefined) {
          console.warn(`[escenario-engine] un minijuego pidió tocar "${clave}", que no está en los assets del nivel`);
          return;
        }
        piezas.audio.tocar(direccion);
      },
      decir(texto, idioma, clave) {
        let direccionDeLaVoz: string | undefined;
        if (clave !== undefined) {
          direccionDeLaVoz = piezas.direccionDeAsset(clave);
        }
        // No se espera a que termine de hablar: el minijuego sigue. Al cerrarse el minijuego, la voz se calla.
        void piezas.audio.decir({ texto, idioma, direccionDeLaVoz }, senal);
      },
    },
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
  };
}

/**
 * Deja el resultado con la forma esperada: `exito` verdadero o falso,
 * y en `otorgar` solo valores que el estado puede guardar.
 */
function limpiarResultado(resultado: unknown): ResultadoDeMinijuego {
  if (!esObjetoPlano(resultado)) return SIN_EXITO;

  const exito = resultado.exito === true;
  if (!esObjetoPlano(resultado.otorgar)) return { exito };

  const otorgar: Record<string, ValorDeEstado> = {};
  for (const nombre of Object.keys(resultado.otorgar)) {
    if (nombre === '__proto__') continue;
    const valor = resultado.otorgar[nombre];
    const esNumeroUsable = typeof valor === 'number' && Number.isFinite(valor);
    if (typeof valor === 'boolean' || typeof valor === 'string' || esNumeroUsable) {
      otorgar[nombre] = valor;
    }
  }
  return { exito, otorgar };
}

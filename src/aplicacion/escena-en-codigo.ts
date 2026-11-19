// La `escena` que recibe una cinemática escrita en código (docs/DISENO-3.0.md §7.3).
//
// Cada método arma el mismo paso que se escribiría en el JSON y lo manda al ejecutor de pasos:
// así una cinemática en código se salta y se interrumpe igual que una escrita en el nivel.
//
// El validador no puede leer el código del host, así que cada método revisa aquí, al ejecutarse,
// que exista lo que nombra (personajes, puntos, planos, animaciones). Si algo no existe, lanza un error
// que dice qué llamada fue: la cinemática termina ahí y el juego sigue.

import type { AssetsDeNivel } from '../dominio/assets-de-nivel.ts';
import { cumpleCondicion, leerCondicionDeTexto } from '../dominio/condicion.ts';
import { valorDe } from '../dominio/estado.ts';
import type { Punto } from '../dominio/geometria.ts';
import { CAMARA_AL_JUGADOR, EFECTOS_DISPONIBLES } from '../dominio/paso.ts';
import type { Paso } from '../dominio/paso.ts';
import type { EscenaDeCinematica } from '../puertos/cinematica-en-codigo.ts';
import type { EjecucionDePasos } from './ejecucion-de-pasos.ts';
import { ejecutarPasos } from './ejecutar-pasos.ts';

/** Lo que una cinemática en código puede nombrar del mapa y de los assets. */
export interface LugaresParaCodigo {
  /** Los puntos con nombre del mapa. */
  readonly puntos: Readonly<Record<string, Punto>>;
  readonly assets: AssetsDeNivel;
}

export interface PedidoDeEscenaEnCodigo {
  /** El nombre con el que el host registró la cinemática, para nombrarla en los errores. */
  readonly nombre: string;
  readonly ejecucion: EjecucionDePasos;
  readonly lugares: LugaresParaCodigo;
  /** Se dispara cuando el nivel termina a media cinemática. */
  readonly finDelNivel: AbortSignal;
}

export function crearEscenaEnCodigo(pedido: PedidoDeEscenaEnCodigo): EscenaDeCinematica {
  const { ejecucion, lugares } = pedido;
  const contenido = ejecucion.contenido;

  const ejecutar = (paso: Paso): Promise<void> => {
    return ejecutarPasos([paso], ejecucion);
  };

  /** Lanza el error de una llamada mal hecha. `llamada` es, por ejemplo, `camina("mama", "sillon")`. */
  const fallar = (llamada: string, problema: string): never => {
    throw new Error(`[escenario-engine] cinemática en código "${pedido.nombre}": escena.${llamada}: ${problema}`);
  };
  const exigirPersonaje = (personaje: string, llamada: string): void => {
    if (!Object.hasOwn(contenido.meta.personajes, personaje)) {
      fallar(llamada, `el personaje "${personaje}" no existe en meta.personajes`);
    }
  };
  const exigirPunto = (punto: string, llamada: string): void => {
    if (!Object.hasOwn(lugares.puntos, punto)) {
      fallar(llamada, `no hay un punto llamado "${punto}" en el mapa`);
    }
  };
  const exigirSegundos = (segundos: number, llamada: string): void => {
    // Con un número que no sirve (NaN, negativo), la espera no terminaría nunca.
    if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos < 0) {
      fallar(llamada, 'los segundos deben ser un número de 0 en adelante');
    }
  };

  return {
    async juntos(...pasos) {
      await Promise.all(pasos);
    },

    async espera(segundos) {
      exigirSegundos(segundos, `espera(${segundos})`);
      await ejecutar({ tipo: 'espera', esperaEnSegundos: segundos });
    },

    async camara(destino, opciones) {
      const llamada = `camara("${destino}")`;
      const duracionEnSegundos = opciones?.duracion ?? 0;
      exigirSegundos(duracionEnSegundos, llamada);
      if (destino === CAMARA_AL_JUGADOR && contenido.jugador === undefined) {
        fallar(llamada, 'el nivel no tiene jugador');
      }
      const esUnPlano = Object.hasOwn(contenido.mundo.planos, destino);
      const esUnPersonaje = Object.hasOwn(contenido.meta.personajes, destino);
      if (destino !== CAMARA_AL_JUGADOR && !esUnPlano && !esUnPersonaje) {
        fallar(llamada, `"${destino}" no es un plano de mundo.planos, ni un personaje, ni "jugador"`);
      }
      await ejecutar({ tipo: 'camara', destino, duracionEnSegundos });
    },

    async mira(personaje, hacia) {
      const llamada = `mira("${personaje}", "${hacia}")`;
      exigirPersonaje(personaje, llamada);
      const miraAUnPersonaje = Object.hasOwn(contenido.meta.personajes, hacia);
      const miraAUnPunto = Object.hasOwn(lugares.puntos, hacia);
      if (!miraAUnPersonaje && !miraAUnPunto) {
        fallar(llamada, `"${hacia}" no es un personaje ni un punto del mapa`);
      }
      await ejecutar({ tipo: 'mira', personaje, hacia });
    },

    async anima(personaje, clave, opciones) {
      const llamada = `anima("${personaje}", "${clave}")`;
      exigirPersonaje(personaje, llamada);
      const tipoDeAsset = Object.hasOwn(lugares.assets, clave) ? lugares.assets[clave]!.asset.tipo : undefined;
      if (tipoDeAsset !== 'animacion' && tipoDeAsset !== 'imagen') {
        fallar(llamada, `no existe la animación ni la imagen "${clave}" en los assets del nivel`);
      }
      await ejecutar({ tipo: 'anima', personaje, clave, repite: opciones?.repite ?? false });
    },

    async aparece(personaje, punto) {
      const llamada = `aparece("${personaje}", "${punto}")`;
      exigirPersonaje(personaje, llamada);
      exigirPunto(punto, llamada);
      await ejecutar({ tipo: 'aparece', personaje, punto });
    },

    async desaparece(personaje) {
      const llamada = `desaparece("${personaje}")`;
      exigirPersonaje(personaje, llamada);
      if (contenido.jugador !== undefined && contenido.jugador.personaje === personaje) {
        fallar(llamada, 'no se puede sacar del escenario al personaje del jugador');
      }
      await ejecutar({ tipo: 'desaparece', personaje });
    },

    async musica(clave) {
      await ejecutar({ tipo: 'musica', clave });
    },

    async sonido(clave) {
      await ejecutar({ tipo: 'sonido', clave });
    },

    async fundido(sentido, opciones) {
      const llamada = `fundido("${sentido}")`;
      if (sentido !== 'abrir' && sentido !== 'cerrar') {
        fallar(llamada, 'el sentido debe ser "abrir" o "cerrar"');
      }
      const duracionEnSegundos = opciones?.duracion ?? 0;
      exigirSegundos(duracionEnSegundos, llamada);
      await ejecutar({ tipo: 'fundido', sentido, duracionEnSegundos });
    },

    async video(clave) {
      await ejecutar({ tipo: 'video', clavePorIdioma: { es: clave, en: clave } });
    },

    async dice(personaje, texto, opciones) {
      exigirPersonaje(personaje, `dice("${personaje}", …)`);
      await ejecutar({ tipo: 'linea', hablante: personaje, texto, audio: opciones?.audio });
    },

    async camina(personaje, punto) {
      const llamada = `camina("${personaje}", "${punto}")`;
      exigirPersonaje(personaje, llamada);
      exigirPunto(punto, llamada);
      await ejecutar({ tipo: 'camina', personaje, punto });
    },

    async efecto(nombre) {
      if (!EFECTOS_DISPONIBLES.includes(nombre)) {
        fallar(`efecto("${nombre}")`, `ese efecto no existe; los efectos son: ${EFECTOS_DISPONIBLES.join(', ')}`);
      }
      await ejecutar({ tipo: 'efecto', nombre });
    },

    async secuencia(nombre) {
      if (!Object.hasOwn(contenido.secuencias, nombre)) {
        fallar(`secuencia("${nombre}")`, 'esa secuencia no existe en "secuencias"');
      }
      await ejecutar({ tipo: 'secuencia', nombre });
    },

    sale(destino) {
      ejecucion.acciones.pedirSalida(destino);
    },

    estado: {
      obtener: (nombre) => valorDe(ejecucion.estado.actual, nombre),
      cumple: (condicion) => cumpleCondicion(leerCondicionDeTexto(condicion), ejecucion.estado.actual),
      pon: (nombre, valor) => {
        ejecucion.estado.aplicar({ [nombre]: valor });
      },
    },
    senal: pedido.finDelNivel,
  };
}

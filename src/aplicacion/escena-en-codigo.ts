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
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import { valorDe } from '../dominio/estado.ts';
import type { Punto } from '../dominio/geometria.ts';
import { CAMARA_AL_JUGADOR, EFECTOS_DISPONIBLES } from '../dominio/paso.ts';
import type { Paso } from '../dominio/paso.ts';
import type {
  EscenaDeCinematica,
  EstadoParaCinematica,
  OpcionesDeAnimacion,
  OpcionesDeDuracion,
  OpcionesDeLinea,
  VideoPorIdioma,
} from '../puertos/cinematica-en-codigo.ts';
import type { EjecucionDePasos } from './ejecucion-de-pasos.ts';
import { ejecutarPasos } from './ejecutar-pasos.ts';
import { armarLineaDesdeCodigo } from './linea-desde-codigo.ts';

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

// Este objeto se le entrega al código del host, así que lo interno va con `#` y no con `private`:
// `private` solo lo oculta a TypeScript, y desde JavaScript se podría leer `escena.pedido` o llamar
// `escena.ejecutar(...)`. Con `#`, la escena solo muestra sus pasos, `estado` y `senal`.
export class EscenaEnCodigo implements EscenaDeCinematica {
  readonly estado: EstadoParaCinematica;
  readonly senal: AbortSignal;
  readonly #pedido: PedidoDeEscenaEnCodigo;

  constructor(pedido: PedidoDeEscenaEnCodigo) {
    this.#pedido = pedido;
    this.senal = pedido.finDelNivel;
    const estado = pedido.ejecucion.estado;
    this.estado = {
      obtener: (nombre) => valorDe(estado.actual, nombre),
      cumple: (condicion) => cumpleCondicion(leerCondicionDeTexto(condicion), estado.actual),
      pon: (nombre, valor) => {
        estado.aplicar({ [nombre]: valor });
      },
    };
  }

  // Los pasos se guardan como propiedades (funciones flecha) y no como métodos: así siguen funcionando
  // si quien escribe la cinemática los separa del objeto, como en `const { dice, camina } = escena`.

  readonly juntos = async (...pasos: readonly Promise<void>[]): Promise<void> => {
    await Promise.all(pasos);
  };

  readonly espera = async (segundos: number): Promise<void> => {
    this.#exigirSegundos(segundos, `espera(${segundos})`);
    await this.#ejecutar({ tipo: 'espera', esperaEnSegundos: segundos });
  };

  readonly camara = async (destino: string, opciones?: OpcionesDeDuracion): Promise<void> => {
    const llamada = `camara("${destino}")`;
    const contenido = this.#pedido.ejecucion.contenido;
    const duracionEnSegundos = opciones?.duracion ?? 0;
    this.#exigirSegundos(duracionEnSegundos, llamada);

    if (destino === CAMARA_AL_JUGADOR && contenido.jugador === undefined) {
      this.#fallar(llamada, 'el nivel no tiene jugador');
    }
    const esUnPlano = Object.hasOwn(contenido.mundo.planos, destino);
    const esUnPersonaje = Object.hasOwn(contenido.meta.personajes, destino);
    if (destino !== CAMARA_AL_JUGADOR && !esUnPlano && !esUnPersonaje) {
      this.#fallar(llamada, `"${destino}" no es un plano de mundo.planos, ni un personaje, ni "jugador"`);
    }
    await this.#ejecutar({ tipo: 'camara', destino, duracionEnSegundos });
  };

  readonly mira = async (personaje: string, hacia: string): Promise<void> => {
    const llamada = `mira("${personaje}", "${hacia}")`;
    this.#exigirPersonaje(personaje, llamada);
    const miraAUnPersonaje = Object.hasOwn(this.#pedido.ejecucion.contenido.meta.personajes, hacia);
    const miraAUnPunto = Object.hasOwn(this.#pedido.lugares.puntos, hacia);
    if (!miraAUnPersonaje && !miraAUnPunto) {
      this.#fallar(llamada, `"${hacia}" no es un personaje ni un punto del mapa`);
    }
    await this.#ejecutar({ tipo: 'mira', personaje, hacia });
  };

  readonly anima = async (personaje: string, clave: string, opciones?: OpcionesDeAnimacion): Promise<void> => {
    const llamada = `anima("${personaje}", "${clave}")`;
    this.#exigirPersonaje(personaje, llamada);
    const tipoDeAsset = this.#buscarTipoDeAsset(clave);
    if (tipoDeAsset !== 'animacion' && tipoDeAsset !== 'imagen') {
      this.#fallar(llamada, `no existe la animación ni la imagen "${clave}" en los assets del nivel`);
    }
    await this.#ejecutar({ tipo: 'anima', personaje, clave, repite: opciones?.repite ?? false });
  };

  readonly aparece = async (personaje: string, punto: string): Promise<void> => {
    const llamada = `aparece("${personaje}", "${punto}")`;
    this.#exigirPersonaje(personaje, llamada);
    this.#exigirPunto(punto, llamada);
    await this.#ejecutar({ tipo: 'aparece', personaje, punto });
  };

  readonly desaparece = async (personaje: string): Promise<void> => {
    const llamada = `desaparece("${personaje}")`;
    this.#exigirPersonaje(personaje, llamada);
    const jugador = this.#pedido.ejecucion.contenido.jugador;
    if (jugador !== undefined && jugador.personaje === personaje) {
      this.#fallar(llamada, 'no se puede sacar del escenario al personaje del jugador');
    }
    await this.#ejecutar({ tipo: 'desaparece', personaje });
  };

  readonly musica = async (clave: string): Promise<void> => {
    await this.#ejecutar({ tipo: 'musica', clave });
  };

  readonly sonido = async (clave: string): Promise<void> => {
    await this.#ejecutar({ tipo: 'sonido', clave });
  };

  readonly fundido = async (sentido: 'abrir' | 'cerrar', opciones?: OpcionesDeDuracion): Promise<void> => {
    const llamada = `fundido("${sentido}")`;
    if (sentido !== 'abrir' && sentido !== 'cerrar') {
      this.#fallar(llamada, 'el sentido debe ser "abrir" o "cerrar"');
    }
    const duracionEnSegundos = opciones?.duracion ?? 0;
    this.#exigirSegundos(duracionEnSegundos, llamada);
    await this.#ejecutar({ tipo: 'fundido', sentido, duracionEnSegundos });
  };

  readonly video = async (clave: string | VideoPorIdioma): Promise<void> => {
    if (typeof clave === 'string') {
      // Un video sin voces es el mismo en los dos idiomas.
      await this.#ejecutar({ tipo: 'video', clavePorIdioma: { es: clave, en: clave } });
      return;
    }
    const traeLosDosIdiomas = esObjetoPlano(clave) && typeof clave.es === 'string' && typeof clave.en === 'string';
    if (!traeLosDosIdiomas) {
      this.#fallar('video(…)', 'se espera la clave del video, o una por idioma: { es: "…", en: "…" }');
    }
    await this.#ejecutar({ tipo: 'video', clavePorIdioma: { es: clave.es, en: clave.en } });
  };

  readonly dice = async (personaje: string, texto: string, opciones?: OpcionesDeLinea): Promise<void> => {
    const llamada = `dice("${personaje}", …)`;
    this.#exigirPersonaje(personaje, llamada);

    const { contenido } = this.#pedido.ejecucion;
    const linea = armarLineaDesdeCodigo({ personaje, texto, opciones }, contenido, this.#pedido.lugares.assets);
    if (linea.tipo === 'problema') {
      this.#fallar(llamada, linea.problema);
    }
    await this.#ejecutar(linea.paso);
  };

  readonly camina = async (personaje: string, punto: string): Promise<void> => {
    const llamada = `camina("${personaje}", "${punto}")`;
    this.#exigirPersonaje(personaje, llamada);
    this.#exigirPunto(punto, llamada);
    await this.#ejecutar({ tipo: 'camina', personaje, punto });
  };

  readonly efecto = async (nombre: string): Promise<void> => {
    if (!EFECTOS_DISPONIBLES.includes(nombre)) {
      const disponibles = EFECTOS_DISPONIBLES.join(', ');
      this.#fallar(`efecto("${nombre}")`, `ese efecto no existe; los efectos son: ${disponibles}`);
    }
    await this.#ejecutar({ tipo: 'efecto', nombre });
  };

  readonly secuencia = async (nombre: string): Promise<void> => {
    if (!Object.hasOwn(this.#pedido.ejecucion.contenido.secuencias, nombre)) {
      this.#fallar(`secuencia("${nombre}")`, 'esa secuencia no existe en "secuencias"');
    }
    await this.#ejecutar({ tipo: 'secuencia', nombre });
  };

  readonly acompana = (personaje: string | null): void => {
    const llamada = `acompana(${JSON.stringify(personaje)})`;
    const jugador = this.#pedido.ejecucion.contenido.jugador;
    if (jugador === undefined) {
      this.#fallar(llamada, 'el nivel no tiene jugador a quien acompañar');
    }
    if (personaje !== null) {
      this.#exigirPersonaje(personaje, llamada);
    }
    this.#pedido.ejecucion.acciones.cambiarAcompanante(personaje ?? undefined);
  };

  readonly sale = (destino: string): void => {
    this.#pedido.ejecucion.acciones.pedirSalida(destino);
  };

  #ejecutar(paso: Paso): Promise<void> {
    return ejecutarPasos([paso], this.#pedido.ejecucion);
  }

  /** Lanza el error de una llamada mal hecha. `llamada` es, por ejemplo, `camina("mama", "sillon")`. */
  #fallar(llamada: string, problema: string): never {
    const cinematica = this.#pedido.nombre;
    throw new Error(`[escenario-engine] cinemática en código "${cinematica}": escena.${llamada}: ${problema}`);
  }

  #exigirPersonaje(personaje: string, llamada: string): void {
    if (!Object.hasOwn(this.#pedido.ejecucion.contenido.meta.personajes, personaje)) {
      this.#fallar(llamada, `el personaje "${personaje}" no existe en meta.personajes`);
    }
  }

  #exigirPunto(punto: string, llamada: string): void {
    if (!Object.hasOwn(this.#pedido.lugares.puntos, punto)) {
      this.#fallar(llamada, `no hay un punto llamado "${punto}" en el mapa`);
    }
  }

  #exigirSegundos(segundos: number, llamada: string): void {
    // Con un número que no sirve (NaN, negativo), la espera no terminaría nunca.
    if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos < 0) {
      this.#fallar(llamada, 'los segundos deben ser un número de 0 en adelante');
    }
  }

  /** El tipo del asset con esa clave (`'imagen'`, `'animacion'`…), o `undefined` si el nivel no lo tiene. */
  #buscarTipoDeAsset(clave: string): string | undefined {
    const assets = this.#pedido.lugares.assets;
    if (!Object.hasOwn(assets, clave)) return undefined;
    return assets[clave]!.asset.tipo; // `hasOwn` acaba de comprobar que existe
  }
}

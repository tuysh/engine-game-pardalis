// Caso de uso: poner a jugar un nivel ya validado. Monta la escenografía y los personajes,
// conecta los toques del jugador con el nivel (caminar, hablar, salir) y dibuja un cuadro tras otro.
//
// Estado: faltan las zonas con comentarios, la flecha de la salida y los efectos
// (ver crear-acciones-de-paso.ts).

import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { VariablesDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import { crearTerreno } from '../dominio/terreno.ts';
import type { Audio } from '../puertos/audio.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { Minijuego } from '../puertos/minijuego.ts';
import type { Reloj } from '../puertos/reloj.ts';
import { atenderToque } from './atender-toque.ts';
import { Conversacion } from './conversacion.ts';
import { crearAccionesDePaso } from './crear-acciones-de-paso.ts';
import { buscarDireccionDeAsset } from './direccion-de-asset.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { Exploracion } from './exploracion.ts';
import { prepararEscenografia, prepararPersonajes } from './preparar-escena.ts';
import { Reparto } from './reparto.ts';

/** Lo que se va a jugar. */
export interface PedidoDeJuego {
  readonly nivel: Nivel;
  readonly ubicacion: UbicacionDeAssets;
  /** El idioma del sitio. */
  readonly idiomaBase: Idioma;
  /** Los minijuegos que registró el host, por nombre. */
  readonly minijuegos: Readonly<Record<string, Minijuego>>;
  /** Las variables del nivel en una partida guardada. `undefined` = el nivel empieza de cero. */
  readonly variablesGuardadas?: VariablesDeEstado;
}

export interface PuertosParaJugar {
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
  readonly audio: Audio;
  readonly reloj: Reloj;
}

/** Cómo el nivel le avisa de lo que pasa a quien lo puso a jugar. */
export interface AvisosDelNivel {
  alCumplirObjetivo(objetivo: string): void;
  alVerPalabra(palabra: PalabraDeVocabulario): void;
  /** El jugador salió por la salida del nivel hacia ese destino. */
  alSalir(destino: string): void;
  /** Un diálogo falló con un error inesperado y se dio por terminado. */
  alFallar(error: unknown): void;
}

/** Un nivel que se está jugando. */
export interface NivelEnJuego {
  /** Las variables del nivel en este momento, para guardarlas en una partida. */
  leerVariables(): VariablesDeEstado;
  /** Termina el diálogo en curso. Si no hay ninguno, no hace nada. */
  interrumpir(): void;
  /** Deja de atender toques y de dibujar, y termina el diálogo en curso. No destruye el escenario. */
  terminar(): void;
}

/** La promesa termina cuando el nivel ya se ve y se puede jugar. */
export async function jugarNivel(
  pedido: PedidoDeJuego,
  puertos: PuertosParaJugar,
  avisos: AvisosDelNivel,
): Promise<NivelEnJuego> {
  const { nivel, ubicacion } = pedido;
  const { escenario, interfaz, audio, reloj } = puertos;

  await escenario.montar(prepararEscenografia(nivel, ubicacion));
  const reparto = new Reparto(escenario);
  const personajes = prepararPersonajes(nivel, ubicacion);
  // Todas las imágenes de personajes se piden a la vez, para que la carga dure lo que dura la más lenta.
  await Promise.all(personajes.map((personaje) => reparto.agregar(personaje)));

  const exploracion = crearExploracion(nivel, escenario, reparto);
  if (exploracion === undefined) {
    // Un nivel sin jugador no tiene a quién seguir: la cámara mira al centro del lugar.
    const centro = { x: nivel.mundo.anchoEnMetros / 2, y: nivel.mundo.profundidadEnMetros / 2 };
    escenario.enfocar(centro, nivel.contenido.mundo.camara, { deInmediato: true });
  }

  const estadoInicial = crearEstadoDeNivel(nivel.contenido.estado, pedido.variablesGuardadas);
  const estado = new EstadoEnJuego(estadoInicial, (objetivo) => avisos.alCumplirObjetivo(objetivo));
  const acciones = crearAccionesDePaso({
    contenido: nivel.contenido,
    puntos: nivel.mundo.puntos,
    idiomaBase: pedido.idiomaBase,
    escenario,
    interfaz,
    audio,
    reloj,
    reparto,
    estado,
    minijuegos: pedido.minijuegos,
    direccionDeAsset: (clave) => buscarDireccionDeAsset(clave, nivel.assets, ubicacion),
    alVerPalabra: (palabra) => avisos.alVerPalabra(palabra),
  });
  const conversacion = new Conversacion({
    contenido: nivel.contenido,
    estado,
    acciones,
    alFallar: (error) => avisos.alFallar(error),
  });

  const piezasParaToques = { nivel, reparto, conversacion, estado, exploracion, alSalir: avisos.alSalir };
  const dejarDeAtenderToques = escenario.alTocar((toque) => atenderToque(toque, piezasParaToques));
  const dejarDeDibujar = reloj.enCadaCuadro((segundos) => {
    if (exploracion !== undefined) {
      exploracion.avanzar(segundos);
    }
    escenario.dibujar(segundos);
  });

  return {
    leerVariables(): VariablesDeEstado {
      return estado.actual.variables;
    },
    interrumpir(): void {
      conversacion.interrumpir();
    },
    terminar(): void {
      conversacion.interrumpir();
      dejarDeAtenderToques();
      dejarDeDibujar();
    },
  };
}

/** El control libre del jugador, o `undefined` si el nivel no tiene jugador. */
function crearExploracion(nivel: Nivel, escenario: Escenario, reparto: Reparto): Exploracion | undefined {
  const jugador = nivel.contenido.jugador;
  if (jugador === undefined) return undefined;

  return new Exploracion({
    escenario,
    reparto,
    terreno: crearTerreno(nivel.mundo),
    idDelJugador: jugador.personaje,
    velocidadEnMetrosPorSegundo: jugador.velocidadEnMetrosPorSegundo,
    camara: nivel.contenido.mundo.camara,
  });
}

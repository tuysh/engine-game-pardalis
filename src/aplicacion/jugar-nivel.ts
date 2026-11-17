// Caso de uso: poner a jugar un nivel ya validado. Monta la escenografía y los personajes,
// conecta los toques del jugador con su personaje y dibuja un cuadro tras otro.
//
// Estado: por ahora solo se puede caminar tocando el piso. Hablar con personajes, la salida,
// las zonas y los minijuegos se conectan aquí en las fases siguientes (docs/DISENO-3.0.md §13).

import type { Nivel } from '../dominio/nivel.ts';
import { crearTerreno } from '../dominio/terreno.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Reloj } from '../puertos/reloj.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';
import { Exploracion } from './exploracion.ts';
import { prepararEscenografia, prepararPersonajes } from './preparar-escena.ts';
import { Reparto } from './reparto.ts';

export interface PuertosParaJugar {
  readonly escenario: Escenario;
  readonly reloj: Reloj;
}

/** Un nivel que se está jugando. */
export interface NivelEnJuego {
  /** Deja de atender toques y de dibujar. No destruye el escenario. */
  terminar(): void;
}

/** La promesa termina cuando el nivel ya se ve y se puede jugar. */
export async function jugarNivel(
  nivel: Nivel,
  ubicacion: UbicacionDeAssets,
  puertos: PuertosParaJugar,
): Promise<NivelEnJuego> {
  const { escenario, reloj } = puertos;

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

  const dejarDeAtenderToques = escenario.alTocar((toque) => {
    if (toque.tipo === 'piso' && exploracion !== undefined) {
      exploracion.irA(toque.punto);
    }
  });
  const dejarDeDibujar = reloj.enCadaCuadro((segundos) => {
    if (exploracion !== undefined) {
      exploracion.avanzar(segundos);
    }
    escenario.dibujar(segundos);
  });

  return {
    terminar(): void {
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

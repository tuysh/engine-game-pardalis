// Las hojas de papel que están animadas: cada una muestra, un cuadro tras otro, las texturas de su animación.

import { MeshBasicMaterial } from 'three';
import type { Mesh, Object3D, Texture } from 'three';

/** Cómo se reproduce una animación. */
export interface RitmoDeAnimacion {
  readonly cuadrosPorSegundo: number;
  /** `true`: al terminar vuelve a empezar. `false`: se queda en su último cuadro. */
  readonly repite: boolean;
}

interface AnimacionEnCurso {
  readonly hoja: Mesh;
  readonly texturas: readonly Texture[];
  readonly ritmo: RitmoDeAnimacion;
  segundosTranscurridos: number;
}

export class AnimacionesDeHojas {
  /** La animación de cada hoja animada. Las piezas que no están aquí muestran una imagen fija. */
  private readonly animaciones = new Map<Object3D, AnimacionEnCurso>();

  /** Empieza a animar una hoja desde su primer cuadro. Con un solo cuadro no hay nada que animar. */
  animar(hoja: Mesh, texturas: readonly Texture[], ritmo: RitmoDeAnimacion): void {
    if (texturas.length < 2 || ritmo.cuadrosPorSegundo <= 0) return;
    this.animaciones.set(hoja, { hoja, texturas, ritmo, segundosTranscurridos: 0 });
  }

  /** Deja de animar una pieza, por ejemplo porque se quitó del escenario. Si no estaba animada, no hace nada. */
  olvidar(pieza: Object3D): void {
    this.animaciones.delete(pieza);
  }

  olvidarTodas(): void {
    this.animaciones.clear();
  }

  /** Pone en cada hoja el cuadro que le toca. `segundos` es el tiempo desde el cuadro anterior del juego. */
  avanzar(segundos: number): void {
    for (const animacion of this.animaciones.values()) {
      animacion.segundosTranscurridos += segundos;
      const textura = buscarCuadro(animacion);
      const material = animacion.hoja.material;
      // Todas las hojas del escenario usan un solo `MeshBasicMaterial` (ver piezas-de-papel.ts).
      if (material instanceof MeshBasicMaterial && material.map !== textura) {
        material.map = textura;
      }
    }
  }
}

/** La textura del cuadro que le toca a una animación según el tiempo que lleva. */
function buscarCuadro(animacion: AnimacionEnCurso): Texture {
  const cantidad = animacion.texturas.length;
  let posicion = Math.floor(animacion.segundosTranscurridos * animacion.ritmo.cuadrosPorSegundo);
  if (animacion.ritmo.repite) {
    posicion = posicion % cantidad;
  } else {
    posicion = Math.min(posicion, cantidad - 1);
  }
  return animacion.texturas[posicion]!; // `posicion` siempre queda entre 0 y `cantidad - 1`
}

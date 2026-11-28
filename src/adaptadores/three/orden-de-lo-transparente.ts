// En qué orden dibuja Three.js las piezas transparentes (todas las hojas de papel lo son).
//
// Las hojas no tapan por profundidad (piezas-de-papel.ts): se dibujan de la más lejana a la más cercana, y la
// última queda encima. Three.js, por su cuenta, mide qué tan lejos está cada pieza desde el **centro** de su
// forma. Para una hoja parada eso falla: el centro de un árbol alto queda a media altura y, visto desde una
// cámara levantada, más cerca que el centro de un personaje bajito parado delante de él, así que el árbol se
// dibujaba encima del personaje. Aquí se mide desde el punto donde cada hoja **pisa** (su origen), que es lo
// que dice quién está delante de quién en el piso.
//
// El orden de dibujo (`renderOrder`) sigue mandando primero: lo del piso siempre va antes que lo parado.

import { Vector3 } from 'three';
import type { Camera, Object3D } from 'three';

/** Lo que Three.js da de cada pieza al ordenarlas. Son campos de su `RenderItem`. */
interface PiezaPorDibujar {
  readonly groupOrder: number;
  readonly renderOrder: number;
  readonly object: Object3D;
  readonly id: number;
}

/**
 * La función con la que Three.js ordena lo transparente (`WebGLRenderer.setTransparentSort`):
 * primero por su orden de dibujo; entre las del mismo orden, la más lejana de la cámara va antes.
 */
export function crearOrdenDeLoTransparente(camara: Camera): (a: PiezaPorDibujar, b: PiezaPorDibujar) => number {
  // Se reúsan para no crear dos vectores en cada comparación, que son cientos por cuadro.
  const dondePisaA = new Vector3();
  const dondePisaB = new Vector3();

  return (a, b) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;

    const profundidadDeA = profundidadAnteLaCamara(a.object, camara, dondePisaA);
    const profundidadDeB = profundidadAnteLaCamara(b.object, camara, dondePisaB);
    if (profundidadDeA !== profundidadDeB) return profundidadDeB - profundidadDeA;
    // A la misma profundidad, el orden en que se agregaron: así no cambian de lugar entre un cuadro y otro.
    return a.id - b.id;
  };
}

/**
 * Qué tan adelante de la cámara queda el punto donde pisa la pieza (su origen), en metros.
 * Usa las posiciones del último cálculo de Three.js (`matrixWorld`), que al dibujar ya son las del cuadro.
 * `vector` es dónde se hace la cuenta, para no crear uno nuevo cada vez.
 */
export function profundidadAnteLaCamara(pieza: Object3D, camara: Camera, vector = new Vector3()): number {
  vector.setFromMatrixPosition(pieza.matrixWorld).applyMatrix4(camara.matrixWorldInverse);
  // La cámara mira hacia su `z` negativa: lo que está delante de ella tiene `z` menor que cero.
  return -vector.z;
}

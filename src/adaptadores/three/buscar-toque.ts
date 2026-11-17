// Averigua qué tocó el jugador: lanza una línea imaginaria desde la cámara por el punto tocado
// y ve con qué choca primero. Si no choca con nada que se pueda tocar, busca dónde cruza el piso.

import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Camera, Object3D } from 'three';
import type { Toque } from '../../puertos/escenario.ts';

/** Un lugar de la pantalla dentro del lienzo, en puntos de CSS desde su esquina superior izquierda. */
export interface LugarEnElLienzo {
  readonly x: number;
  readonly y: number;
  readonly anchoDelLienzo: number;
  readonly altoDelLienzo: number;
}

/** El piso como plano infinito: todo lo que tiene altura 0. */
const PLANO_DEL_PISO = new Plane(new Vector3(0, 1, 0), 0);

/**
 * `tocables` son los objetos que responden al toque, cada uno con el toque que le corresponde.
 * Devuelve `undefined` si se tocó el cielo: ni un objeto ni el piso.
 */
export function buscarToque(
  lugar: LugarEnElLienzo,
  camara: Camera,
  tocables: ReadonlyMap<Object3D, Toque>,
): Toque | undefined {
  // Three.js mide la pantalla de -1 a 1, con el centro en 0 y la `y` hacia arriba.
  const lugarParaThree = new Vector2(
    (lugar.x / lugar.anchoDelLienzo) * 2 - 1,
    -(lugar.y / lugar.altoDelLienzo) * 2 + 1,
  );
  const lanzador = new Raycaster();
  lanzador.setFromCamera(lugarParaThree, camara);

  // Los choques llegan ordenados del más cercano a la cámara al más lejano.
  const choques = lanzador.intersectObjects([...tocables.keys()], false);
  const primerChoque = choques[0];
  if (primerChoque !== undefined) {
    return tocables.get(primerChoque.object);
  }

  const cruceConElPiso = lanzador.ray.intersectPlane(PLANO_DEL_PISO, new Vector3());
  if (cruceConElPiso === null) return undefined;
  // En el plano del lugar, la profundidad `y` es la `z` del espacio 3D.
  return { tipo: 'piso', punto: { x: cruceConElPiso.x, y: cruceConElPiso.z } };
}

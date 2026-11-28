// Lo parado del decorado que tapa al jugador se vuelve transparente mientras lo tapa.
//
// Un árbol o una persona parada cerca de la cámara se ve enorme y puede esconder al jugador (o la salida).
// En vez de pedir que se mueva el dibujo, mientras una pieza esté entre la cámara y el jugador y lo cubra,
// se aclara poco a poco hasta dejarlo ver; cuando ya no lo tapa, vuelve a verse completa.
//
// «Lo tapa» se mide en la pantalla: cuánto del rectángulo que ocupa el jugador queda dentro del rectángulo
// que ocupa la pieza. Solo cuentan las piezas que están más cerca de la cámara que el jugador.

import { Box3, MeshBasicMaterial, Vector3 } from 'three';
import type { Camera, Mesh } from 'three';

/** Qué tanto se ve una pieza mientras tapa al jugador: 1 = completa, 0 = nada. */
const OPACIDAD_MIENTRAS_TAPA = 0.35;
/** Cuánta opacidad cambia por segundo: de completa a transparente en unas dos décimas de segundo. */
const CAMBIO_DE_OPACIDAD_POR_SEGUNDO = 3.5;
/** Qué parte del jugador (de su rectángulo en la pantalla) debe quedar cubierta para que la pieza se aclare. */
const PARTE_CUBIERTA_QUE_CUENTA = 0.25;

/** Un rectángulo de la pantalla, en la medida de Three.js: de -1 a 1 en cada eje. */
interface RectanguloEnPantalla {
  readonly izquierda: number;
  readonly derecha: number;
  readonly abajo: number;
  readonly arriba: number;
}

export class DecoradoQueSeTransparenta {
  /** Las piezas paradas del decorado que pueden aclararse. */
  private piezas: Mesh[] = [];

  /** Anota una pieza parada del decorado. */
  agregar(pieza: Mesh): void {
    this.piezas.push(pieza);
  }

  /** Olvida todas las piezas (se montó otra escenografía). No las libera: eso lo hace quien las creó. */
  olvidarTodas(): void {
    this.piezas = [];
  }

  /**
   * Aclara poco a poco lo que tapa a `hojaDelJugador` y devuelve su color completo a lo demás.
   * Sin jugador (`undefined`), todo vuelve a verse completo. `segundos` es el tiempo desde el cuadro anterior.
   */
  actualizar(camara: Camera, hojaDelJugador: Mesh | undefined, segundos: number): void {
    let rectanguloDelJugador: RectanguloEnPantalla | undefined;
    let distanciaDelJugador = 0;
    if (hojaDelJugador !== undefined) {
      rectanguloDelJugador = rectanguloEnPantallaDe(hojaDelJugador, camara);
      distanciaDelJugador = distanciaALaCamara(hojaDelJugador, camara);
    }

    for (const pieza of this.piezas) {
      let opacidadDeseada = 1;
      const estaMasCercaDeLaCamara = distanciaALaCamara(pieza, camara) < distanciaDelJugador;
      if (rectanguloDelJugador !== undefined && estaMasCercaDeLaCamara) {
        const cubierta = parteCubierta(rectanguloDelJugador, rectanguloEnPantallaDe(pieza, camara));
        if (cubierta >= PARTE_CUBIERTA_QUE_CUENTA) {
          opacidadDeseada = OPACIDAD_MIENTRAS_TAPA;
        }
      }
      acercarOpacidad(pieza, opacidadDeseada, CAMBIO_DE_OPACIDAD_POR_SEGUNDO * segundos);
    }
  }
}

/** Mueve la opacidad de la pieza hacia la deseada, sin cambiarla más que `cambioMaximo` en este cuadro. */
function acercarOpacidad(pieza: Mesh, opacidadDeseada: number, cambioMaximo: number): void {
  const material = pieza.material;
  // Todas las piezas paradas usan un solo `MeshBasicMaterial` (piezas-de-papel.ts).
  if (!(material instanceof MeshBasicMaterial)) return;

  const diferencia = opacidadDeseada - material.opacity;
  if (Math.abs(diferencia) <= cambioMaximo) {
    material.opacity = opacidadDeseada;
    return;
  }
  material.opacity += Math.sign(diferencia) * cambioMaximo;
}

function distanciaALaCamara(pieza: Mesh, camara: Camera): number {
  const centro = new Box3().setFromObject(pieza).getCenter(new Vector3());
  return centro.distanceTo(camara.position);
}

/** El rectángulo de la pantalla que encierra a la pieza tal como la ve la cámara. */
function rectanguloEnPantallaDe(pieza: Mesh, camara: Camera): RectanguloEnPantalla {
  const caja = new Box3().setFromObject(pieza);
  let izquierda = Infinity;
  let derecha = -Infinity;
  let abajo = Infinity;
  let arriba = -Infinity;
  // Las ocho esquinas de la caja que ocupa la pieza en el espacio, llevadas a la pantalla.
  for (const x of [caja.min.x, caja.max.x]) {
    for (const y of [caja.min.y, caja.max.y]) {
      for (const z of [caja.min.z, caja.max.z]) {
        const enPantalla = new Vector3(x, y, z).project(camara);
        izquierda = Math.min(izquierda, enPantalla.x);
        derecha = Math.max(derecha, enPantalla.x);
        abajo = Math.min(abajo, enPantalla.y);
        arriba = Math.max(arriba, enPantalla.y);
      }
    }
  }
  return { izquierda, derecha, abajo, arriba };
}

/** Qué parte de `tapado` queda dentro de `encima`: 0 = nada, 1 = todo. */
function parteCubierta(tapado: RectanguloEnPantalla, encima: RectanguloEnPantalla): number {
  const anchoComun = Math.min(tapado.derecha, encima.derecha) - Math.max(tapado.izquierda, encima.izquierda);
  const altoComun = Math.min(tapado.arriba, encima.arriba) - Math.max(tapado.abajo, encima.abajo);
  if (anchoComun <= 0 || altoComun <= 0) return 0;

  const areaDelTapado = (tapado.derecha - tapado.izquierda) * (tapado.arriba - tapado.abajo);
  if (areaDelTapado <= 0) return 0;
  return (anchoComun * altoComun) / areaDelTapado;
}

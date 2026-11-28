// Lo parado del decorado que tapa al jugador se vuelve transparente mientras lo tapa.
//
// Un árbol o una persona parada cerca de la cámara se ve enorme y puede esconder al jugador (o la salida).
// En vez de pedir que se mueva el dibujo, mientras una pieza esté entre la cámara y el jugador y lo cubra,
// se aclara poco a poco hasta dejarlo ver; cuando ya no lo tapa, vuelve a verse completa.
//
// «Lo tapa» se mide en la pantalla: cuánto de la mitad de arriba del jugador (cabeza y cuerpo) queda dentro del
// rectángulo que ocupa la pieza. Lo bajito que solo le tapa los pies (una banca, una fuente) no se aclara: el
// jugador se sigue viendo, y una banca medio transparente cada vez que pasa detrás se vería rara. Solo cuentan las piezas que están más cerca de la cámara que el jugador, medido igual que
// el orden de dibujo (orden-de-lo-transparente.ts): desde el punto donde pisa cada hoja. Así solo se aclara
// lo que de verdad se dibuja encima del jugador.

import { Box3, MeshBasicMaterial, Vector3 } from 'three';
import type { Camera, Mesh } from 'three';
import { profundidadAnteLaCamara } from './orden-de-lo-transparente.ts';

/** Qué tanto se ve una pieza mientras tapa al jugador: 1 = completa, 0 = nada. */
const OPACIDAD_MIENTRAS_TAPA = 0.35;
/** Cuánta opacidad cambia por segundo: de completa a transparente en unas dos décimas de segundo. */
const CAMBIO_DE_OPACIDAD_POR_SEGUNDO = 3.5;
/** Qué parte del jugador (de su rectángulo en la pantalla) debe quedar cubierta para que la pieza se aclare. */
const PARTE_CUBIERTA_QUE_CUENTA = 0.25;
/** Qué parte del alto del jugador, contando desde su cabeza, es la que no debe quedar tapada. */
const PARTE_DE_ARRIBA_DEL_JUGADOR = 0.5;

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

  /** Pone `nueva` en el lugar de `vieja`, si `vieja` estaba anotada (un paso `anima` le cambió el dibujo). */
  cambiar(vieja: Mesh, nueva: Mesh): void {
    this.piezas = this.piezas.map((pieza) => (pieza === vieja ? nueva : pieza));
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
    // La cámara pudo moverse desde el último dibujo: así las medidas son las de este cuadro.
    camara.updateMatrixWorld();
    let rectanguloDelJugador: RectanguloEnPantalla | undefined;
    let profundidadDelJugador = 0;
    if (hojaDelJugador !== undefined) {
      const rectanguloCompleto = rectanguloEnPantallaDe(cajaDeLaHojaSinVoltear(hojaDelJugador), camara);
      rectanguloDelJugador = soloLaParteDeArriba(rectanguloCompleto, PARTE_DE_ARRIBA_DEL_JUGADOR);
      profundidadDelJugador = profundidadAnteLaCamara(hojaDelJugador, camara);
    }

    for (const pieza of this.piezas) {
      let opacidadDeseada = 1;
      const profundidad = profundidadAnteLaCamara(pieza, camara);
      // Lo que queda detrás de la cámara no se ve, y llevado a la pantalla daría un rectángulo sin sentido.
      const estaMasCercaDeLaCamara = profundidad > 0 && profundidad < profundidadDelJugador;
      if (rectanguloDelJugador !== undefined && estaMasCercaDeLaCamara) {
        const cajaDeLaPieza = new Box3().setFromObject(pieza);
        const cubierta = parteCubierta(rectanguloDelJugador, rectanguloEnPantallaDe(cajaDeLaPieza, camara));
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

/**
 * La caja que ocupa la hoja de un personaje con todo su ancho, aunque esté volteándose.
 * Un personaje se voltea encogiendo su hoja hasta dejarla de canto (personajes-de-papel.ts); medida así,
 * a media vuelta no taparía nada y el árbol que lo tapa parpadearía cada vez que el jugador da la vuelta.
 */
function cajaDeLaHojaSinVoltear(hoja: Mesh): Box3 {
  const caja = new Box3().setFromObject(hoja);
  if (hoja.geometry.boundingBox === null) {
    hoja.geometry.computeBoundingBox();
  }
  const cajaDeLaForma = hoja.geometry.boundingBox;
  if (cajaDeLaForma === null) return caja;

  // Las hojas son de frente a lo largo de `x` (crearHojaParada): su ancho completo es el de su forma.
  const medioAncho = (cajaDeLaForma.max.x - cajaDeLaForma.min.x) / 2;
  const centroEnX = hoja.getWorldPosition(new Vector3()).x;
  caja.min.x = centroEnX - medioAncho;
  caja.max.x = centroEnX + medioAncho;
  return caja;
}

/** El rectángulo de la pantalla que encierra a una caja del espacio tal como la ve la cámara. */
function rectanguloEnPantallaDe(caja: Box3, camara: Camera): RectanguloEnPantalla {
  let izquierda = Infinity;
  let derecha = -Infinity;
  let abajo = Infinity;
  let arriba = -Infinity;
  // Las ocho esquinas de la caja, llevadas a la pantalla.
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

/** La parte de arriba de un rectángulo: `parte` es qué tanto de su alto se queda, contando desde arriba. */
function soloLaParteDeArriba(rectangulo: RectanguloEnPantalla, parte: number): RectanguloEnPantalla {
  const alto = rectangulo.arriba - rectangulo.abajo;
  return { ...rectangulo, abajo: rectangulo.arriba - alto * parte };
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

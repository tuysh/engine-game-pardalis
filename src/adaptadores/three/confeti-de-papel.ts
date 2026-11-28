// El efecto `confeti`: papelitos de colores que llueven sobre lo que se ve, dando vueltas al caer.
//
// Cada papelito es un rectángulo de papel de verdad (no un puntito), que gira sobre sí mismo como el confeti real.
// Se reparten a lo ancho de lo que ve la cámara y su tamaño crece con la distancia a ella: así se ven
// como papelitos sueltos tanto en un plano cercano como en uno lejano (el comedor se ve desde 13 metros).
//
// El azar de aquí es solo de apariencia, por eso usa `Math.random` y no el azar del juego.

import { Color, DoubleSide, InstancedMesh, MathUtils, MeshBasicMaterial, Object3D, PlaneGeometry, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';

const CANTIDAD_DE_PAPELITOS = 110;
const DURACION_EN_SEGUNDOS = 2.4;
const COLORES = [0xe2572b, 0x3fa34d, 0x2f6fd0, 0xf2c230, 0xef7fb0];

/** Lo largo de un papelito como parte de lo alto de la pantalla: siempre se ve del mismo tamaño. */
const LARGO_DEL_PAPELITO_EN_PARTE_DE_LA_PANTALLA = 0.022;
/** Lo ancho de un papelito como parte de lo largo: son rectángulos, no cuadrados. */
const PROPORCION_DEL_PAPELITO = 0.6;

/** Entre qué partes de la distancia a lo que se mira caen los papelitos: unos más cerca, otros más lejos. */
const PROFUNDIDAD_MINIMA_EN_PARTE_DE_LA_DISTANCIA = 0.55;
const PROFUNDIDAD_MAXIMA_EN_PARTE_DE_LA_DISTANCIA = 1;
/** Un papelito nunca cae más cerca de la cámara que esto: se vería enorme y borroso. */
const PROFUNDIDAD_MINIMA_EN_METROS = 1.5;

/** Cuánto de lo alto de la pantalla cae cada papelito durante el efecto. */
const CAIDA_MINIMA_EN_PANTALLAS = 0.7;
const CAIDA_MAXIMA_EN_PANTALLAS = 1.3;
/** Los papelitos nacen arriba de lo que se ve, escalonados hasta esta parte de la pantalla, para que lluevan. */
const ESCALONADO_EN_PANTALLAS = 0.5;
/** Qué tan rápido gira cada papelito sobre sí mismo. */
const GIRO_MINIMO_EN_RADIANES_POR_SEGUNDO = 4;
const GIRO_MAXIMO_EN_RADIANES_POR_SEGUNDO = 10;
/** Cuánto se mece de lado al caer, en parte de lo alto de la pantalla, y cuántas veces por segundo. */
const MECIDO_EN_PANTALLAS = 0.03;
const MECIDAS_POR_SEGUNDO = 1.2;
/** En la última parte de su vida los papelitos se van transparentando. */
const PARTE_DE_LA_VIDA_EN_QUE_EMPIEZAN_A_DESAPARECER = 0.7;

/** Los efectos se dibujan después de todo lo demás, para que se vean encima. */
const ORDEN_DE_LOS_EFECTOS = 10;

/** Un papelito: dónde empezó, hacia dónde cae y cómo gira. Todo en el espacio 3D, en metros. */
interface Papelito {
  readonly inicio: Vector3;
  /** Su largo en metros: más grande mientras más lejos de la cámara, para verse siempre del mismo tamaño. */
  readonly largoEnMetros: number;
  /** Metros por segundo hacia abajo. */
  readonly rapidezDeCaida: number;
  /** Hacia dónde se mece: la derecha de la cámara, en metros de mecido. */
  readonly mecido: Vector3;
  readonly faseDelMecido: number;
  readonly ejeDeGiro: Vector3;
  readonly rapidezDeGiro: number;
}

export class ConfetiDePapel {
  /** Los papelitos, dibujados de una vez. Quien crea el efecto lo agrega a la escena y lo quita cuando termina. */
  readonly objeto: InstancedMesh;
  private readonly papelitos: Papelito[] = [];
  private edadEnSegundos = 0;
  /** Una pieza de ayuda para armar la posición y el giro de cada papelito. */
  private readonly acomodo = new Object3D();

  /** `centro` es el punto del lugar alrededor del cual se festeja; con él se mide qué tan lejos cae el confeti. */
  constructor(camara: PerspectiveCamera, centro: Vector3) {
    const geometria = new PlaneGeometry(PROPORCION_DEL_PAPELITO, 1);
    const material = new MeshBasicMaterial({
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      // Un efecto es un adorno de la escena completa: se ve aunque haya algo delante.
      depthTest: false,
    });
    this.objeto = new InstancedMesh(geometria, material, CANTIDAD_DE_PAPELITOS);
    this.objeto.renderOrder = ORDEN_DE_LOS_EFECTOS;
    // Los papelitos se mueven lejos de donde nacieron; sin esto, Three.js podría dejar de dibujarlos.
    this.objeto.frustumCulled = false;

    const distanciaALoQueSeMira = Math.max(camara.position.distanceTo(centro), PROFUNDIDAD_MINIMA_EN_METROS);
    for (let i = 0; i < CANTIDAD_DE_PAPELITOS; i++) {
      this.papelitos.push(crearPapelito(camara, distanciaALoQueSeMira));
      const posicionDelColor = Math.floor(Math.random() * COLORES.length);
      this.objeto.setColorAt(i, new Color(COLORES[posicionDelColor]!)); // la posición es menor que el largo
    }
    this.actualizar(0);
  }

  /** Mueve los papelitos lo que corresponde a un cuadro. Devuelve `false` cuando el efecto ya terminó. */
  actualizar(segundos: number): boolean {
    this.edadEnSegundos += segundos;
    const edad = this.edadEnSegundos;

    for (let i = 0; i < this.papelitos.length; i++) {
      const papelito = this.papelitos[i]!; // `i` es menor que el largo de la lista
      const mecido = Math.sin(papelito.faseDelMecido + edad * MECIDAS_POR_SEGUNDO * Math.PI * 2);
      this.acomodo.position.copy(papelito.inicio);
      this.acomodo.position.y -= papelito.rapidezDeCaida * edad;
      this.acomodo.position.addScaledVector(papelito.mecido, mecido);
      this.acomodo.quaternion.setFromAxisAngle(papelito.ejeDeGiro, papelito.rapidezDeGiro * edad);
      this.acomodo.scale.setScalar(papelito.largoEnMetros);
      this.acomodo.updateMatrix();
      this.objeto.setMatrixAt(i, this.acomodo.matrix);
    }
    this.objeto.instanceMatrix.needsUpdate = true;

    const material = this.objeto.material;
    if (material instanceof MeshBasicMaterial) {
      material.opacity = opacidadA(edad / DURACION_EN_SEGUNDOS);
    }
    return edad < DURACION_EN_SEGUNDOS;
  }

  /** Libera la memoria de video del efecto. */
  liberar(): void {
    this.objeto.geometry.dispose();
    const material = this.objeto.material;
    if (material instanceof MeshBasicMaterial) {
      material.dispose();
    }
    this.objeto.dispose();
  }
}

/** Un papelito al azar, a lo ancho de lo que ve la cámara y un poco arriba de lo que se ve. */
function crearPapelito(camara: PerspectiveCamera, distanciaALoQueSeMira: number): Papelito {
  const haciaAdelante = camara.getWorldDirection(new Vector3());
  const haciaLaDerecha = new Vector3().crossVectors(haciaAdelante, camara.up).normalize();
  const haciaArriba = new Vector3().crossVectors(haciaLaDerecha, haciaAdelante).normalize();

  const parteDeLaDistancia = alAzarEntre(
    PROFUNDIDAD_MINIMA_EN_PARTE_DE_LA_DISTANCIA,
    PROFUNDIDAD_MAXIMA_EN_PARTE_DE_LA_DISTANCIA,
  );
  const profundidad = Math.max(distanciaALoQueSeMira * parteDeLaDistancia, PROFUNDIDAD_MINIMA_EN_METROS);
  // Lo alto y lo ancho de lo que ve la cámara a esa profundidad.
  const altoVisible = 2 * profundidad * Math.tan(MathUtils.degToRad(camara.fov) / 2);
  const anchoVisible = altoVisible * camara.aspect;

  const inicio = camara.position.clone().addScaledVector(haciaAdelante, profundidad);
  inicio.addScaledVector(haciaLaDerecha, alAzarEntre(-0.5, 0.5) * anchoVisible);
  inicio.addScaledVector(haciaArriba, altoVisible * (0.5 + alAzarEntre(0, ESCALONADO_EN_PANTALLAS)));

  const caidaEnMetros = altoVisible * alAzarEntre(CAIDA_MINIMA_EN_PANTALLAS, CAIDA_MAXIMA_EN_PANTALLAS);
  const ejeDeGiro = new Vector3(alAzarEntre(-1, 1), alAzarEntre(-1, 1), alAzarEntre(-1, 1)).normalize();
  return {
    inicio,
    largoEnMetros: altoVisible * LARGO_DEL_PAPELITO_EN_PARTE_DE_LA_PANTALLA,
    rapidezDeCaida: (caidaEnMetros + altoVisible * ESCALONADO_EN_PANTALLAS) / DURACION_EN_SEGUNDOS,
    mecido: haciaLaDerecha.clone().multiplyScalar(altoVisible * MECIDO_EN_PANTALLAS),
    faseDelMecido: alAzarEntre(0, Math.PI * 2),
    ejeDeGiro,
    rapidezDeGiro: alAzarEntre(GIRO_MINIMO_EN_RADIANES_POR_SEGUNDO, GIRO_MAXIMO_EN_RADIANES_POR_SEGUNDO),
  };
}

/** Completos casi toda su vida; en la última parte se transparentan hasta desaparecer. */
function opacidadA(parteDeLaVida: number): number {
  if (parteDeLaVida <= PARTE_DE_LA_VIDA_EN_QUE_EMPIEZAN_A_DESAPARECER) return 1;
  const parteQueQueda = 1 - PARTE_DE_LA_VIDA_EN_QUE_EMPIEZAN_A_DESAPARECER;
  const parteDesvanecida = (parteDeLaVida - PARTE_DE_LA_VIDA_EN_QUE_EMPIEZAN_A_DESAPARECER) / parteQueQueda;
  return Math.max(0, 1 - parteDesvanecida);
}

function alAzarEntre(minimo: number, maximo: number): number {
  return minimo + Math.random() * (maximo - minimo);
}

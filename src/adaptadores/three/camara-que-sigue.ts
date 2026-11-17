// La cámara del escenario: en perspectiva, mirando a un punto del piso desde atrás y desde arriba.
// Cuando el punto cambia, la cámara lo alcanza con suavidad en vez de saltar.

import { PerspectiveCamera, Vector3 } from 'three';
import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import type { Punto } from '../../dominio/geometria.ts';

/** Ángulo de visión vertical. Uno cerrado aplana la escena y refuerza el aire de teatrino de papel. */
const ANGULO_DE_VISION_EN_GRADOS = 35;
const DISTANCIA_MINIMA_VISIBLE_EN_METROS = 0.1;
const DISTANCIA_MAXIMA_VISIBLE_EN_METROS = 200;

/** A qué altura sobre el piso mira la cámara: más o menos el pecho de un personaje. */
const ALTURA_DE_LA_MIRADA_EN_METROS = 0.9;

/** Qué tan pronto la cámara alcanza a lo que sigue. Más grande = más pegada; más chico = más perezosa. */
const RAPIDEZ_DE_SEGUIMIENTO = 5;

const GRADOS_POR_MEDIA_VUELTA = 180;

export class CamaraQueSigue {
  readonly camara = new PerspectiveCamera(
    ANGULO_DE_VISION_EN_GRADOS,
    1,
    DISTANCIA_MINIMA_VISIBLE_EN_METROS,
    DISTANCIA_MAXIMA_VISIBLE_EN_METROS,
  );

  /** El punto del piso que la cámara quiere mirar. */
  private readonly puntoDeseado = new Vector3();
  /** El punto del piso que la cámara mira en este cuadro; persigue al deseado. */
  private readonly puntoActual = new Vector3();
  private ajustes: AjustesDeCamara = { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 };

  enfocar(punto: Punto, ajustes: AjustesDeCamara, deInmediato: boolean): void {
    this.ajustes = ajustes;
    this.puntoDeseado.set(punto.x, 0, punto.y);
    if (deInmediato) {
      this.puntoActual.copy(this.puntoDeseado);
      this.colocar();
    }
  }

  /** Acerca la cámara a lo que sigue. `segundos` es el tiempo desde el cuadro anterior. */
  actualizar(segundos: number): void {
    // Esta fórmula recorre en cada cuadro una parte de lo que falta, y da el mismo movimiento
    // sin importar cuántos cuadros por segundo dibuje el dispositivo.
    const parteDelCaminoQueSeRecorre = 1 - Math.exp(-RAPIDEZ_DE_SEGUIMIENTO * segundos);
    this.puntoActual.lerp(this.puntoDeseado, parteDelCaminoQueSeRecorre);
    this.colocar();
  }

  /** Avisa a la cámara de la forma del lienzo: ancho dividido entre alto. */
  cambiarProporcion(anchoEntreAlto: number): void {
    this.camara.aspect = anchoEntreAlto;
    this.camara.updateProjectionMatrix();
  }

  /** Pone la cámara detrás y arriba del punto actual, girada alrededor de él, y la hace mirarlo. */
  private colocar(): void {
    const giroEnRadianes = (this.ajustes.giroEnGrados * Math.PI) / GRADOS_POR_MEDIA_VUELTA;
    const haciaUnLado = Math.sin(giroEnRadianes) * this.ajustes.distanciaEnMetros;
    const haciaAtras = Math.cos(giroEnRadianes) * this.ajustes.distanciaEnMetros;

    this.camara.position.set(
      this.puntoActual.x + haciaUnLado,
      this.ajustes.alturaEnMetros,
      this.puntoActual.z + haciaAtras,
    );
    this.camara.lookAt(this.puntoActual.x, ALTURA_DE_LA_MIRADA_EN_METROS, this.puntoActual.z);
  }
}

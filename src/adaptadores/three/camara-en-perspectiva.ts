// La cámara del escenario: en perspectiva, mirando a un punto del piso desde atrás y desde arriba.
// Dónde mira en cada cuadro lo decide la aplicación (aplicacion/camara-de-escena.ts); aquí solo se coloca.

import { PerspectiveCamera } from 'three';
import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import type { Punto } from '../../dominio/geometria.ts';

/** Ángulo de visión vertical. Uno cerrado aplana la escena y refuerza el aire de teatrino de papel. */
const ANGULO_DE_VISION_EN_GRADOS = 35;
const DISTANCIA_MINIMA_VISIBLE_EN_METROS = 0.1;
const DISTANCIA_MAXIMA_VISIBLE_EN_METROS = 200;

/** A qué altura sobre el piso mira la cámara: más o menos el pecho de un personaje. */
const ALTURA_DE_LA_MIRADA_EN_METROS = 0.9;

const GRADOS_POR_MEDIA_VUELTA = 180;

export class CamaraEnPerspectiva {
  readonly camara = new PerspectiveCamera(
    ANGULO_DE_VISION_EN_GRADOS,
    1,
    DISTANCIA_MINIMA_VISIBLE_EN_METROS,
    DISTANCIA_MAXIMA_VISIBLE_EN_METROS,
  );

  /** Pone la cámara detrás y arriba de un punto del piso, girada alrededor de él, y la hace mirarlo. */
  colocar(punto: Punto, ajustes: AjustesDeCamara): void {
    const giroEnRadianes = (ajustes.giroEnGrados * Math.PI) / GRADOS_POR_MEDIA_VUELTA;
    const haciaUnLado = Math.sin(giroEnRadianes) * ajustes.distanciaEnMetros;
    const haciaAtras = Math.cos(giroEnRadianes) * ajustes.distanciaEnMetros;

    // En el plano del lugar, la profundidad `y` es la `z` del espacio 3D.
    this.camara.position.set(punto.x + haciaUnLado, ajustes.alturaEnMetros, punto.y + haciaAtras);
    this.camara.lookAt(punto.x, ALTURA_DE_LA_MIRADA_EN_METROS, punto.y);
  }

  /** Avisa a la cámara de la forma del lienzo: ancho dividido entre alto. */
  cambiarProporcion(anchoEntreAlto: number): void {
    this.camara.aspect = anchoEntreAlto;
    this.camara.updateProjectionMatrix();
  }
}

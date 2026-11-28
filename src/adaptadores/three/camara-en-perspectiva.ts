// La cámara del escenario: en perspectiva, mirando a un punto del piso desde atrás y desde arriba.
// Dónde mira en cada cuadro lo decide la aplicación (aplicacion/camara-de-escena.ts); aquí solo se coloca.
//
// Los planos se componen en una pantalla 16:9. En una más angosta (una tableta 4:3) la cámara abre su ángulo
// vertical para seguir viendo lo mismo de ancho: así nadie queda cortado por la orilla; a cambio se ve un poco
// más de cielo y de piso. En una más ancha, el ángulo vertical se queda igual y se ve más a los lados.

import { PerspectiveCamera } from 'three';
import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import type { Punto } from '../../dominio/geometria.ts';

/**
 * Ángulo de visión vertical en la pantalla de referencia (16:9).
 * Uno cerrado aplana la escena y refuerza el aire de teatrino de papel.
 */
const ANGULO_DE_VISION_EN_GRADOS = 35;

/** La forma de pantalla para la que se componen los planos: ancho dividido entre alto. */
const PROPORCION_DE_REFERENCIA_ANCHO_ENTRE_ALTO = 16 / 9;

/**
 * Tope del ángulo vertical al abrirlo. Una 4:3 pide unos 46°; un teléfono de pie pediría casi 90°, y con eso
 * todo se vería diminuto y deformado en las orillas. Más angosto que eso, la cámara deja de compensar.
 */
const ANGULO_DE_VISION_MAXIMO_EN_GRADOS = 60;
const DISTANCIA_MINIMA_VISIBLE_EN_METROS = 0.1;
const DISTANCIA_MAXIMA_VISIBLE_EN_METROS = 200;

/** A qué altura sobre el piso mira la cámara: más o menos el pecho de un personaje. */
const ALTURA_DE_LA_MIRADA_EN_METROS = 0.9;

const GRADOS_POR_MEDIA_VUELTA = 180;

/**
 * El ángulo de visión vertical, en grados, para un lienzo de esa forma (ancho dividido entre alto).
 * Si el lienzo es más angosto que 16:9, abre el ángulo para que el ancho visible sea el de 16:9.
 */
export function calcularAnguloDeVisionVertical(anchoEntreAlto: number): number {
  const esMasAngostoQueLaReferencia = anchoEntreAlto < PROPORCION_DE_REFERENCIA_ANCHO_ENTRE_ALTO;
  if (!esMasAngostoQueLaReferencia || anchoEntreAlto <= 0) {
    return ANGULO_DE_VISION_EN_GRADOS;
  }
  // Lo que se ve de ancho a una distancia es proporcional a tan(ángulo horizontal / 2) = tan(vertical / 2) · proporción.
  // Para conservar el ancho de 16:9 con una proporción menor, la tangente de la mitad del vertical crece en esa razón.
  const mitadDeReferenciaEnRadianes = convertirEnRadianes(ANGULO_DE_VISION_EN_GRADOS) / 2;
  const razonDeProporciones = PROPORCION_DE_REFERENCIA_ANCHO_ENTRE_ALTO / anchoEntreAlto;
  const mitadNuevaEnRadianes = Math.atan(Math.tan(mitadDeReferenciaEnRadianes) * razonDeProporciones);
  const anguloNuevoEnGrados = convertirEnGrados(mitadNuevaEnRadianes * 2);
  return Math.min(anguloNuevoEnGrados, ANGULO_DE_VISION_MAXIMO_EN_GRADOS);
}

function convertirEnRadianes(grados: number): number {
  return (grados * Math.PI) / GRADOS_POR_MEDIA_VUELTA;
}

function convertirEnGrados(radianes: number): number {
  return (radianes * GRADOS_POR_MEDIA_VUELTA) / Math.PI;
}

export class CamaraEnPerspectiva {
  readonly camara = new PerspectiveCamera(
    ANGULO_DE_VISION_EN_GRADOS,
    1,
    DISTANCIA_MINIMA_VISIBLE_EN_METROS,
    DISTANCIA_MAXIMA_VISIBLE_EN_METROS,
  );

  /** Pone la cámara detrás y arriba de un punto del piso, girada alrededor de él, y la hace mirarlo. */
  colocar(punto: Punto, ajustes: AjustesDeCamara): void {
    const giroEnRadianes = convertirEnRadianes(ajustes.giroEnGrados);
    const haciaUnLado = Math.sin(giroEnRadianes) * ajustes.distanciaEnMetros;
    const haciaAtras = Math.cos(giroEnRadianes) * ajustes.distanciaEnMetros;

    // En el plano del lugar, la profundidad `y` es la `z` del espacio 3D.
    this.camara.position.set(punto.x + haciaUnLado, ajustes.alturaEnMetros, punto.y + haciaAtras);
    this.camara.lookAt(punto.x, ALTURA_DE_LA_MIRADA_EN_METROS, punto.y);
  }

  /** Avisa a la cámara de la forma del lienzo: ancho dividido entre alto. En uno angosto, abre su ángulo. */
  cambiarProporcion(anchoEntreAlto: number): void {
    this.camara.aspect = anchoEntreAlto;
    this.camara.fov = calcularAnguloDeVisionVertical(anchoEntreAlto);
    this.camara.updateProjectionMatrix();
  }
}

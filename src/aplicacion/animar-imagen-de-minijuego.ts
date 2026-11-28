// Anima una imagen de un minijuego (`assets.animar`, docs/DISENO-3.0.md §6): le va cambiando la dirección
// (`src`) para que muestre, uno tras otro, los cuadros de una animación del manifiesto.
//
// Hace con un `<img>` lo mismo que el escenario hace con las hojas de papel
// (adaptadores/three/animaciones-de-hojas.ts): el cuadro que toca sale del tiempo que lleva y de los cuadros
// por segundo, y al llegar al último vuelve a empezar.
// El tiempo es el del puerto `Reloj`, así que la animación se pausa con el juego y se prueba sin esperar de verdad.
//
// No toca el DOM: solo escribe `imagen.src`, que un `<img>` entiende y un objeto de prueba también.

import type { AnimacionDeImagen, CuadrosDeAsset, ImagenAnimable } from '../puertos/minijuego.ts';
import type { Reloj } from '../puertos/reloj.ts';

/** Lo que necesita una imagen animada. */
export interface PedidoDeAnimacionDeImagen {
  readonly imagen: ImagenAnimable;
  /** Los cuadros con los que empieza. Sin direcciones, la imagen no cambia hasta que se llame a `cambiar`. */
  readonly cuadros: CuadrosDeAsset;
  readonly reloj: Reloj;
  /** Los cuadros de otra clave, para `cambiar`. Sin direcciones si la clave no es una imagen del nivel. */
  readonly buscarCuadros: (clave: string) => CuadrosDeAsset;
  /** Cualquiera de ellas que se dispare detiene la animación: el cierre del minijuego, la del minijuego… */
  readonly senales: readonly AbortSignal[];
}

/** Empieza a animar la imagen desde el primer cuadro y devuelve con qué cambiarla o detenerla. */
export function animarImagenDeMinijuego(pedido: PedidoDeAnimacionDeImagen): AnimacionDeImagen {
  const animacion = new ImagenEnMovimiento(pedido);
  // Una señal que ya se disparó no vuelve a avisar: la imagen se pone en su primer cuadro y no se anima.
  const yaHabiaQueDetenerse = pedido.senales.some((senal) => senal.aborted);
  if (yaHabiaQueDetenerse) {
    animacion.detener();
  }
  return animacion;
}

class ImagenEnMovimiento implements AnimacionDeImagen {
  private readonly imagen: ImagenAnimable;
  private readonly buscarCuadros: (clave: string) => CuadrosDeAsset;
  private readonly senales: readonly AbortSignal[];
  private cuadros: CuadrosDeAsset;
  private segundosTranscurridos = 0;
  /** La última dirección que se le puso a la imagen: así no se reescribe `src` en cada cuadro del juego. */
  private direccionPuesta: string | undefined;
  private estaDetenida = false;
  private readonly dejarDeContar: () => void;

  constructor(pedido: PedidoDeAnimacionDeImagen) {
    this.imagen = pedido.imagen;
    this.buscarCuadros = pedido.buscarCuadros;
    this.senales = pedido.senales;
    this.cuadros = pedido.cuadros;
    this.ponerCuadroQueToca();

    this.dejarDeContar = pedido.reloj.enCadaCuadro((segundos) => this.avanzar(segundos));
    for (const senal of this.senales) {
      senal.addEventListener('abort', this.detener, { once: true });
    }
  }

  cambiar(clave: string): void {
    if (this.estaDetenida) return;
    const cuadros = this.buscarCuadros(clave);
    // Quien busca ya avisó que la clave no existe; la imagen sigue con lo que tenía.
    if (cuadros.urls.length === 0) return;

    this.cuadros = cuadros;
    this.segundosTranscurridos = 0;
    this.ponerCuadroQueToca();
  }

  // Es una función flecha para poder darla tal cual a `addEventListener` y quitarla después.
  readonly detener = (): void => {
    if (this.estaDetenida) return;
    this.estaDetenida = true;
    this.dejarDeContar();
    for (const senal of this.senales) {
      senal.removeEventListener('abort', this.detener);
    }
  };

  private avanzar(segundos: number): void {
    this.segundosTranscurridos += segundos;
    this.ponerCuadroQueToca();
  }

  private ponerCuadroQueToca(): void {
    const direccion = cuadroQueToca(this.cuadros, this.segundosTranscurridos);
    if (direccion === undefined || direccion === this.direccionPuesta) return;
    this.direccionPuesta = direccion;
    this.imagen.src = direccion;
  }
}

/**
 * La dirección del cuadro que toca después de tantos segundos, repitiendo la animación sin fin.
 * Una imagen fija (o una animación sin velocidad) se queda en su primer cuadro.
 * `undefined` si no hay cuadros.
 */
export function cuadroQueToca(cuadros: CuadrosDeAsset, segundosTranscurridos: number): string | undefined {
  const cantidad = cuadros.urls.length;
  if (cantidad === 0) return undefined;
  if (cantidad === 1 || cuadros.cuadrosPorSegundo <= 0) return cuadros.urls[0];

  const cuadrosPasados = Math.floor(segundosTranscurridos * cuadros.cuadrosPorSegundo);
  return cuadros.urls[cuadrosPasados % cantidad];
}

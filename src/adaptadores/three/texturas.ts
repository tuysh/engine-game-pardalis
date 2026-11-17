// Convierte una imagen (SVG, PNG o WebP) en una textura de Three.js.
//
// La imagen se dibuja primero en un lienzo, al tamaño en píxeles que conviene, y ese lienzo es la textura.
// Así un SVG, que es un dibujo sin píxeles propios, queda nítido en tablet y en proyector
// (docs/DISENO-3.0.md §8.2).
//
// Estado: de una animación solo se usa el primer cuadro; reproducir sus cuadros llega con las cinemáticas.

import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Texture } from 'three';
import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import type { ImagenDeEscena } from '../../puertos/escenario.ts';

/** Crea un lienzo suelto del tamaño pedido. Lo entrega `crear.ts`, porque crear elementos es cosa del DOM. */
export type CreadorDeLienzos = (anchoEnPixeles: number, altoEnPixeles: number) => HTMLCanvasElement;

/** Lo que hace falta para convertir imágenes en texturas. */
export interface FabricaDeTexturas {
  readonly crearLienzo: CreadorDeLienzos;
  /** Píxeles reales de la pantalla por cada punto de CSS: 1 en pantallas comunes, 2 o más en las finas. */
  readonly densidadDePantalla: number;
}

/** Las texturas se dibujan con más píxeles que el dibujo original, para que no se vean borrosas de cerca. */
const DETALLE_EXTRA = 2;

/** Ninguna textura mide más que esto por lado: es lo que aguantan sin problema las tablets. */
const LADO_MAXIMO_DE_TEXTURA_EN_PIXELES = 4096;

export async function cargarTextura(imagen: ImagenDeEscena, fabrica: FabricaDeTexturas): Promise<Texture> {
  const direccion = imagen.direcciones[0];
  if (direccion === undefined) {
    throw new ErrorDeEscenario(['una imagen del escenario no tiene ningún archivo']);
  }
  const imagenDescargada = await descargarImagen(direccion);

  const escala = calcularEscala(imagen, fabrica.densidadDePantalla);
  const anchoEnPixeles = Math.max(1, Math.round(imagen.anchoEnPixeles * escala));
  const altoEnPixeles = Math.max(1, Math.round(imagen.altoEnPixeles * escala));

  const lienzo = fabrica.crearLienzo(anchoEnPixeles, altoEnPixeles);
  const pincel = lienzo.getContext('2d');
  if (pincel === null) {
    throw new ErrorDeEscenario([`el navegador no pudo preparar un lienzo para dibujar ${direccion}`]);
  }
  pincel.drawImage(imagenDescargada, 0, 0, anchoEnPixeles, altoEnPixeles);

  const textura = new CanvasTexture(lienzo);
  // Los colores de las imágenes vienen en sRGB; sin decirlo, Three.js los mostraría lavados.
  textura.colorSpace = SRGBColorSpace;
  return textura;
}

/** Por cuánto se multiplica el tamaño del dibujo original para obtener el de la textura. */
function calcularEscala(imagen: ImagenDeEscena, densidadDePantalla: number): number {
  const escalaDeseada = DETALLE_EXTRA * densidadDePantalla;
  const ladoMayorEnPixeles = Math.max(imagen.anchoEnPixeles, imagen.altoEnPixeles);
  const escalaMaxima = LADO_MAXIMO_DE_TEXTURA_EN_PIXELES / ladoMayorEnPixeles;
  return Math.min(escalaDeseada, escalaMaxima);
}

function descargarImagen(direccion: string): Promise<HTMLImageElement> {
  return new Promise((terminar, rechazar) => {
    const imagen = new Image();
    // Hace falta para usar como textura una imagen de otro origen (el CDN), que debe enviar cabeceras CORS.
    imagen.crossOrigin = 'anonymous';
    imagen.onload = (): void => {
      terminar(imagen);
    };
    imagen.onerror = (): void => {
      rechazar(new ErrorDeEscenario([`no se pudo cargar la imagen ${direccion}`]));
    };
    imagen.src = direccion;
  });
}

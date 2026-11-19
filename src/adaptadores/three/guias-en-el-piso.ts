// Dibuja las guías del modo depuración sobre el piso: el contorno de cada área, una cruz en cada lugar
// con nombre y su etiqueta. Este archivo solo se carga cuando el juego se crea con `depurar: true`.

import {
  BufferGeometry,
  CanvasTexture,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { Punto } from '../../dominio/geometria.ts';
import type { GuiaDeDepuracion } from '../../dominio/guias-de-depuracion.ts';
import type { CreadorDeLienzos } from './texturas.ts';

/** Las guías se dibujan un poco arriba del piso y por encima de todo, para que nada las tape. */
const ALTURA_DE_LAS_GUIAS_EN_METROS = 0.03;
const ORDEN_DE_LAS_GUIAS = 10;

const MEDIO_LARGO_DE_UNA_MARCA_EN_METROS = 0.15;
const ALTURA_DE_UNA_ETIQUETA_SOBRE_EL_PISO_EN_METROS = 0.35;
const ALTO_DE_UNA_ETIQUETA_EN_METROS = 0.26;

/** Medidas, en píxeles, del lienzo donde se escribe cada etiqueta. */
const ALTO_DEL_TEXTO_EN_PIXELES = 40;
const MARGEN_DEL_TEXTO_EN_PIXELES = 10;
const LETRA_DE_LAS_ETIQUETAS = `bold ${ALTO_DEL_TEXTO_EN_PIXELES}px system-ui, sans-serif`;

/** Un grupo con todas las guías, listo para agregarse a la escena. */
export function crearGrupoDeGuias(guias: readonly GuiaDeDepuracion[], crearLienzo: CreadorDeLienzos): Group {
  const grupo = new Group();
  for (const guia of guias) {
    switch (guia.tipo) {
      case 'contorno':
        grupo.add(crearContorno(guia.vertices, guia.color));
        if (guia.etiqueta !== undefined) {
          grupo.add(crearEtiqueta(guia.etiqueta, guia.color, centroDe(guia.vertices), crearLienzo));
        }
        break;
      case 'marca':
        grupo.add(crearRaya(guia.punto, { x: MEDIO_LARGO_DE_UNA_MARCA_EN_METROS, y: 0 }, guia.color));
        grupo.add(crearRaya(guia.punto, { x: 0, y: MEDIO_LARGO_DE_UNA_MARCA_EN_METROS }, guia.color));
        grupo.add(crearEtiqueta(guia.etiqueta, guia.color, guia.punto, crearLienzo));
        break;
    }
  }
  return grupo;
}

/** Libera la memoria de video de un grupo de guías: formas, materiales y las texturas de sus etiquetas. */
export function liberarGrupoDeGuias(grupo: Group): void {
  for (const pieza of grupo.children) {
    if (pieza instanceof Line) {
      pieza.geometry.dispose();
      if (pieza.material instanceof LineBasicMaterial) {
        pieza.material.dispose();
      }
    }
    if (pieza instanceof Sprite) {
      if (pieza.material.map !== null) {
        pieza.material.map.dispose();
      }
      pieza.material.dispose();
    }
  }
  grupo.clear();
}

/** Una línea cerrada que pasa por todos los vértices de un área. */
function crearContorno(vertices: readonly Punto[], color: string): LineLoop {
  const puntos = vertices.map((vertice) => new Vector3(vertice.x, ALTURA_DE_LAS_GUIAS_EN_METROS, vertice.y));
  const contorno = new LineLoop(new BufferGeometry().setFromPoints(puntos), crearMaterialDeLinea(color));
  contorno.renderOrder = ORDEN_DE_LAS_GUIAS;
  return contorno;
}

/** Una raya corta centrada en un punto; dos rayas cruzadas hacen la cruz de una marca. */
function crearRaya(centro: Punto, mitad: Punto, color: string): Line {
  const puntos = [
    new Vector3(centro.x - mitad.x, ALTURA_DE_LAS_GUIAS_EN_METROS, centro.y - mitad.y),
    new Vector3(centro.x + mitad.x, ALTURA_DE_LAS_GUIAS_EN_METROS, centro.y + mitad.y),
  ];
  const raya = new Line(new BufferGeometry().setFromPoints(puntos), crearMaterialDeLinea(color));
  raya.renderOrder = ORDEN_DE_LAS_GUIAS;
  return raya;
}

function crearMaterialDeLinea(color: string): LineBasicMaterial {
  // Sin prueba de profundidad: la guía se ve aunque haya algo delante.
  return new LineBasicMaterial({ color, depthTest: false });
}

/** Un letrero que siempre mira a la cámara, con el texto en blanco sobre el color de su guía. */
function crearEtiqueta(texto: string, color: string, lugar: Punto, crearLienzo: CreadorDeLienzos): Sprite {
  const altoEnPixeles = ALTO_DEL_TEXTO_EN_PIXELES + MARGEN_DEL_TEXTO_EN_PIXELES * 2;
  // El ancho del lienzo depende del largo del texto, así que primero se mide con un lienzo de prueba.
  const pincelDePrueba = crearLienzo(1, 1).getContext('2d');
  let anchoDelTextoEnPixeles = texto.length * ALTO_DEL_TEXTO_EN_PIXELES;
  if (pincelDePrueba !== null) {
    pincelDePrueba.font = LETRA_DE_LAS_ETIQUETAS;
    anchoDelTextoEnPixeles = pincelDePrueba.measureText(texto).width;
  }
  const anchoEnPixeles = Math.ceil(anchoDelTextoEnPixeles) + MARGEN_DEL_TEXTO_EN_PIXELES * 2;

  const lienzo = crearLienzo(anchoEnPixeles, altoEnPixeles);
  const pincel = lienzo.getContext('2d');
  if (pincel !== null) {
    pincel.fillStyle = color;
    pincel.fillRect(0, 0, anchoEnPixeles, altoEnPixeles);
    pincel.font = LETRA_DE_LAS_ETIQUETAS;
    pincel.textBaseline = 'middle';
    pincel.fillStyle = '#ffffff';
    pincel.fillText(texto, MARGEN_DEL_TEXTO_EN_PIXELES, altoEnPixeles / 2);
  }

  const material = new SpriteMaterial({ map: new CanvasTexture(lienzo), depthTest: false });
  const etiqueta = new Sprite(material);
  const anchoEnMetros = (ALTO_DE_UNA_ETIQUETA_EN_METROS * anchoEnPixeles) / altoEnPixeles;
  etiqueta.scale.set(anchoEnMetros, ALTO_DE_UNA_ETIQUETA_EN_METROS, 1);
  etiqueta.position.set(lugar.x, ALTURA_DE_UNA_ETIQUETA_SOBRE_EL_PISO_EN_METROS, lugar.y);
  etiqueta.renderOrder = ORDEN_DE_LAS_GUIAS;
  return etiqueta;
}

/** El centro de un área: el promedio de sus vértices. Ahí va su etiqueta. */
function centroDe(vertices: readonly Punto[]): Punto {
  let sumaDeX = 0;
  let sumaDeY = 0;
  for (const vertice of vertices) {
    sumaDeX += vertice.x;
    sumaDeY += vertice.y;
  }
  const cantidad = Math.max(1, vertices.length);
  return { x: sumaDeX / cantidad, y: sumaDeY / cantidad };
}

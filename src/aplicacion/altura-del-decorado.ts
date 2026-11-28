// Hasta dónde llega, sobre el piso, el dibujo de un objeto del decorado. Sirve para poner encima de él
// las señales de la interfaz (el aviso de «a la mano», la estrellita de lo pendiente).

import type { Decorado } from '../dominio/mundo.ts';
import type { Nivel } from '../dominio/nivel.ts';

/** A qué altura va una señal sobre un objeto pintado en el piso, que no tiene altura propia. */
const ALTURA_SOBRE_LO_PINTADO_EN_EL_PISO_EN_METROS = 0.5;

/** En metros sobre el piso: el borde de arriba del dibujo (o un poco arriba del piso, si está pintado en él). */
export function calcularAlturaDelDecorado(objeto: Decorado, nivel: Nivel): number {
  if (objeto.clase === 'plano') return ALTURA_SOBRE_LO_PINTADO_EN_EL_PISO_EN_METROS;

  const asset = nivel.assets[objeto.asset]!.asset; // la validación garantiza que la imagen existe
  let altoDelDibujoEnMetros = 0;
  if (asset.tipo === 'imagen' || asset.tipo === 'animacion') {
    altoDelDibujoEnMetros = asset.altoEnPixeles / nivel.contenido.mundo.pixelesPorMetro;
  }
  if (objeto.clase === 'colgado') return objeto.alturaEnMetros + altoDelDibujoEnMetros;
  return altoDelDibujoEnMetros;
}

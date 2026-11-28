// Las señales de lo pendiente: una estrellita que brinca encima de cada NPC u objeto interactivo cuyo contenido
// lleva `senal`, mientras su `visibleCuando` se cumple. Así quien todavía no lee sabe a dónde ir
// («aquí se compran las verduras») sin que nadie se lo diga.
//
// Solo se ven mientras el jugador explora: en un diálogo o una cinemática se quitan, para no distraer.
// Tampoco se ven sobre lo que el jugador ya tiene a la mano: ahí ya está el aviso de «puedes hablar».

import { cumpleCondicion } from '../dominio/condicion.ts';
import type { Interlocutor } from '../dominio/contenido.ts';
import { estaVisibleElDecorado } from '../dominio/decorado-visible.ts';
import { centroDeRectangulo } from '../dominio/forma.ts';
import type { Interactuable } from '../dominio/interactuable-cercano.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Escenario, LugarEnPantalla } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import { calcularAlturaDelDecorado } from './altura-del-decorado.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';
import type { Reparto } from './reparto.ts';

/**
 * Cuánto más arriba de la cabeza va la estrellita. Poco: si flota muy alto parece señalar lo que está detrás
 * (el letrero de un puesto) y no a quien vende. No choca con el aviso de «a la mano», que nunca está a la vez.
 */
const SEPARACION_SOBRE_LA_CABEZA_EN_METROS = 0.1;

/** Lo que necesitan las señales de lo pendiente: el nivel, su estado, quién está dónde y dónde dibujarlas. */
export interface PiezasDeLasSenales {
  readonly nivel: Nivel;
  readonly estado: EstadoEnJuego;
  readonly reparto: Reparto;
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
}

/** Lo que el jugador tiene a la mano en este cuadro, si algo. */
export type LoQueEstaALaMano = Pick<Interactuable, 'tipo' | 'id'> | undefined;

/** Decide en cada cuadro sobre quién va una estrellita de lo pendiente y se lo pasa a la interfaz. */
export class SenalesDePendientes {
  private readonly piezas: PiezasDeLasSenales;
  /** `true` si en el último cuadro había alguna señal: así se quitan una sola vez. */
  private hayAlgunaEnPantalla = false;

  constructor(piezas: PiezasDeLasSenales) {
    this.piezas = piezas;
  }

  /**
   * Se llama en cada cuadro, después de dibujar (cuando la cámara ya está en su lugar).
   * Con `sePuedenVer` en `false` (hay una escena en curso), las señales se quitan.
   */
  actualizar(sePuedenVer: boolean, aLaMano: LoQueEstaALaMano): void {
    if (!sePuedenVer) {
      this.ocultar();
      return;
    }
    const lugares = this.reunirLugares(aLaMano);
    if (lugares.length === 0 && !this.hayAlgunaEnPantalla) return;
    this.piezas.interfaz.ponerSenalesDePendientes(lugares);
    this.hayAlgunaEnPantalla = lugares.length > 0;
  }

  ocultar(): void {
    if (!this.hayAlgunaEnPantalla) return;
    this.piezas.interfaz.ponerSenalesDePendientes([]);
    this.hayAlgunaEnPantalla = false;
  }

  private reunirLugares(aLaMano: LoQueEstaALaMano): LugarEnPantalla[] {
    const { contenido, mundo } = this.piezas.nivel;
    const lugares: LugarEnPantalla[] = [];

    for (const id of Object.keys(contenido.npcs)) {
      const npc = contenido.npcs[id]!; // `id` viene de `Object.keys`, así que existe
      if (!this.debeVerse(npc) || estaALaMano(aLaMano, 'personaje', id)) continue;
      const lugar = this.buscarLugarSobreLaCabezaDe(id);
      if (lugar !== undefined) {
        lugares.push(lugar);
      }
    }

    for (const objeto of mundo.decorado) {
      if (objeto.id === undefined || !Object.hasOwn(contenido.interactivos, objeto.id)) continue;
      const interactivo = contenido.interactivos[objeto.id]!; // se comprobó con `hasOwn`
      if (!this.debeVerse(interactivo) || estaALaMano(aLaMano, 'decorado', objeto.id)) continue;
      if (!estaVisibleElDecorado(objeto, this.piezas.estado.actual)) continue;

      const altura = calcularAlturaDelDecorado(objeto, this.piezas.nivel) + SEPARACION_SOBRE_LA_CABEZA_EN_METROS;
      lugares.push(this.piezas.escenario.lugarEnPantallaDelPunto(centroDeRectangulo(objeto.huella), altura));
    }
    return lugares;
  }

  /** `undefined` si el personaje todavía no entra al escenario (o ya salió). */
  private buscarLugarSobreLaCabezaDe(id: string): LugarEnPantalla | undefined {
    const posicion = this.piezas.reparto.posicionDe(id);
    const dibujo = this.piezas.reparto.dibujoDe(id);
    if (posicion === undefined || dibujo === undefined) return undefined;
    const altura = dibujo.imagen.altoEnMetros + SEPARACION_SOBRE_LA_CABEZA_EN_METROS;
    return this.piezas.escenario.lugarEnPantallaDelPunto(posicion, altura);
  }

  private debeVerse(interlocutor: Interlocutor): boolean {
    if (interlocutor.senal === undefined) return false;
    if (interlocutor.senal.visibleCuando === undefined) return true;
    return cumpleCondicion(interlocutor.senal.visibleCuando, this.piezas.estado.actual);
  }
}

function estaALaMano(aLaMano: LoQueEstaALaMano, tipo: Interactuable['tipo'], id: string): boolean {
  return aLaMano !== undefined && aLaMano.tipo === tipo && aLaMano.id === id;
}

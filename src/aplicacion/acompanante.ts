// El acompañante: un personaje que sigue al jugador a corta distancia mientras explora
// (el primo que va con él al mercado). Lo declara el nivel en `jugador.acompanante`, y un paso `acompana`
// puede cambiarlo o quitarlo a media aventura.
//
// - Camina por el piso rodeando lo que estorba, igual que el jugador, y voltea hacia donde camina.
// - Se detiene a su distancia del jugador, a un lado y un poco atrás (más lejos de la cámara): así no lo tapa.
//   Va del lado contrario al que camina el jugador, para no adelantársele.
// - Durante un diálogo o una cinemática no sigue a nadie: ahí lo mueven los pasos `camina`, `mira` y `anima`.
//   Al terminar la escena vuelve a seguir desde donde quedó.

import { buscarCamino } from '../dominio/buscar-camino.ts';
import { acercarse } from '../dominio/caminar.ts';
import { distanciaEntre } from '../dominio/geometria.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { MapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { debeEmpezarASeguir, lugarParaSeguir } from '../dominio/seguir.ts';
import type { Lado } from '../dominio/seguir.ts';
import type { Reparto } from './reparto.ts';

/** Si su lugar se movió más que esto desde donde terminaba la ruta, la ruta ya no sirve y se busca otra. */
const DISTANCIA_PARA_BUSCAR_OTRA_RUTA_EN_METROS = 0.5;

/** A esta distancia de su lugar, quien acompaña ya llegó y se detiene. */
const TOLERANCIA_DE_LLEGADA_EN_METROS = 0.05;

/** Lo menos que debe moverse el jugador en un cuadro para contar que camina, y hacia dónde. */
const MOVIMIENTO_QUE_CUENTA_EN_METROS = 0.001;

export interface PiezasDelAcompanante {
  readonly reparto: Reparto;
  /** El terreno del nivel y su rejilla, para buscar por dónde caminar. */
  readonly caminos: MapaDeCaminos;
  readonly idDelJugador: string;
  /** Camina a la velocidad del jugador: así lo alcanza sin correr y sin quedarse atrás. */
  readonly velocidadEnMetrosPorSegundo: number;
  /** A qué distancia del jugador se queda (`jugador.distanciaDelAcompanante`, o la de por defecto). */
  readonly distanciaEnMetros: number;
  /** Quién acompaña al jugador al empezar el nivel. `undefined` = nadie. */
  readonly idDelAcompananteInicial: string | undefined;
}

export class Acompanante {
  private readonly piezas: PiezasDelAcompanante;
  /** Quién acompaña al jugador ahora. `undefined` = nadie. */
  private idDelAcompanante: string | undefined;
  /** `true` mientras camina hacia su lugar junto al jugador. */
  private estaCaminando = false;
  /** Los puntos por los que le falta pasar para llegar a su lugar. */
  private ruta: readonly Punto[] = [];
  /** Dónde estaba su lugar cuando se buscó la ruta. */
  private finDeLaRuta: Punto | undefined;
  /** `false` si su lugar no se puede alcanzar y la ruta solo lleva a lo más cercano: al acabarla, se detiene. */
  private laRutaLlegaAlLugar = true;
  /**
   * De qué lado del jugador va: del contrario al que camina el jugador, para ir detrás de él y no adelantarse.
   * `undefined` = todavía no se sabe; se decide por dónde está al empezar.
   */
  private lado: Lado | undefined;
  /** Dónde estaba el jugador en el cuadro anterior, para saber hacia qué lado camina. */
  private posicionAnteriorDelJugador: Punto | undefined;

  constructor(piezas: PiezasDelAcompanante) {
    this.piezas = piezas;
    this.idDelAcompanante = piezas.idDelAcompananteInicial;
  }

  /** Quién acompaña al jugador ahora. `undefined` = nadie. */
  get id(): string | undefined {
    return this.idDelAcompanante;
  }

  /** Cambia quién acompaña al jugador. Con `undefined`, ya nadie lo acompaña. */
  cambiar(idDelAcompanante: string | undefined): void {
    this.idDelAcompanante = idDelAcompanante;
    this.lado = undefined;
    this.detener();
  }

  /** Lo deja quieto donde está. Se llama al empezar un diálogo o una cinemática. */
  detener(): void {
    this.estaCaminando = false;
    this.ruta = [];
    this.finDeLaRuta = undefined;
  }

  /** Avanza lo que corresponde a un cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  avanzar(segundos: number): void {
    const id = this.idDelAcompanante;
    if (id === undefined) return;

    const { reparto, idDelJugador, caminos, distanciaEnMetros } = this.piezas;
    const posicion = reparto.posicionDe(id);
    const posicionDelJugador = reparto.posicionDe(idDelJugador);
    // Quien acompaña puede no haber entrado todavía al escenario: empieza a seguir cuando aparezca.
    if (posicion === undefined || posicionDelJugador === undefined) return;

    const movimiento = this.medirMovimientoDelJugador(posicionDelJugador);
    const lado = this.decidirLado(posicion, posicionDelJugador, movimiento.x);
    if (!this.estaCaminando && !debeEmpezarASeguir(posicion, posicionDelJugador, distanciaEnMetros)) return;
    this.estaCaminando = true;

    const lugar = lugarParaSeguir(posicion, posicionDelJugador, { distanciaEnMetros, lado }, caminos.terreno);
    // Mientras el jugador camina, su lugar se mueve con él: quien acompaña lo sigue sin detenerse,
    // para no quedarse atrás e ir dando tirones.
    const elJugadorSeMueve =
      Math.abs(movimiento.x) > MOVIMIENTO_QUE_CUENTA_EN_METROS ||
      Math.abs(movimiento.y) > MOVIMIENTO_QUE_CUENTA_EN_METROS;
    const yaLlego = distanciaEntre(posicion, lugar) <= TOLERANCIA_DE_LLEGADA_EN_METROS;
    if (yaLlego && !elJugadorSeMueve) {
      this.detener();
      return;
    }
    this.buscarRutaSiHaceFalta(posicion, lugar);
    this.darUnPaso(id, posicion, segundos);
    if (this.ruta.length === 0 && !this.laRutaLlegaAlLugar) {
      this.detener();
    }
  }

  /** Camina hacia el siguiente punto de la ruta. Al pasar por él, sigue con el que viene. */
  private darUnPaso(id: string, posicion: Punto, segundos: number): void {
    const siguientePunto = this.ruta[0];
    if (siguientePunto === undefined) return;

    const distanciaEnMetros = this.piezas.velocidadEnMetrosPorSegundo * segundos;
    const posicionNueva = acercarse(posicion, siguientePunto, distanciaEnMetros);
    this.piezas.reparto.mirarHacia(id, posicionNueva);
    this.piezas.reparto.mover(id, posicionNueva);

    const pasoPorElPunto = posicionNueva.x === siguientePunto.x && posicionNueva.y === siguientePunto.y;
    if (pasoPorElPunto) {
      this.ruta = this.ruta.slice(1);
    }
  }

  /**
   * De qué lado del jugador va: si el jugador camina de lado, del lado contrario (atrás de él);
   * si no, del que ya iba. La primera vez, del lado donde está.
   * `movimientoDeLado` es cuánto se movió el jugador en `x` desde el cuadro anterior.
   */
  private decidirLado(posicion: Punto, posicionDelJugador: Punto, movimientoDeLado: number): Lado {
    if (this.lado === undefined) {
      this.lado = posicion.x > posicionDelJugador.x ? 1 : -1;
    }
    if (movimientoDeLado > MOVIMIENTO_QUE_CUENTA_EN_METROS) {
      this.lado = -1;
    } else if (movimientoDeLado < -MOVIMIENTO_QUE_CUENTA_EN_METROS) {
      this.lado = 1;
    }
    return this.lado;
  }

  /** Cuánto se movió el jugador desde el cuadro anterior, en cada eje. La primera vez, nada. */
  private medirMovimientoDelJugador(posicionDelJugador: Punto): Punto {
    const anterior = this.posicionAnteriorDelJugador;
    this.posicionAnteriorDelJugador = posicionDelJugador;
    if (anterior === undefined) return { x: 0, y: 0 };
    return { x: posicionDelJugador.x - anterior.x, y: posicionDelJugador.y - anterior.y };
  }

  /** Busca la ruta hacia su lugar si no hay ninguna o si el lugar ya se movió de donde terminaba. */
  private buscarRutaSiHaceFalta(posicion: Punto, lugar: Punto): void {
    const laRutaSigueSirviendo =
      this.ruta.length > 0 &&
      this.finDeLaRuta !== undefined &&
      distanciaEntre(this.finDeLaRuta, lugar) <= DISTANCIA_PARA_BUSCAR_OTRA_RUTA_EN_METROS;
    if (laRutaSigueSirviendo) return;

    const camino = buscarCamino(posicion, lugar, this.piezas.caminos);
    // Sin camino que buscar (quien acompaña quedó fuera del piso), va derecho a su lugar.
    this.ruta = camino === undefined ? [lugar] : camino.puntos;
    this.laRutaLlegaAlLugar = camino === undefined || camino.llegaAlDestino;
    this.finDeLaRuta = lugar;
  }
}

// El acompañante: un personaje que sigue al jugador a corta distancia mientras explora
// (el primo que va con él al mercado). Lo declara el nivel en `jugador.acompanante`, y un paso `acompana`
// puede cambiarlo o quitarlo a media aventura.
//
// - Camina por el piso rodeando lo que estorba, igual que el jugador, y voltea hacia donde camina.
// - Se detiene cerca del jugador, del lado por el que venía: no se encima ni se le adelanta.
// - Durante un diálogo o una cinemática no sigue a nadie: ahí lo mueven los pasos `camina`, `mira` y `anima`.
//   Al terminar la escena vuelve a seguir desde donde quedó.

import { buscarCamino } from '../dominio/buscar-camino.ts';
import { acercarse } from '../dominio/caminar.ts';
import { distanciaEntre } from '../dominio/geometria.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { MapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { debeCaminarParaSeguir } from '../dominio/seguir.ts';
import type { Reparto } from './reparto.ts';

/** Si el jugador se alejó más que esto del final de la ruta, la ruta ya no sirve y se busca otra. */
const DISTANCIA_PARA_BUSCAR_OTRA_RUTA_EN_METROS = 0.5;

export interface PiezasDelAcompanante {
  readonly reparto: Reparto;
  /** El terreno del nivel y su rejilla, para buscar por dónde caminar. */
  readonly caminos: MapaDeCaminos;
  readonly idDelJugador: string;
  /** Camina a la velocidad del jugador: así lo alcanza sin correr y sin quedarse atrás. */
  readonly velocidadEnMetrosPorSegundo: number;
  /** Quién acompaña al jugador al empezar el nivel. `undefined` = nadie. */
  readonly idDelAcompananteInicial: string | undefined;
}

export class Acompanante {
  private readonly piezas: PiezasDelAcompanante;
  /** Quién acompaña al jugador ahora. `undefined` = nadie. */
  private idDelAcompanante: string | undefined;
  /** Los puntos por los que le falta pasar para alcanzar al jugador. Vacía = está quieto. */
  private ruta: readonly Punto[] = [];
  /** Dónde estaba el jugador cuando se buscó la ruta. */
  private finDeLaRuta: Punto | undefined;

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
    this.detener();
  }

  /** Lo deja quieto donde está. Se llama al empezar un diálogo o una cinemática. */
  detener(): void {
    this.ruta = [];
    this.finDeLaRuta = undefined;
  }

  /** Avanza lo que corresponde a un cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  avanzar(segundos: number): void {
    const id = this.idDelAcompanante;
    if (id === undefined) return;

    const { reparto, idDelJugador } = this.piezas;
    const posicion = reparto.posicionDe(id);
    const posicionDelJugador = reparto.posicionDe(idDelJugador);
    // Quien acompaña puede no haber entrado todavía al escenario: empieza a seguir cuando aparezca.
    if (posicion === undefined || posicionDelJugador === undefined) return;

    const yaVeniaCaminando = this.ruta.length > 0;
    if (!debeCaminarParaSeguir(posicion, posicionDelJugador, yaVeniaCaminando)) {
      this.detener();
      return;
    }

    this.buscarRutaSiHaceFalta(posicion, posicionDelJugador);
    const siguientePunto = this.ruta[0];
    if (siguientePunto === undefined) return;

    const distanciaEnMetros = this.piezas.velocidadEnMetrosPorSegundo * segundos;
    const posicionNueva = acercarse(posicion, siguientePunto, distanciaEnMetros);
    reparto.mirarHacia(id, posicionNueva);
    reparto.mover(id, posicionNueva);

    const pasoPorElPunto = posicionNueva.x === siguientePunto.x && posicionNueva.y === siguientePunto.y;
    if (pasoPorElPunto) {
      this.ruta = this.ruta.slice(1);
    }
  }

  /** Busca la ruta hacia el jugador si no hay ninguna o si el jugador ya se alejó de donde terminaba. */
  private buscarRutaSiHaceFalta(posicion: Punto, posicionDelJugador: Punto): void {
    const laRutaSigueSirviendo =
      this.ruta.length > 0 &&
      this.finDeLaRuta !== undefined &&
      distanciaEntre(this.finDeLaRuta, posicionDelJugador) <= DISTANCIA_PARA_BUSCAR_OTRA_RUTA_EN_METROS;
    if (laRutaSigueSirviendo) return;

    const camino = buscarCamino(posicion, posicionDelJugador, this.piezas.caminos);
    // Sin camino que buscar (quien acompaña quedó fuera del piso), va derecho hacia el jugador.
    this.ruta = camino === undefined ? [posicionDelJugador] : camino.puntos;
    this.finDeLaRuta = posicionDelJugador;
  }
}

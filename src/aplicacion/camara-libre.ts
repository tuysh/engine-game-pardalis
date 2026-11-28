// La cámara libre del modo depuración (docs/DISENO-3.0.md §9.3). Con ella, quien arma un nivel encuadra
// a mano un plano de cámara y lo copia como JSON, listo para pegar en `mundo.planos`. No hay editor aparte.
//
//   C            entra o sale de la cámara libre (el juego se pausa mientras tanto)
//   arrastrar    gira alrededor de lo que se mira, y sube o baja la cámara
//   rueda        acerca o aleja
//   clic         fija a qué mira el plano: un personaje, un objeto con id o un punto del mapa
//   1 a 9        salta a los planos que el nivel ya tiene, para compararlos
//   P            copia el plano actual
//
// Solo existe cuando el juego se crea con `depurar: true`.

import { GROSOR_DE_FRANJAS_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Contenido, Plano } from '../dominio/contenido.ts';
import { alejarPlano, girarPlano } from '../dominio/encuadrar-plano.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Decorado } from '../dominio/mundo.ts';
import { redactarPlano } from '../dominio/redactar-plano.ts';
import type { Escenario, Toque } from '../puertos/escenario.ts';
import type { OrdenDeDepuracion, PanelDeDepuracion } from '../puertos/panel-de-depuracion.ts';
import { buscarLugarMasCercano, reunirLugaresConNombre } from './lugares-con-nombre.ts';
import type { Reparto } from './reparto.ts';

/** Un toque en el piso fija la mira en lo que tenga nombre y esté a esta distancia o menos. */
const RADIO_PARA_FIJAR_LA_MIRA_EN_METROS = 1;

const AYUDA_SIN_CAMARA_LIBRE = 'Depuración — C: cámara libre';
const AYUDA_CON_CAMARA_LIBRE =
  'Cámara libre — C: salir · arrastrar: girar y subir · rueda: acercar · ' +
  'clic: fijar a qué mira · 1–9: planos · P: copiar';

export interface PiezasDeLaCamaraLibre {
  readonly contenido: Contenido;
  /** Los puntos con nombre del mapa: un plano puede mirar a uno. */
  readonly puntos: Readonly<Record<string, Punto>>;
  /** El decorado del mapa: un plano puede mirar a un objeto con id. */
  readonly decorado: readonly Decorado[];
  /** A dónde se mira mientras el plano no tiene a qué mirar. */
  readonly centroDelLugar: Punto;
  readonly escenario: Escenario;
  readonly reparto: Reparto;
  readonly panel: PanelDeDepuracion;
  /** Congelan y reanudan el juego: mientras la cámara libre está activa, el tiempo no pasa. */
  readonly pausarElJuego: () => void;
  readonly reanudarElJuego: () => void;
}

export class CamaraLibre {
  private readonly piezas: PiezasDeLaCamaraLibre;
  private readonly dejarDeRecibirOrdenes: () => void;
  private activa = false;
  /** El plano que se está encuadrando. Se conserva al salir, para seguir donde se dejó. */
  private plano: Plano;
  /** Un aviso corto que acompaña al plano en el panel, como «Copiado». */
  private aviso = '';

  constructor(piezas: PiezasDeLaCamaraLibre) {
    this.piezas = piezas;
    const camaraDelNivel = piezas.contenido.mundo.camara;
    this.plano = {
      mira: this.elegirMiraInicial(),
      distanciaEnMetros: camaraDelNivel.distanciaEnMetros,
      alturaEnMetros: camaraDelNivel.alturaEnMetros,
      giroEnGrados: camaraDelNivel.giroEnGrados,
    };
    this.dejarDeRecibirOrdenes = piezas.panel.alRecibirOrden((orden) => this.atenderOrden(orden));
    piezas.panel.mostrarTexto(AYUDA_SIN_CAMARA_LIBRE);
  }

  /** `true` mientras se encuadra a mano: entonces los toques al escenario no son para el juego. */
  get estaActiva(): boolean {
    return this.activa;
  }

  /** Un toque al escenario con la cámara libre activa fija a qué mira el plano. */
  atenderToque(toque: Toque): void {
    if (!this.activa) return;

    let nombre: string | undefined;
    switch (toque.tipo) {
      case 'personaje':
      case 'decorado':
        nombre = toque.id;
        break;
      case 'piso':
        nombre = this.buscarNombreCercaDe(toque.punto);
        break;
    }
    if (nombre === undefined) {
      this.aviso = 'Ahí no hay nada con nombre: toca un personaje, un objeto con id o un punto del mapa.';
    } else {
      this.plano = { ...this.plano, mira: nombre };
      this.aviso = '';
    }
    this.mostrar();
  }

  /** Deja de atender órdenes y, si estaba activa, devuelve el juego a su curso. */
  destruir(): void {
    this.dejarDeRecibirOrdenes();
    if (this.activa) {
      this.salir();
    }
  }

  private atenderOrden(orden: OrdenDeDepuracion): void {
    if (orden.tipo === 'alternarCamaraLibre') {
      if (this.activa) {
        this.salir();
      } else {
        this.entrar();
      }
      return;
    }
    // Las demás órdenes solo cuentan mientras se encuadra.
    if (!this.activa) return;

    switch (orden.tipo) {
      case 'girar':
        this.plano = girarPlano(this.plano, orden);
        this.aviso = '';
        break;
      case 'alejar':
        this.plano = alejarPlano(this.plano, orden.muescas);
        this.aviso = '';
        break;
      case 'irAlPlano':
        this.irAlPlanoDelNivel(orden.numero);
        break;
      case 'copiarPlano':
        this.copiar();
        break;
    }
    this.mostrar();
  }

  private entrar(): void {
    this.activa = true;
    this.aviso = '';
    this.piezas.pausarElJuego();
    this.piezas.panel.avisarCamaraLibre(true);
    // Lo que queda bajo las franjas no se ve en una cinemática: se marca para no encuadrar ahí a nadie.
    this.piezas.panel.mostrarGuiaDeFranjas(this.piezas.contenido.mundo.franjas ?? GROSOR_DE_FRANJAS_POR_DEFECTO);
    this.mostrar();
  }

  private salir(): void {
    this.activa = false;
    this.piezas.panel.avisarCamaraLibre(false);
    this.piezas.panel.mostrarGuiaDeFranjas(undefined);
    this.piezas.panel.mostrarTexto(AYUDA_SIN_CAMARA_LIBRE);
    // Al reanudar, la cámara del juego vuelve a colocarse sola en el siguiente cuadro.
    this.piezas.reanudarElJuego();
  }

  /** `numero` empieza en 1: es el lugar del plano en `mundo.planos`, en el orden en que el nivel los escribe. */
  private irAlPlanoDelNivel(numero: number): void {
    const planos = this.piezas.contenido.mundo.planos;
    const nombre = Object.keys(planos)[numero - 1];
    if (nombre === undefined) {
      this.aviso = `El nivel no tiene un plano número ${numero}.`;
      return;
    }
    this.plano = planos[nombre]!; // `nombre` viene de `Object.keys`, así que existe
    this.aviso = `Plano del nivel: ${nombre}`;
  }

  private copiar(): void {
    if (this.plano.mira === '') {
      this.aviso = 'Antes de copiar, fija a qué mira el plano con un clic.';
      return;
    }
    this.aviso = 'Copiando…';
    // `copiar` nunca rechaza: si el navegador no deja copiar, termina con `false`.
    void this.piezas.panel.copiar(redactarPlano(this.plano)).then((seCopio) => {
      if (seCopio) {
        this.aviso = 'Copiado. Pégalo en "mundo.planos" del contenido y ponle su nombre.';
      } else {
        this.aviso = 'El navegador no dejó copiar: selecciona el renglón de arriba y cópialo a mano.';
      }
      if (this.activa) {
        this.mostrar();
      }
    });
  }

  /** Coloca la cámara según el plano, dibuja un cuadro (el juego está en pausa) y escribe el plano en el panel. */
  private mostrar(): void {
    const ajustes = {
      distanciaEnMetros: this.plano.distanciaEnMetros,
      alturaEnMetros: this.plano.alturaEnMetros,
      giroEnGrados: this.plano.giroEnGrados,
    };
    this.piezas.escenario.enfocar(this.buscarDondeMira(), ajustes);
    this.piezas.escenario.dibujar(0);

    const lineas = [AYUDA_CON_CAMARA_LIBRE, redactarPlano(this.plano)];
    if (this.aviso !== '') {
      lineas.push(this.aviso);
    }
    this.piezas.panel.mostrarTexto(lineas.join('\n'));
  }

  private buscarDondeMira(): Punto {
    const lugar = reunirLugaresConNombre(this.piezas).find((candidato) => candidato.nombre === this.plano.mira);
    if (lugar === undefined) return this.piezas.centroDelLugar;
    return lugar.punto;
  }

  /** El nombre de lo que esté más cerca de un punto del piso, o `undefined` si no hay nada con nombre cerca. */
  private buscarNombreCercaDe(punto: Punto): string | undefined {
    const lugares = reunirLugaresConNombre(this.piezas);
    const masCercano = buscarLugarMasCercano(lugares, punto, RADIO_PARA_FIJAR_LA_MIRA_EN_METROS);
    if (masCercano === undefined) return undefined;
    return masCercano.nombre;
  }

  /** Al empezar se mira al jugador; en un nivel sin jugador, a lo primero que tenga nombre. */
  private elegirMiraInicial(): string {
    const jugador = this.piezas.contenido.jugador;
    if (jugador !== undefined) return jugador.personaje;

    const primerLugar = reunirLugaresConNombre(this.piezas)[0];
    if (primerLugar === undefined) return '';
    return primerLugar.nombre;
  }
}

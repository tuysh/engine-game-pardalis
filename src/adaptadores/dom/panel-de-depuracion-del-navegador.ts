// El panel de depuración en el navegador: convierte teclas, arrastres del ratón y la rueda en órdenes
// para la cámara libre (docs/DISENO-3.0.md §9.3), y muestra en una esquina el texto con el que el motor responde.
// Este archivo solo se carga cuando el juego se crea con `depurar: true`.
//
// Se verifica a mano en la demo (`?depurar` en la dirección); no tiene pruebas automáticas porque necesita un navegador.

import type { OrdenDeDepuracion, PanelDeDepuracion } from '../../puertos/panel-de-depuracion.ts';

/** Lo que avanza la rueda del ratón con cada muesca, en las unidades en que el navegador lo informa. */
const AVANCE_DE_UNA_MUESCA_DE_LA_RUEDA = 100;

const TECLA_DE_CAMARA_LIBRE = 'KeyC';
const TECLA_DE_COPIAR = 'KeyP';
// Las teclas de los números del 1 al 9, por su lugar en el teclado. Ejemplo: 'Digit3' es la tecla del 3.
const PREFIJO_DE_LAS_TECLAS_DE_NUMERO = 'Digit';

export class PanelDeDepuracionDelNavegador implements PanelDeDepuracion {
  private readonly elementoDelJuego: HTMLElement;
  private readonly letrero: HTMLElement;
  private funcionesDeOrden: ((orden: OrdenDeDepuracion) => void)[] = [];
  private laCamaraLibreEstaActiva = false;
  /** `true` mientras el botón del ratón está oprimido sobre el juego. */
  private seEstaArrastrando = false;
  private estaDestruido = false;

  /** Pone el letrero del panel dentro de `elementoDelJuego`, arriba a la izquierda. */
  constructor(elementoDelJuego: HTMLElement) {
    this.elementoDelJuego = elementoDelJuego;
    this.letrero = document.createElement('pre');
    this.letrero.style.cssText =
      'position:absolute; left:8px; top:8px; right:8px; margin:0; padding:6px 10px; border-radius:6px; ' +
      'background:rgb(0 0 0 / 70%); color:#fff; font:13px/1.5 ui-monospace, monospace; white-space:pre-wrap; ' +
      // El letrero no atrapa clics (para poder tocar lo que queda debajo), pero su texto sí se puede seleccionar.
      'pointer-events:none; user-select:text; z-index:1;';
    elementoDelJuego.appendChild(this.letrero);

    window.addEventListener('keydown', this.alOprimirUnaTecla);
    elementoDelJuego.addEventListener('pointerdown', this.alApoyar);
    window.addEventListener('pointermove', this.alMover);
    window.addEventListener('pointerup', this.alSoltar);
    // `passive: false` deja llamar a `preventDefault`, para que la rueda no desplace la página.
    elementoDelJuego.addEventListener('wheel', this.alGirarLaRueda, { passive: false });
  }

  alRecibirOrden(funcion: (orden: OrdenDeDepuracion) => void): () => void {
    this.funcionesDeOrden.push(funcion);
    return () => {
      this.funcionesDeOrden = this.funcionesDeOrden.filter((registrada) => registrada !== funcion);
    };
  }

  avisarCamaraLibre(estaActiva: boolean): void {
    this.laCamaraLibreEstaActiva = estaActiva;
    this.seEstaArrastrando = false;
  }

  mostrarTexto(texto: string): void {
    this.letrero.textContent = texto;
  }

  async copiar(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (error) {
      // El navegador solo deja copiar en páginas seguras (https o localhost) y con permiso.
      console.warn('[escenario-engine] no se pudo copiar al portapapeles:', error);
      return false;
    }
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;
    this.funcionesDeOrden = [];
    window.removeEventListener('keydown', this.alOprimirUnaTecla);
    this.elementoDelJuego.removeEventListener('pointerdown', this.alApoyar);
    window.removeEventListener('pointermove', this.alMover);
    window.removeEventListener('pointerup', this.alSoltar);
    this.elementoDelJuego.removeEventListener('wheel', this.alGirarLaRueda);
    this.letrero.remove();
  }

  private darOrden(orden: OrdenDeDepuracion): void {
    for (const funcion of [...this.funcionesDeOrden]) {
      funcion(orden);
    }
  }

  // Estas funciones se guardan como propiedades (y no como métodos) para poder quitarlas
  // después con `removeEventListener`, que necesita exactamente la misma función que se registró.
  private readonly alOprimirUnaTecla = (evento: KeyboardEvent): void => {
    if (evento.repeat) return;

    if (evento.code === TECLA_DE_CAMARA_LIBRE) {
      this.darOrden({ tipo: 'alternarCamaraLibre' });
      return;
    }
    // Las demás teclas solo son del panel con la cámara libre activa: al jugar, los números eligen opciones.
    if (!this.laCamaraLibreEstaActiva) return;

    if (evento.code === TECLA_DE_COPIAR) {
      this.darOrden({ tipo: 'copiarPlano' });
      return;
    }
    if (evento.code.startsWith(PREFIJO_DE_LAS_TECLAS_DE_NUMERO)) {
      const numero = Number(evento.code.slice(PREFIJO_DE_LAS_TECLAS_DE_NUMERO.length));
      if (numero >= 1) {
        this.darOrden({ tipo: 'irAlPlano', numero });
      }
    }
  };

  private readonly alApoyar = (): void => {
    this.seEstaArrastrando = this.laCamaraLibreEstaActiva;
  };

  private readonly alMover = (evento: PointerEvent): void => {
    if (!this.seEstaArrastrando) return;
    this.darOrden({
      tipo: 'girar',
      haciaLaDerechaEnPuntos: evento.movementX,
      haciaAbajoEnPuntos: evento.movementY,
    });
  };

  private readonly alSoltar = (): void => {
    this.seEstaArrastrando = false;
  };

  private readonly alGirarLaRueda = (evento: WheelEvent): void => {
    if (!this.laCamaraLibreEstaActiva) return;
    evento.preventDefault();
    this.darOrden({ tipo: 'alejar', muescas: evento.deltaY / AVANCE_DE_UNA_MUESCA_DE_LA_RUEDA });
  };
}

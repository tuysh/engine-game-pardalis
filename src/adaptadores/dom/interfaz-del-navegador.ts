// La interfaz del juego hecha con elementos de la página: globos de diálogo, tarjetas de opciones,
// señales, franjas de cine, fundidos y el botón de inicio. Va encima del lienzo del escenario,
// dentro de un «shadow root» (docs/DISENO-3.0.md §9.4). Su apariencia está en estilos-de-la-interfaz.ts.
//
// Este archivo junta las piezas (cada una en su archivo) y atiende lo que es de todas: los toques
// para seguir un diálogo, el teclado y el espacio de los minijuegos. Tras un toque que cierra la última línea,
// la capa de toque se queda un momento (espera-para-volver-a-hablar.ts) para que un doble toque no empiece
// otra plática.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador.

import type { GrosorDeFranjas } from '../../dominio/contenido.ts';
import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import type { GloboPorMostrar, Interfaz, OpcionPorMostrar } from '../../puertos/interfaz.ts';
import { crearBotonConDibujo, crearConTexto, crearDibujo, crearOculto } from './elementos.ts';
import { EsperaParaVolverAHablar } from './espera-para-volver-a-hablar.ts';
import { ESTILOS_DE_LA_INTERFAZ } from './estilos-de-la-interfaz.ts';
import { altoDeLaFranjaEnCss, proporcionDeLaFranja } from './franjas-de-cine.ts';
import { GloboDeDialogo } from './globo-de-dialogo.ts';
import { SenalEnPantalla } from './senal-en-pantalla.ts';
import { SenalesDePendientes } from './senales-de-pendientes.ts';
import { TarjetasDeOpciones } from './tarjetas-de-opciones.ts';
import { queHaceLaTeclaConTarjetas } from './tecla-con-tarjetas.ts';
import { esTeclaDeUnCampo, esTeclaDeUnControl } from './tecla-de-un-control.ts';

/** Cuánto crece todo en el modo proyección, para que se lea desde el fondo del salón. */
const ESCALA_NORMAL = 1;
const ESCALA_DE_PROYECCION = 1.4;

/** Los dibujos de la interfaz, como recorridos de SVG sobre una cuadrícula de 24 × 24. */
const TRAZO_DE_REPRODUCIR = 'M6 3 L21 12 L6 21 Z';
const TRAZO_DE_SALTAR = 'M3 5 L11 12 L3 19 Z M11 5 L19 12 L11 19 Z M19 5 H22 V19 H19 Z';
const TRAZO_DE_FLECHA_HACIA_ABAJO = 'M12 22 L3 11 H9 V2 H15 V11 H21 Z';
/** Un globito de diálogo con tres puntos: «aquí puedes hablar». */
const TRAZO_DE_GLOBITO =
  'M4 3 H20 A2 2 0 0 1 22 5 V14 A2 2 0 0 1 20 16 H13 L8 21 V16 H4 A2 2 0 0 1 2 14 V5 A2 2 0 0 1 4 3 Z ' +
  'M6 9.5 A1.5 1.5 0 1 0 9 9.5 A1.5 1.5 0 1 0 6 9.5 Z ' +
  'M10.5 9.5 A1.5 1.5 0 1 0 13.5 9.5 A1.5 1.5 0 1 0 10.5 9.5 Z ' +
  'M15 9.5 A1.5 1.5 0 1 0 18 9.5 A1.5 1.5 0 1 0 15 9.5 Z';

export class InterfazDelNavegador implements Interfaz {
  /** El elemento del host donde vive el juego. */
  private readonly elementoDelJuego: HTMLElement;
  /** El elemento que aloja el «shadow root» con la interfaz. */
  private readonly anfitrion: HTMLElement;
  private readonly globo = new GloboDeDialogo();
  private readonly opciones = new TarjetasDeOpciones();
  private readonly flecha = new SenalEnPantalla('flecha');
  private readonly aviso = new SenalEnPantalla('aviso');
  private readonly senalesDePendientes = new SenalesDePendientes();
  private readonly capaDeToque = crearOculto('div', 'capa-de-toque');
  private readonly fundido = crearOculto('div', 'fundido');
  private readonly destello = crearOculto('div', 'destello');
  private readonly franjas = crearOculto('div', 'franjas');
  /** Qué parte del alto ocupa cada franja mientras se ven. */
  private proporcionDeLaFranja = 0;
  private readonly panelDeSaltar = crearOculto('div', 'panel-de-saltar');
  private readonly panelDeInicio = crearOculto('div', 'inicio');
  /** El marco que sostiene a pantalla completa el espacio del minijuego abierto. `undefined` = no hay ninguno. */
  private marcoDeMinijuego: HTMLElement | undefined;
  private funcionesParaSeguir: (() => void)[] = [];
  /** Cuándo un toque o una tecla siguió el diálogo: la capa de toque se queda un momento después. */
  private readonly esperaParaVolverAHablar = new EsperaParaVolverAHablar();
  /** El temporizador que esconderá la capa de toque. `undefined` = no hay ninguno pendiente. */
  private temporizadorDeLaCapa: ReturnType<typeof setTimeout> | undefined;
  private funcionesDeEleccion: ((posicion: number) => void)[] = [];
  /** Cuándo salieron las tarjetas o `Enter` enfocó una (`performance.now()`): ver `tecla-con-tarjetas.ts`. */
  private momentoDelUltimoCambioDeLasTarjetas = 0;
  private estaDestruida = false;

  /** Pone la capa de la interfaz dentro de `elemento`, encima de lo que ya tenga. */
  constructor(elemento: HTMLElement) {
    // La capa se coloca respecto a `elemento`; para eso el elemento no puede tener la posición por defecto.
    if (getComputedStyle(elemento).position === 'static') {
      elemento.style.position = 'relative';
    }
    this.elementoDelJuego = elemento;
    this.anfitrion = document.createElement('div');
    const raiz = this.anfitrion.attachShadow({ mode: 'open' });

    const estilos = document.createElement('style');
    estilos.textContent = ESTILOS_DE_LA_INTERFAZ;
    // El orden importa: lo que va después se dibuja encima.
    raiz.append(
      estilos,
      this.flecha.elemento,
      this.senalesDePendientes.elemento,
      this.aviso.elemento,
      this.fundido,
      this.destello,
      this.franjas,
      this.capaDeToque,
      this.globo.elemento,
      this.opciones.elemento,
      this.panelDeSaltar,
      this.panelDeInicio,
    );

    this.capaDeToque.addEventListener('click', this.alTocarLaCapa);
    document.addEventListener('keydown', this.alOprimirUnaTecla);
    elemento.appendChild(this.anfitrion);
  }

  mostrarGlobo(globo: GloboPorMostrar): () => void {
    return this.globo.mostrar(globo);
  }

  apuntarGlobo(lugar: LugarEnPantalla | undefined): void {
    const alto = this.anfitrion.clientHeight;
    let altoDeUnaFranja = 0;
    if (!this.franjas.hidden) {
      altoDeUnaFranja = alto * this.proporcionDeLaFranja;
    }
    this.globo.apuntar(lugar, {
      ancho: this.anfitrion.clientWidth,
      alto,
      ocupadoArribaEnPuntos: altoDeUnaFranja,
      ocupadoAbajoEnPuntos: altoDeUnaFranja,
    });
  }

  alTocarParaSeguir(funcion: () => void): () => void {
    this.funcionesParaSeguir.push(funcion);
    this.olvidarElTemporizadorDeLaCapa();
    this.capaDeToque.hidden = false;
    return () => {
      this.funcionesParaSeguir = this.funcionesParaSeguir.filter((registrada) => registrada !== funcion);
      if (this.funcionesParaSeguir.length > 0) return;
      this.esconderLaCapaCuandoDescanse();
    };
  }

  mostrarOpciones(pregunta: string, opciones: readonly OpcionPorMostrar[]): void {
    this.opciones.mostrar(pregunta, opciones, (posicion) => this.avisarEleccion(posicion));
    this.momentoDelUltimoCambioDeLasTarjetas = performance.now();
  }

  resaltarOpcion(posicion: number | undefined): void {
    this.opciones.resaltar(posicion);
  }

  ocultarOpciones(): void {
    this.opciones.ocultar();
  }

  alElegirOpcion(funcion: (posicion: number) => void): () => void {
    this.funcionesDeEleccion.push(funcion);
    return () => {
      this.funcionesDeEleccion = this.funcionesDeEleccion.filter((registrada) => registrada !== funcion);
    };
  }

  mostrarFlecha(texto: string | undefined): void {
    const contenido: Node[] = [];
    if (texto !== undefined) {
      contenido.push(crearConTexto('div', 'leyenda-de-la-flecha', texto));
    }
    contenido.push(crearDibujo(TRAZO_DE_FLECHA_HACIA_ABAJO));
    this.flecha.mostrar(contenido);
  }

  apuntarFlecha(lugar: LugarEnPantalla): void {
    this.flecha.apuntar(lugar);
  }

  ocultarFlecha(): void {
    this.flecha.ocultar();
  }

  ponerSenalesDePendientes(lugares: readonly LugarEnPantalla[]): void {
    this.senalesDePendientes.poner(lugares);
  }

  mostrarAviso(): void {
    if (this.aviso.estaVisible) return;
    this.aviso.mostrar([crearDibujo(TRAZO_DE_GLOBITO)]);
  }

  apuntarAviso(lugar: LugarEnPantalla): void {
    this.aviso.apuntar(lugar);
  }

  ocultarAviso(): void {
    this.aviso.ocultar();
  }

  ponerFundido(opacidad: number): void {
    this.fundido.style.opacity = String(opacidad);
    this.fundido.hidden = opacidad <= 0;
  }

  ponerDestello(opacidad: number): void {
    this.destello.style.opacity = String(opacidad);
    this.destello.hidden = opacidad <= 0;
  }

  mostrarFranjasDeCine(alSaltar: (() => void) | undefined, grosor: GrosorDeFranjas): void {
    this.proporcionDeLaFranja = proporcionDeLaFranja(grosor);
    this.franjas.style.setProperty('--alto-de-la-franja', altoDeLaFranjaEnCss(grosor));
    this.franjas.hidden = false;
    this.panelDeSaltar.replaceChildren();
    if (alSaltar === undefined) return;

    // El botón no lleva texto: los dos triángulos de «adelantar» se entienden sin leer.
    const boton = crearBotonConDibujo('boton-de-saltar', 'Saltar', TRAZO_DE_SALTAR);
    boton.addEventListener('click', alSaltar);
    this.panelDeSaltar.replaceChildren(boton);
    this.panelDeSaltar.hidden = false;
  }

  ocultarFranjasDeCine(): void {
    this.franjas.hidden = true;
    this.panelDeSaltar.hidden = true;
    this.panelDeSaltar.replaceChildren();
  }

  abrirEspacioDeMinijuego(): HTMLElement {
    this.cerrarEspacioDeMinijuego();

    // El marco es del motor y lo coloca a pantalla completa. Es una rejilla de una sola celda:
    // lo que tenga dentro se estira para llenarla, sin depender de los estilos que el minijuego
    // le ponga a su elemento (que puede reemplazarlos todos sin romper nada).
    const marco = document.createElement('div');
    marco.style.position = 'absolute';
    marco.style.inset = '0';
    marco.style.display = 'grid';

    const espacio = document.createElement('div');
    // El host puede dar estilo a sus minijuegos con el selector [data-escenario-minijuego].
    espacio.setAttribute('data-escenario-minijuego', '');
    marco.append(espacio);

    // Va fuera del «shadow root» y después de todo lo demás: así queda encima y con los estilos del host.
    this.elementoDelJuego.appendChild(marco);
    this.marcoDeMinijuego = marco;
    return espacio;
  }

  cerrarEspacioDeMinijuego(): void {
    if (this.marcoDeMinijuego === undefined) return;
    this.marcoDeMinijuego.remove();
    this.marcoDeMinijuego = undefined;
  }

  /**
   * Muestra un botón grande de jugar sobre el juego y llama a `alTocar` cuando lo tocan.
   * Ese primer toque es el que deja al navegador reproducir sonido (docs/DISENO-3.0.md §7.5).
   */
  mostrarBotonDeInicio(alTocar: () => void): void {
    // El botón no lleva texto: el triángulo de «reproducir» se entiende sin leer.
    const boton = crearBotonConDibujo('boton-de-inicio', 'Jugar', TRAZO_DE_REPRODUCIR);
    boton.addEventListener(
      'click',
      () => {
        this.panelDeInicio.hidden = true;
        this.panelDeInicio.replaceChildren();
        alTocar();
      },
      { once: true },
    );
    this.panelDeInicio.replaceChildren(boton);
    this.panelDeInicio.hidden = false;
  }

  /** Modo salón de clases: todo más grande. Se puede cambiar en cualquier momento. */
  ajustarProyeccion(estaActiva: boolean): void {
    const escala = estaActiva ? ESCALA_DE_PROYECCION : ESCALA_NORMAL;
    this.anfitrion.style.setProperty('--escala', String(escala));
  }

  destruir(): void {
    if (this.estaDestruida) return;
    this.estaDestruida = true;
    this.capaDeToque.removeEventListener('click', this.alTocarLaCapa);
    document.removeEventListener('keydown', this.alOprimirUnaTecla);
    this.funcionesParaSeguir = [];
    this.funcionesDeEleccion = [];
    this.olvidarElTemporizadorDeLaCapa();
    this.cerrarEspacioDeMinijuego();
    this.anfitrion.remove();
  }

  /**
   * Esconde la capa de toque, pero si un toque (o una tecla) acaba de cerrar la línea, primero espera a que
   * pase el descanso de `EsperaParaVolverAHablar`. Así el segundo toque de un doble toque cae en la capa, que
   * ya no sigue nada, y no en el escenario, donde haría hablar otra vez a quien quedó debajo del dedo (o
   * caminar al jugador). Si la línea se cerró sola, al terminar la voz, la capa se esconde de inmediato.
   */
  private esconderLaCapaCuandoDescanse(): void {
    this.olvidarElTemporizadorDeLaCapa();
    const faltan = this.esperaParaVolverAHablar.milisegundosQueFaltan(performance.now());
    if (faltan <= 0) {
      this.capaDeToque.hidden = true;
      return;
    }
    this.temporizadorDeLaCapa = setTimeout(() => {
      this.temporizadorDeLaCapa = undefined;
      this.capaDeToque.hidden = this.funcionesParaSeguir.length === 0;
    }, faltan);
  }

  private olvidarElTemporizadorDeLaCapa(): void {
    if (this.temporizadorDeLaCapa === undefined) return;
    clearTimeout(this.temporizadorDeLaCapa);
    this.temporizadorDeLaCapa = undefined;
  }

  private avisarEleccion(posicion: number): void {
    // Se recorre una copia porque quien escucha se da de baja mientras se le avisa.
    for (const funcion of [...this.funcionesDeEleccion]) {
      funcion(posicion);
    }
  }

  // Estas dos funciones se guardan como propiedades (y no como métodos) para poder quitarlas
  // después con `removeEventListener`, que necesita exactamente la misma función que se registró.
  private readonly alTocarLaCapa = (): void => {
    if (this.funcionesParaSeguir.length > 0) {
      this.esperaParaVolverAHablar.anotarQueSeSiguioElDialogo(performance.now());
    }
    for (const funcion of [...this.funcionesParaSeguir]) {
      funcion();
    }
  };

  /**
   * Con teclado: Enter o la barra espaciadora siguen el diálogo, y las teclas 1 a 9 eligen una tarjeta.
   * Las tarjetas son botones: con una enfocada, Enter o la barra la eligen solas, sin pasar por aquí.
   * Con las tarjetas a la vista y el foco en ningún lado, Enter, la barra o Tab enfocan una (`tecla-con-tarjetas.ts`).
   */
  private readonly alOprimirUnaTecla = (evento: KeyboardEvent): void => {
    if (this.opciones.cantidad > 0) {
      this.atenderTeclaConTarjetas(evento);
      return;
    }

    // Enter o la barra espaciadora en un botón (del host, de un minijuego o el de saltar) oprimen ese botón:
    // cancelarlas para seguir el diálogo lo dejaría sin funcionar con teclado.
    if (esTeclaDeUnControl(evento.composedPath())) return;
    const hayAlguienEscuchando = this.funcionesParaSeguir.length > 0;
    if (hayAlguienEscuchando && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault();
      // `repeat` llega mientras la tecla se queda oprimida: dejarla así no debe ir saltando una línea tras otra.
      if (evento.repeat) return;
      this.alTocarLaCapa();
    }
  };

  private atenderTeclaConTarjetas(evento: KeyboardEvent): void {
    const enfocado = document.activeElement;
    const camino = evento.composedPath();
    const accion = queHaceLaTeclaConTarjetas({
      tecla: evento.key,
      repetida: evento.repeat,
      conMayusculas: evento.shiftKey,
      cantidad: this.opciones.cantidad,
      esDeUnControl: esTeclaDeUnControl(camino),
      esDeUnCampo: esTeclaDeUnCampo(camino),
      nadaTieneElFoco: enfocado === null || enfocado === document.body,
      milisegundosDesdeElUltimoCambio: performance.now() - this.momentoDelUltimoCambioDeLasTarjetas,
    });
    if (accion.tipo === 'dejar') return;
    evento.preventDefault();
    if (accion.tipo === 'elegir') {
      this.avisarEleccion(accion.posicion);
      return;
    }
    if (accion.tipo === 'enfocar') {
      this.opciones.enfocar(accion.posicion);
      // Solo `Enter` y la barra descansan tras enfocar: `Tab` es para moverse, no se oprime de más.
      if (evento.key !== 'Tab') this.momentoDelUltimoCambioDeLasTarjetas = performance.now();
    }
  }
}

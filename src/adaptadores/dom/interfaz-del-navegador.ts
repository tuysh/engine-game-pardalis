// La interfaz del juego hecha con elementos de la página: globos de diálogo, tarjetas de opciones
// y el botón de inicio. Va encima del lienzo del escenario, dentro de un «shadow root»
// (docs/DISENO-3.0.md §9.4). Su apariencia está en estilos-de-la-interfaz.ts.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador.

import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import type { GloboPorMostrar, Interfaz, OpcionPorMostrar } from '../../puertos/interfaz.ts';
import { ESTILOS_DE_LA_INTERFAZ } from './estilos-de-la-interfaz.ts';

/** Separación entre el globo y la cabeza de quien habla, y entre el globo y la orilla del juego. */
const SEPARACION_DEL_GLOBO_EN_PUNTOS = 18;
const MARGEN_DEL_GLOBO_EN_PUNTOS = 12;

/** A qué altura del juego va el globo cuando quien habla no está en el escenario: una parte del alto. */
const ALTURA_DEL_GLOBO_SIN_HABLANTE = 0.35;

/** Cuánto crece todo en el modo proyección, para que se lea desde el fondo del salón. */
const ESCALA_NORMAL = 1;
const ESCALA_DE_PROYECCION = 1.4;

const ESPACIO_SVG = 'http://www.w3.org/2000/svg';

export class InterfazDelNavegador implements Interfaz {
  /** El elemento del host donde vive el juego. */
  private readonly elementoDelJuego: HTMLElement;
  /** El elemento que aloja el «shadow root» con la interfaz. */
  private readonly anfitrion: HTMLElement;
  /** El marco que sostiene a pantalla completa el espacio del minijuego abierto. `undefined` = no hay ninguno. */
  private marcoDeMinijuego: HTMLElement | undefined;
  private readonly capaDeToque: HTMLElement;
  private readonly globo: HTMLElement;
  private readonly panelDeOpciones: HTMLElement;
  private readonly panelDeInicio: HTMLElement;
  private tarjetas: HTMLElement[] = [];
  private funcionesParaSeguir: (() => void)[] = [];
  private funcionesDeEleccion: ((posicion: number) => void)[] = [];
  /** Cuántos globos se han mostrado. Sirve para saber si el globo en pantalla sigue siendo el de quien quiere quitarlo. */
  private globosMostrados = 0;
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
    this.capaDeToque = crearOculto('div', 'capa-de-toque');
    this.globo = crearOculto('div', 'globo');
    // Quien usa un lector de pantalla escucha cada globo nuevo sin tener que buscarlo.
    this.globo.setAttribute('role', 'status');
    this.panelDeOpciones = crearOculto('div', 'opciones');
    this.panelDeInicio = crearOculto('div', 'inicio');
    raiz.append(estilos, this.capaDeToque, this.globo, this.panelDeOpciones, this.panelDeInicio);

    this.capaDeToque.addEventListener('click', this.alTocarLaCapa);
    document.addEventListener('keydown', this.alOprimirUnaTecla);
    elemento.appendChild(this.anfitrion);
  }

  mostrarGlobo(globo: GloboPorMostrar): () => void {
    this.globosMostrados++;
    const numeroDeEsteGlobo = this.globosMostrados;

    this.globo.replaceChildren();
    if (globo.palabra !== undefined) {
      this.globo.append(crearConTexto('div', 'tarjeta-de-palabra', `${globo.palabra.en} · ${globo.palabra.es}`));
    }
    this.globo.append(crearConTexto('div', 'texto', globo.texto));
    if (globo.traduccion !== undefined) {
      this.globo.append(crearConTexto('div', 'traduccion', globo.traduccion));
    }
    this.globo.hidden = false;

    return () => {
      const sigueSiendoElGloboEnPantalla = this.globosMostrados === numeroDeEsteGlobo;
      if (sigueSiendoElGloboEnPantalla) {
        this.globo.hidden = true;
      }
    };
  }

  apuntarGlobo(lugar: LugarEnPantalla | undefined): void {
    const anchoDelJuego = this.anfitrion.clientWidth;
    const altoDelJuego = this.anfitrion.clientHeight;
    const anchoDelGlobo = this.globo.offsetWidth;
    const altoDelGlobo = this.globo.offsetHeight;

    // Sin lugar (quien habla no está en el escenario), el globo va arriba y al centro.
    const lugarDelPiquito = lugar ?? { x: anchoDelJuego / 2, y: altoDelJuego * ALTURA_DEL_GLOBO_SIN_HABLANTE };

    // El globo se centra sobre el piquito, pero sin salirse del juego por los lados ni por arriba.
    const izquierdaDeseada = lugarDelPiquito.x - anchoDelGlobo / 2;
    const izquierdaMaxima = anchoDelJuego - anchoDelGlobo - MARGEN_DEL_GLOBO_EN_PUNTOS;
    const izquierda = Math.max(MARGEN_DEL_GLOBO_EN_PUNTOS, Math.min(izquierdaDeseada, izquierdaMaxima));
    const arribaDeseado = lugarDelPiquito.y - altoDelGlobo - SEPARACION_DEL_GLOBO_EN_PUNTOS;
    const arriba = Math.max(MARGEN_DEL_GLOBO_EN_PUNTOS, arribaDeseado);

    this.globo.style.transform = `translate(${izquierda}px, ${arriba}px)`;
    // Si el globo tuvo que correrse de lado, el piquito se corre al revés para seguir apuntando a quien habla.
    const desvioDelPiquito = izquierdaDeseada - izquierda;
    this.globo.style.setProperty('--desvio-del-piquito', `${desvioDelPiquito}px`);
  }

  alTocarParaSeguir(funcion: () => void): () => void {
    this.funcionesParaSeguir.push(funcion);
    this.capaDeToque.hidden = false;
    return () => {
      this.funcionesParaSeguir = this.funcionesParaSeguir.filter((registrada) => registrada !== funcion);
      this.capaDeToque.hidden = this.funcionesParaSeguir.length === 0;
    };
  }

  mostrarOpciones(pregunta: string, opciones: readonly OpcionPorMostrar[]): void {
    const filaDeTarjetas = crearConTexto('div', 'tarjetas', '');
    this.tarjetas = [];
    for (let i = 0; i < opciones.length; i++) {
      const tarjeta = this.crearTarjeta(opciones[i]!, i); // `i` es menor que el largo de la lista
      this.tarjetas.push(tarjeta);
      filaDeTarjetas.append(tarjeta);
    }
    this.panelDeOpciones.replaceChildren(crearConTexto('div', 'pregunta', pregunta), filaDeTarjetas);
    this.panelDeOpciones.hidden = false;
  }

  resaltarOpcion(posicion: number | undefined): void {
    for (let i = 0; i < this.tarjetas.length; i++) {
      this.tarjetas[i]!.classList.toggle('resaltada', i === posicion); // `i` es menor que el largo de la lista
    }
  }

  ocultarOpciones(): void {
    this.panelDeOpciones.hidden = true;
    this.panelDeOpciones.replaceChildren();
    this.tarjetas = [];
  }

  alElegirOpcion(funcion: (posicion: number) => void): () => void {
    this.funcionesDeEleccion.push(funcion);
    return () => {
      this.funcionesDeEleccion = this.funcionesDeEleccion.filter((registrada) => registrada !== funcion);
    };
  }

  /**
   * Muestra un botón grande de jugar sobre el juego y llama a `alTocar` cuando lo tocan.
   * Ese primer toque es el que deja al navegador reproducir sonido (docs/DISENO-3.0.md §7.5).
   */
  mostrarBotonDeInicio(alTocar: () => void): void {
    const boton = document.createElement('button');
    boton.className = 'boton-de-inicio';
    boton.type = 'button';
    // El botón no lleva texto: el triángulo de «reproducir» se entiende sin leer.
    boton.setAttribute('aria-label', 'Jugar');
    boton.append(crearTrianguloDeReproducir());
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
    this.cerrarEspacioDeMinijuego();
    this.anfitrion.remove();
  }

  private crearTarjeta(opcion: OpcionPorMostrar, posicion: number): HTMLElement {
    const tarjeta = document.createElement('button');
    tarjeta.className = 'tarjeta';
    tarjeta.type = 'button';
    tarjeta.append(crearConTexto('span', 'numero-de-tarjeta', String(posicion + 1)));

    if (opcion.direccionDeLaImagen !== undefined) {
      const imagen = document.createElement('img');
      imagen.src = opcion.direccionDeLaImagen;
      // La imagen repite lo que ya dice el texto de la tarjeta; un lector de pantalla no debe leerla dos veces.
      imagen.alt = '';
      tarjeta.append(imagen);
    }
    if (opcion.texto !== undefined) {
      tarjeta.append(crearConTexto('span', 'texto', opcion.texto));
    }
    if (opcion.traduccion !== undefined) {
      tarjeta.append(crearConTexto('span', 'traduccion', opcion.traduccion));
    }
    tarjeta.addEventListener('click', () => this.avisarEleccion(posicion));
    return tarjeta;
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
    for (const funcion of [...this.funcionesParaSeguir]) {
      funcion();
    }
  };

  /** Con teclado: Enter o la barra espaciadora siguen el diálogo, y las teclas 1 a 9 eligen una tarjeta. */
  private readonly alOprimirUnaTecla = (evento: KeyboardEvent): void => {
    const hayOpcionesEnPantalla = this.tarjetas.length > 0;
    if (hayOpcionesEnPantalla) {
      const numero = Number(evento.key);
      const esUnaTarjeta = Number.isInteger(numero) && numero >= 1 && numero <= this.tarjetas.length;
      if (esUnaTarjeta) {
        evento.preventDefault();
        this.avisarEleccion(numero - 1);
      }
      return;
    }

    const hayAlguienEscuchando = this.funcionesParaSeguir.length > 0;
    if (hayAlguienEscuchando && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault();
      this.alTocarLaCapa();
    }
  };
}

function crearOculto(etiqueta: string, clase: string): HTMLElement {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  elemento.hidden = true;
  return elemento;
}

/** Crea un elemento con un texto. El texto se pone con `textContent`, que nunca lo interpreta como HTML. */
function crearConTexto(etiqueta: string, clase: string, texto: string): HTMLElement {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  elemento.textContent = texto;
  return elemento;
}

function crearTrianguloDeReproducir(): SVGElement {
  const dibujo = document.createElementNS(ESPACIO_SVG, 'svg');
  dibujo.setAttribute('viewBox', '0 0 24 24');
  dibujo.setAttribute('aria-hidden', 'true');
  const triangulo = document.createElementNS(ESPACIO_SVG, 'path');
  triangulo.setAttribute('d', 'M6 3 L21 12 L6 21 Z');
  dibujo.append(triangulo);
  return dibujo;
}

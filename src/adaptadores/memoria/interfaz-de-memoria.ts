// Interfaz falsa para las pruebas: no muestra nada. Recuerda lo que se le pidió mostrar
// y deja que la prueba simule los toques del jugador.

import type { GrosorDeFranjas } from '../../dominio/contenido.ts';
import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import type { GloboPorMostrar, Interfaz, OpcionPorMostrar } from '../../puertos/interfaz.ts';

/** Las opciones que están en pantalla. */
export interface OpcionesMostradas {
  readonly pregunta: string;
  readonly opciones: readonly OpcionPorMostrar[];
}

export class InterfazDeMemoria implements Interfaz {
  /** El globo que está en pantalla. `undefined` = no hay ninguno. */
  globo: GloboPorMostrar | undefined;
  /** Todos los globos que se han mostrado, en orden. */
  readonly globosMostrados: GloboPorMostrar[] = [];
  lugarDelGlobo: LugarEnPantalla | undefined;
  /** Las opciones que están en pantalla. `undefined` = no hay. */
  opciones: OpcionesMostradas | undefined;
  /** Las posiciones que se han resaltado, en orden. */
  readonly opcionesResaltadas: (number | undefined)[] = [];
  /** `true` mientras la flecha de la salida está en pantalla. */
  hayFlecha = false;
  textoDeLaFlecha: string | undefined;
  lugarDeLaFlecha: LugarEnPantalla | undefined;
  /** `true` mientras se muestra la señal de que hay algo a la mano. */
  hayAviso = false;
  lugarDelAviso: LugarEnPantalla | undefined;
  /** Qué tan oscura está la pantalla: 0 = nada, 1 = todo negro. */
  opacidadDelFundido = 0;
  /** Qué tan blanca está la pantalla por un destello: 0 = nada, 1 = todo blanco. */
  opacidadDelDestello = 0;
  /** La opacidad más alta que llegó a tener el destello: dice si alguna vez se vio. */
  opacidadMaximaDelDestello = 0;
  /** `true` mientras se ven las franjas de cine. */
  hayFranjasDeCine = false;
  /** El grosor con que se mostraron las franjas la última vez. */
  grosorDeLasFranjas: GrosorDeFranjas | undefined;
  /** Lo que hace el botón de saltar. `undefined` = no hay botón. */
  private funcionDeSaltar: (() => void) | undefined;
  /** `true` mientras hay un minijuego abierto. */
  hayEspacioDeMinijuego = false;
  estaDestruida = false;

  private funcionesParaSeguir: (() => void)[] = [];
  private funcionesDeEleccion: ((posicion: number) => void)[] = [];

  mostrarGlobo(globo: GloboPorMostrar): () => void {
    this.globo = globo;
    this.globosMostrados.push(globo);
    return () => {
      if (this.globo === globo) {
        this.globo = undefined;
      }
    };
  }

  apuntarGlobo(lugar: LugarEnPantalla | undefined): void {
    this.lugarDelGlobo = lugar;
  }

  alTocarParaSeguir(funcion: () => void): () => void {
    this.funcionesParaSeguir.push(funcion);
    return () => {
      this.funcionesParaSeguir = this.funcionesParaSeguir.filter((registrada) => registrada !== funcion);
    };
  }

  mostrarOpciones(pregunta: string, opciones: readonly OpcionPorMostrar[]): void {
    this.opciones = { pregunta, opciones };
  }

  resaltarOpcion(posicion: number | undefined): void {
    this.opcionesResaltadas.push(posicion);
  }

  ocultarOpciones(): void {
    this.opciones = undefined;
  }

  alElegirOpcion(funcion: (posicion: number) => void): () => void {
    this.funcionesDeEleccion.push(funcion);
    return () => {
      this.funcionesDeEleccion = this.funcionesDeEleccion.filter((registrada) => registrada !== funcion);
    };
  }

  mostrarFlecha(texto: string | undefined): void {
    this.hayFlecha = true;
    this.textoDeLaFlecha = texto;
  }

  apuntarFlecha(lugar: LugarEnPantalla): void {
    this.lugarDeLaFlecha = lugar;
  }

  ocultarFlecha(): void {
    this.hayFlecha = false;
  }

  mostrarAviso(): void {
    this.hayAviso = true;
  }

  apuntarAviso(lugar: LugarEnPantalla): void {
    this.lugarDelAviso = lugar;
  }

  ocultarAviso(): void {
    this.hayAviso = false;
  }

  ponerFundido(opacidad: number): void {
    this.opacidadDelFundido = opacidad;
  }

  ponerDestello(opacidad: number): void {
    this.opacidadDelDestello = opacidad;
    this.opacidadMaximaDelDestello = Math.max(this.opacidadMaximaDelDestello, opacidad);
  }

  mostrarFranjasDeCine(alSaltar: (() => void) | undefined, grosor: GrosorDeFranjas): void {
    this.hayFranjasDeCine = true;
    this.grosorDeLasFranjas = grosor;
    this.funcionDeSaltar = alSaltar;
  }

  ocultarFranjasDeCine(): void {
    this.hayFranjasDeCine = false;
    this.funcionDeSaltar = undefined;
  }

  get hayBotonDeSaltar(): boolean {
    return this.funcionDeSaltar !== undefined;
  }

  /** Para las pruebas: hace como si el jugador hubiera tocado el botón de saltar. */
  simularToqueEnSaltar(): void {
    if (this.funcionDeSaltar !== undefined) {
      this.funcionDeSaltar();
    }
  }

  abrirEspacioDeMinijuego(): HTMLElement {
    this.hayEspacioDeMinijuego = true;
    // Las pruebas corren sin navegador, así que no hay elementos de verdad. Este objeto vacío ocupa su lugar:
    // los minijuegos falsos de las pruebas no dibujan nada en él.
    return {} as HTMLElement;
  }

  cerrarEspacioDeMinijuego(): void {
    this.hayEspacioDeMinijuego = false;
  }

  destruir(): void {
    this.estaDestruida = true;
  }

  /** Para comprobar que nada quedó escuchando toques después de un diálogo. */
  get hayQuienEscuchaToques(): boolean {
    return this.funcionesParaSeguir.length > 0 || this.funcionesDeEleccion.length > 0;
  }

  /** Para las pruebas: hace como si el jugador hubiera tocado la pantalla para seguir. */
  simularToqueParaSeguir(): void {
    for (const funcion of [...this.funcionesParaSeguir]) {
      funcion();
    }
  }

  /** Para las pruebas: hace como si el jugador hubiera tocado la tarjeta de esa posición. */
  simularEleccion(posicion: number): void {
    for (const funcion of [...this.funcionesDeEleccion]) {
      funcion(posicion);
    }
  }
}

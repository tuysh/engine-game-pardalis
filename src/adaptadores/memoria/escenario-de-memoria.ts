// Escenario falso para las pruebas: no dibuja nada. Recuerda lo que se le pidió
// y deja que la prueba simule toques del jugador.

import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import type { Punto } from '../../dominio/geometria.ts';
import type { GuiaDeDepuracion } from '../../dominio/guias-de-depuracion.ts';
import type { Mira } from '../../dominio/mundo.ts';
import type {
  Escenario,
  Escenografia,
  ImagenDeEscena,
  LugarEnPantalla,
  PersonajeDeEscena,
  Toque,
} from '../../puertos/escenario.ts';

/** Cómo está un personaje en el escenario falso. */
export interface PersonajeRecordado {
  posicion: Punto;
  mira: Mira;
  sePuedeTocar: boolean;
}

/** El dibujo que se le puso a un personaje con `ponerDibujoDePersonaje`. */
export interface DibujoRecordado {
  readonly imagen: ImagenDeEscena;
  readonly repite: boolean;
}

export class EscenarioDeMemoria implements Escenario {
  /** La última escenografía montada. */
  escenografia: Escenografia | undefined;
  /** Los personajes agregados, por id. */
  readonly personajes = new Map<string, PersonajeRecordado>();
  /** El dibujo con que entró cada personaje al escenario (`agregarPersonaje`), por id. */
  readonly dibujosAlEntrar = new Map<string, ImagenDeEscena>();
  /** El último dibujo que se le cambió a cada personaje, por id. Quien nunca cambió de dibujo no aparece. */
  readonly dibujos = new Map<string, DibujoRecordado>();
  /** Los lugares, en `Escenografia.decorado`, de los objetos que están ocultos ahora. */
  readonly decoradoOculto = new Set<number>();
  /** El último dibujo que se le cambió a cada objeto del decorado, por su lugar en la lista. */
  readonly dibujosDelDecorado = new Map<number, DibujoRecordado>();
  /** Las imágenes que se pidió descargar por adelantado. */
  readonly imagenesPrecargadas: ImagenDeEscena[] = [];
  /** El último punto al que se apuntó la cámara. */
  puntoEnfocado: Punto | undefined;
  /** Desde dónde miraba la cámara la última vez que se le apuntó. */
  camaraEnfocada: AjustesDeCamara | undefined;
  cuadrosDibujados = 0;
  /** Las guías de depuración que se están mostrando. */
  guias: readonly GuiaDeDepuracion[] = [];
  /** Los efectos que se han pedido, en orden. */
  readonly efectosReproducidos: { nombre: string; punto: Punto }[] = [];
  /** Para las pruebas: con `true`, el siguiente `montar` falla como si una imagen no hubiera cargado. */
  fallarElSiguienteMontaje = false;
  estaDestruido = false;

  private funcionesDeToque: ((toque: Toque) => void)[] = [];
  private funcionesDeCarga: (() => void)[] = [];

  async montar(escenografia: Escenografia): Promise<void> {
    if (this.fallarElSiguienteMontaje) {
      this.fallarElSiguienteMontaje = false;
      throw new ErrorDeEscenario(['no se pudo cargar la imagen del suelo']);
    }
    this.escenografia = escenografia;
    // Una escenografía nueva es un lugar nuevo: los personajes del lugar anterior ya no están.
    this.personajes.clear();
    this.dibujosAlEntrar.clear();
    this.dibujos.clear();
    this.decoradoOculto.clear();
    this.dibujosDelDecorado.clear();

    if (escenografia.suelo !== undefined) {
      this.avisarDeLaCargaDe(escenografia.suelo.imagen);
    }
    for (const telon of escenografia.telones) {
      this.avisarDeLaCargaDe(telon.imagen);
    }
    for (const objeto of escenografia.decorado) {
      this.avisarDeLaCargaDe(objeto.imagen);
    }
  }

  async agregarPersonaje(personaje: PersonajeDeEscena): Promise<void> {
    this.personajes.set(personaje.id, {
      posicion: personaje.posicion,
      mira: personaje.mira,
      sePuedeTocar: personaje.sePuedeTocar,
    });
    this.dibujosAlEntrar.set(personaje.id, personaje.imagen);
    this.avisarDeLaCargaDe(personaje.imagen);
  }

  quitarPersonaje(id: string): void {
    this.personajes.delete(id);
    this.dibujos.delete(id);
  }

  moverPersonaje(id: string, posicion: Punto): void {
    const personaje = this.personajes.get(id);
    if (personaje !== undefined) {
      personaje.posicion = posicion;
    }
  }

  voltearPersonaje(id: string, mira: Mira): void {
    const personaje = this.personajes.get(id);
    if (personaje !== undefined) {
      personaje.mira = mira;
    }
  }

  async ponerDibujoDePersonaje(
    id: string,
    imagen: ImagenDeEscena,
    opciones: { readonly repite: boolean },
  ): Promise<void> {
    if (this.personajes.has(id)) {
      this.dibujos.set(id, { imagen, repite: opciones.repite });
    }
  }

  cambiarVisibilidadDelDecorado(indice: number, opciones: { readonly esVisible: boolean }): void {
    if (opciones.esVisible) {
      this.decoradoOculto.delete(indice);
    } else {
      this.decoradoOculto.add(indice);
    }
  }

  async ponerDibujoDeDecorado(
    indice: number,
    imagen: ImagenDeEscena,
    opciones: { readonly repite: boolean },
  ): Promise<void> {
    this.dibujosDelDecorado.set(indice, { imagen, repite: opciones.repite });
  }

  async precargar(imagenes: readonly ImagenDeEscena[]): Promise<void> {
    this.imagenesPrecargadas.push(...imagenes);
    for (const imagen of imagenes) {
      this.avisarDeLaCargaDe(imagen);
    }
  }

  alCargarImagen(funcion: () => void): () => void {
    this.funcionesDeCarga.push(funcion);
    return () => {
      this.funcionesDeCarga = this.funcionesDeCarga.filter((registrada) => registrada !== funcion);
    };
  }

  /** En el escenario falso, la «pantalla» es el propio plano: un metro es un punto. */
  lugarEnPantallaDe(id: string): LugarEnPantalla | undefined {
    const personaje = this.personajes.get(id);
    if (personaje === undefined) return undefined;
    return { x: personaje.posicion.x, y: personaje.posicion.y };
  }

  lugarEnPantallaDelPunto(punto: Punto, alturaEnMetros: number): LugarEnPantalla {
    return { x: punto.x, y: punto.y };
  }

  reproducirEfecto(nombre: string, punto: Punto): void {
    this.efectosReproducidos.push({ nombre, punto });
  }

  enfocar(punto: Punto, camara: AjustesDeCamara): void {
    this.puntoEnfocado = punto;
    this.camaraEnfocada = camara;
  }

  dibujar(segundos: number): void {
    this.cuadrosDibujados++;
  }

  async mostrarGuias(guias: readonly GuiaDeDepuracion[]): Promise<void> {
    this.guias = guias;
  }

  alTocar(funcion: (toque: Toque) => void): () => void {
    this.funcionesDeToque.push(funcion);
    return () => {
      this.funcionesDeToque = this.funcionesDeToque.filter((registrada) => registrada !== funcion);
    };
  }

  destruir(): void {
    this.estaDestruido = true;
    this.funcionesDeToque = [];
  }

  /** En el escenario falso todo «carga» al instante: se avisa una vez por cada archivo de la imagen. */
  private avisarDeLaCargaDe(imagen: ImagenDeEscena): void {
    for (let i = 0; i < imagen.direcciones.length; i++) {
      for (const funcion of [...this.funcionesDeCarga]) {
        funcion();
      }
    }
  }

  /** Para las pruebas: hace como si el jugador hubiera tocado algo. */
  simularToque(toque: Toque): void {
    for (const funcion of this.funcionesDeToque) {
      funcion(toque);
    }
  }
}

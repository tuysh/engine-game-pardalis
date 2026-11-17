// El escenario dibujado con Three.js: personajes y objetos de papel parados dentro de un lugar en 3D.
//
// Se verifica a mano en la demo (`bun ejemplo/servidor.ts`); no tiene pruebas automáticas porque necesita WebGL.

import { Color, Group, Mesh, Scene, Vector3, WebGLRenderer } from 'three';
import type { Object3D } from 'three';
import type { AjustesDeCamara } from '../../dominio/contenido.ts';
import { centroDeRectangulo } from '../../dominio/forma.ts';
import type { Punto } from '../../dominio/geometria.ts';
import type { Mira } from '../../dominio/mundo.ts';
import type {
  DecoradoDeEscena,
  Escenario,
  Escenografia,
  LugarEnPantalla,
  PersonajeDeEscena,
  Toque,
} from '../../puertos/escenario.ts';
import { buscarToque } from './buscar-toque.ts';
import { CamaraQueSigue } from './camara-que-sigue.ts';
import {
  crearHojaAcostada,
  crearHojaParada,
  crearSombra,
  crearTelon,
  liberarPieza,
  ORDEN_DE_LO_PINTADO_EN_EL_PISO,
  ORDEN_DEL_PISO,
} from './piezas-de-papel.ts';
import { cargarTextura } from './texturas.ts';
import type { FabricaDeTexturas } from './texturas.ts';

/** Si el dedo se movió más que esto entre apoyar y soltar, fue un arrastre y no un toque. */
const MOVIMIENTO_MAXIMO_DE_UN_TOQUE_EN_PUNTOS = 12;

/** Las pantallas muy finas no se aprovechan completas: dibujar tantos píxeles calienta las tablets. */
const DENSIDAD_MAXIMA_DE_DIBUJO = 2;

export class EscenarioDeThree implements Escenario {
  private readonly elemento: HTMLElement;
  private readonly fabrica: FabricaDeTexturas;
  private readonly dibujante: WebGLRenderer;
  private readonly escena = new Scene();
  private readonly camara = new CamaraQueSigue();
  /** Todo lo que `montar` puso: se quita completo al montar otra escenografía. */
  private readonly escenografia = new Group();
  /** Cada personaje es un grupo con su hoja y su sombra, por id. */
  private readonly personajes = new Map<string, Group>();
  /** Cuánto mide de alto cada personaje, para saber dónde queda su cabeza. */
  private readonly altoDeCadaPersonajeEnMetros = new Map<string, number>();
  /** Los objetos que responden al toque, con el toque que les corresponde. */
  private readonly tocables = new Map<Object3D, Toque>();
  private readonly observadorDeTamano: ResizeObserver;
  private funcionesDeToque: ((toque: Toque) => void)[] = [];
  /** Dónde se apoyó el dedo, para saber al soltarlo si fue un toque o un arrastre. */
  private lugarDondeSeApoyo: Punto | undefined;
  private estaDestruido = false;

  /** Lanza un error si el navegador no puede crear un lienzo con WebGL. */
  constructor(elemento: HTMLElement, fabrica: FabricaDeTexturas) {
    this.elemento = elemento;
    this.fabrica = fabrica;
    this.dibujante = new WebGLRenderer({ antialias: true });
    this.dibujante.setPixelRatio(Math.min(fabrica.densidadDePantalla, DENSIDAD_MAXIMA_DE_DIBUJO));
    this.escena.add(this.escenografia);

    const lienzo = this.dibujante.domElement;
    lienzo.style.display = 'block';
    // Evita que el navegador desplace o amplíe la página al tocar el juego.
    lienzo.style.touchAction = 'none';
    elemento.appendChild(lienzo);
    lienzo.addEventListener('pointerdown', this.alApoyar);
    lienzo.addEventListener('pointerup', this.alSoltar);

    this.observadorDeTamano = new ResizeObserver(() => this.ajustarAlElemento());
    this.observadorDeTamano.observe(elemento);
    this.ajustarAlElemento();
  }

  async montar(escenografia: Escenografia): Promise<void> {
    this.quitarEscenografia();
    this.escena.background = new Color(escenografia.colorDeFondo);

    if (escenografia.suelo !== undefined) {
      const { imagen, esquina } = escenografia.suelo;
      const textura = await cargarTextura(imagen, this.fabrica);
      const rectangulo = { x: esquina.x, y: esquina.y, ancho: imagen.anchoEnMetros, alto: imagen.altoEnMetros };
      this.escenografia.add(crearHojaAcostada(textura, rectangulo, ORDEN_DEL_PISO));
    }
    for (const telon of escenografia.telones) {
      const textura = await cargarTextura(telon.imagen, this.fabrica);
      this.escenografia.add(crearTelon(textura, telon.desde, telon.hasta, telon.altoEnMetros));
    }
    for (const objeto of escenografia.decorado) {
      const pieza = await this.crearDecorado(objeto);
      this.escenografia.add(pieza);
      if (objeto.id !== undefined) {
        this.tocables.set(pieza, { tipo: 'decorado', id: objeto.id });
      }
    }
  }

  async agregarPersonaje(personaje: PersonajeDeEscena): Promise<void> {
    const textura = await cargarTextura(personaje.imagen, this.fabrica);
    const hoja = crearHojaParada(textura, personaje.imagen);

    const grupo = new Group();
    grupo.add(crearSombra(personaje.imagen.anchoEnMetros));
    grupo.add(hoja);
    this.personajes.set(personaje.id, grupo);
    this.altoDeCadaPersonajeEnMetros.set(personaje.id, personaje.imagen.altoEnMetros);
    this.escena.add(grupo);
    if (personaje.sePuedeTocar) {
      this.tocables.set(hoja, { tipo: 'personaje', id: personaje.id });
    }

    this.moverPersonaje(personaje.id, personaje.posicion);
    this.voltearPersonaje(personaje.id, personaje.mira);
  }

  moverPersonaje(id: string, posicion: Punto): void {
    const grupo = this.personajes.get(id);
    if (grupo === undefined) return;
    grupo.position.set(posicion.x, 0, posicion.y);
  }

  /** Los dibujos de personajes miran a la derecha; para mirar a la izquierda, la hoja se voltea como un espejo. */
  voltearPersonaje(id: string, mira: Mira): void {
    const grupo = this.personajes.get(id);
    if (grupo === undefined) return;
    grupo.scale.x = mira === 'derecha' ? 1 : -1;
  }

  lugarEnPantallaDe(id: string): LugarEnPantalla | undefined {
    const grupo = this.personajes.get(id);
    const altoEnMetros = this.altoDeCadaPersonajeEnMetros.get(id);
    if (grupo === undefined || altoEnMetros === undefined) return undefined;

    const dondePisa = { x: grupo.position.x, y: grupo.position.z };
    return this.lugarEnPantallaDelPunto(dondePisa, altoEnMetros);
  }

  lugarEnPantallaDelPunto(punto: Punto, alturaEnMetros: number): LugarEnPantalla {
    // `project` convierte un punto del espacio 3D a la medida de pantalla de Three.js:
    // de -1 a 1, con el centro en 0 y la `y` hacia arriba. De ahí se pasa a puntos de CSS.
    const enElEspacio = new Vector3(punto.x, alturaEnMetros, punto.y);
    enElEspacio.project(this.camara.camara);
    const lienzo = this.dibujante.domElement;
    return {
      x: ((enElEspacio.x + 1) / 2) * lienzo.clientWidth,
      y: ((1 - enElEspacio.y) / 2) * lienzo.clientHeight,
    };
  }

  enfocar(punto: Punto, camara: AjustesDeCamara, opciones: { readonly deInmediato: boolean }): void {
    this.camara.enfocar(punto, camara, opciones.deInmediato);
  }

  dibujar(segundos: number): void {
    if (this.estaDestruido) return;
    this.camara.actualizar(segundos);
    this.dibujante.render(this.escena, this.camara.camara);
  }

  alTocar(funcion: (toque: Toque) => void): () => void {
    this.funcionesDeToque.push(funcion);
    return () => {
      this.funcionesDeToque = this.funcionesDeToque.filter((registrada) => registrada !== funcion);
    };
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;

    const lienzo = this.dibujante.domElement;
    lienzo.removeEventListener('pointerdown', this.alApoyar);
    lienzo.removeEventListener('pointerup', this.alSoltar);
    this.observadorDeTamano.disconnect();
    this.funcionesDeToque = [];

    this.quitarEscenografia();
    for (const grupo of this.personajes.values()) {
      this.escena.remove(grupo);
      liberarPiezasDe(grupo);
    }
    this.personajes.clear();
    this.altoDeCadaPersonajeEnMetros.clear();
    this.tocables.clear();

    this.dibujante.dispose();
    lienzo.remove();
  }

  private async crearDecorado(objeto: DecoradoDeEscena): Promise<Mesh> {
    const textura = await cargarTextura(objeto.imagen, this.fabrica);
    if (objeto.clase === 'plano') {
      return crearHojaAcostada(textura, objeto.huella, ORDEN_DE_LO_PINTADO_EN_EL_PISO);
    }

    // `parado` y `colgado` son hojas paradas en el centro de su huella; lo colgado, además, va en lo alto.
    const hoja = crearHojaParada(textura, objeto.imagen);
    const centro = centroDeRectangulo(objeto.huella);
    const altura = objeto.clase === 'colgado' ? objeto.alturaEnMetros : 0;
    hoja.position.set(centro.x, altura, centro.y);
    return hoja;
  }

  private quitarEscenografia(): void {
    for (const pieza of this.escenografia.children) {
      this.tocables.delete(pieza);
    }
    liberarPiezasDe(this.escenografia);
    this.escenografia.clear();
  }

  /** Hace que el lienzo ocupe todo el elemento del host, también cuando este cambia de tamaño. */
  private ajustarAlElemento(): void {
    const ancho = this.elemento.clientWidth;
    const alto = this.elemento.clientHeight;
    if (ancho === 0 || alto === 0) return;
    this.dibujante.setSize(ancho, alto);
    this.camara.cambiarProporcion(ancho / alto);
  }

  // Estas dos funciones se guardan como propiedades (y no como métodos) para poder quitarlas
  // después con `removeEventListener`, que necesita exactamente la misma función que se registró.
  private readonly alApoyar = (evento: PointerEvent): void => {
    this.lugarDondeSeApoyo = { x: evento.offsetX, y: evento.offsetY };
  };

  private readonly alSoltar = (evento: PointerEvent): void => {
    const apoyo = this.lugarDondeSeApoyo;
    this.lugarDondeSeApoyo = undefined;
    if (apoyo === undefined) return;

    const movimiento = Math.hypot(evento.offsetX - apoyo.x, evento.offsetY - apoyo.y);
    if (movimiento > MOVIMIENTO_MAXIMO_DE_UN_TOQUE_EN_PUNTOS) return;

    const lienzo = this.dibujante.domElement;
    const lugar = {
      x: evento.offsetX,
      y: evento.offsetY,
      anchoDelLienzo: lienzo.clientWidth,
      altoDelLienzo: lienzo.clientHeight,
    };
    const toque = buscarToque(lugar, this.camara.camara, this.tocables);
    if (toque === undefined) return;
    for (const funcion of this.funcionesDeToque) {
      funcion(toque);
    }
  };
}

/** Libera la memoria de video de todas las piezas que hay dentro de un grupo. */
function liberarPiezasDe(grupo: Group): void {
  for (const hijo of grupo.children) {
    if (hijo instanceof Mesh) {
      liberarPieza(hijo);
    }
  }
}

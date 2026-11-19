// El escenario dibujado con Three.js: personajes y objetos de papel parados dentro de un lugar en 3D.
//
// Este archivo junta las piezas (cada una en su archivo): la cámara, los personajes, las texturas,
// las animaciones, los efectos y los toques. Aquí quedan el montaje de la escenografía y el dibujo de cada cuadro.
//
// Se verifica a mano en la demo (`bun ejemplo/servidor.ts`); no tiene pruebas automáticas porque necesita WebGL.

import { Color, Group, Scene, Vector3, WebGLRenderer } from 'three';
import type { Object3D } from 'three';
import type { AjustesDeCamara } from '../../dominio/contenido.ts';
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
import { AlmacenDeTexturas } from './almacen-de-texturas.ts';
import { AnimacionesDeHojas } from './animaciones-de-hojas.ts';
import { armarEscenografia } from './armar-escenografia.ts';
import { CamaraEnPerspectiva } from './camara-en-perspectiva.ts';
import { EfectoDeParticulas } from './efecto-de-particulas.ts';
import { PersonajesDePapel } from './personajes-de-papel.ts';
import { liberarPieza } from './piezas-de-papel.ts';
import type { FabricaDeTexturas } from './texturas.ts';
import { ToquesDelLienzo } from './toques-del-lienzo.ts';

const ALTURA_DE_LOS_EFECTOS_EN_METROS = 0.9;

/** Las pantallas muy finas no se aprovechan completas: dibujar tantos píxeles calienta las tablets. */
const DENSIDAD_MAXIMA_DE_DIBUJO = 2;

export class EscenarioDeThree implements Escenario {
  private readonly elemento: HTMLElement;
  private readonly fabrica: FabricaDeTexturas;
  private readonly dibujante: WebGLRenderer;
  private readonly escena = new Scene();
  private readonly camara = new CamaraEnPerspectiva();
  private readonly almacen: AlmacenDeTexturas;
  private readonly animaciones = new AnimacionesDeHojas();
  /** Los objetos que responden al toque, con el toque que les corresponde. */
  private readonly tocables = new Map<Object3D, Toque>();
  private readonly personajes: PersonajesDePapel;
  private readonly toques: ToquesDelLienzo;
  /** Todo lo que `montar` puso: se quita completo al montar otra escenografía. */
  private readonly escenografia = new Group();
  /** Cambia con cada `montar`: una escenografía que terminó de cargar tarde, para un lugar anterior, no se pone. */
  private numeroDeMontaje = 0;
  /** Los efectos que se están animando ahora. */
  private efectos: EfectoDeParticulas[] = [];
  /** Quita y libera las guías del modo depuración que se ven ahora. `undefined` = no hay ninguna. */
  private quitarGuiasActuales: (() => void) | undefined;
  /** Cambia con cada `mostrarGuias`: si dos pedidos se cruzan mientras cargan, gana el último. */
  private numeroDeGuias = 0;
  private readonly observadorDeTamano: ResizeObserver;
  private estaDestruido = false;

  /** Lanza un error si el navegador no puede crear un lienzo con WebGL. */
  constructor(elemento: HTMLElement, fabrica: FabricaDeTexturas) {
    this.elemento = elemento;
    this.fabrica = fabrica;
    this.almacen = new AlmacenDeTexturas(fabrica);
    this.personajes = new PersonajesDePapel({
      escena: this.escena,
      almacen: this.almacen,
      animaciones: this.animaciones,
      tocables: this.tocables,
    });
    this.dibujante = new WebGLRenderer({ antialias: true });
    this.dibujante.setPixelRatio(Math.min(fabrica.densidadDePantalla, DENSIDAD_MAXIMA_DE_DIBUJO));
    this.escena.add(this.escenografia);

    const lienzo = this.dibujante.domElement;
    lienzo.style.display = 'block';
    // Evita que el navegador desplace o amplíe la página al tocar el juego.
    lienzo.style.touchAction = 'none';
    elemento.appendChild(lienzo);
    this.toques = new ToquesDelLienzo({ lienzo, camara: this.camara.camara, tocables: this.tocables });

    this.observadorDeTamano = new ResizeObserver(() => this.ajustarAlElemento());
    this.observadorDeTamano.observe(elemento);
    this.ajustarAlElemento();
  }

  async montar(escenografia: Escenografia): Promise<void> {
    this.numeroDeMontaje++;
    const esteMontaje = this.numeroDeMontaje;
    this.almacen.empezarOtroLugar();

    // Primero se descarga todo y hasta el final se cambia lo que se ve: así el lugar anterior no queda a medias.
    const lista = await armarEscenografia(escenografia, this.almacen);
    if (this.estaDestruido || esteMontaje !== this.numeroDeMontaje) return;

    this.quitarEscenografia();
    this.personajes.quitarTodos();
    this.escena.background = new Color(escenografia.colorDeFondo);
    for (const pieza of lista.fondo) {
      this.escenografia.add(pieza);
    }
    for (const { objeto, texturas, pieza } of lista.decorado) {
      this.escenografia.add(pieza);
      if (objeto.id !== undefined) {
        this.tocables.set(pieza, { tipo: 'decorado', id: objeto.id });
      }
      // Un objeto cuyo dibujo es una animación la repite sin parar (una bandera, un foco que parpadea).
      this.animaciones.animar(pieza, texturas, { cuadrosPorSegundo: objeto.imagen.cuadrosPorSegundo, repite: true });
    }
  }

  async agregarPersonaje(personaje: PersonajeDeEscena): Promise<void> {
    await this.personajes.agregar(personaje);
  }

  quitarPersonaje(id: string): void {
    this.personajes.quitar(id);
  }

  moverPersonaje(id: string, posicion: Punto): void {
    this.personajes.mover(id, posicion);
  }

  voltearPersonaje(id: string, mira: Mira): void {
    this.personajes.voltear(id, mira);
  }

  async ponerDibujoDePersonaje(
    id: string,
    imagen: ImagenDeEscena,
    opciones: { readonly repite: boolean },
  ): Promise<void> {
    await this.personajes.ponerDibujo(id, imagen, opciones);
  }

  async precargar(imagenes: readonly ImagenDeEscena[]): Promise<void> {
    await Promise.all(imagenes.map((imagen) => this.almacen.cargar(imagen)));
    // Con esto el lugar ya tiene todo lo que usa: lo que quedó del lugar anterior y ya no hace falta, se libera.
    this.almacen.liberarLasQueSobran();
  }

  alCargarImagen(funcion: () => void): () => void {
    return this.almacen.alCargarUnArchivo(funcion);
  }

  lugarEnPantallaDe(id: string): LugarEnPantalla | undefined {
    const personaje = this.personajes.buscarLugarYAltura(id);
    if (personaje === undefined) return undefined;
    return this.lugarEnPantallaDelPunto(personaje.dondePisa, personaje.altoEnMetros);
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

  reproducirEfecto(nombre: string, punto: Punto): void {
    if (this.estaDestruido) return;
    // El efecto nace a la altura del pecho de un personaje parado en ese punto.
    const efecto = EfectoDeParticulas.crear(nombre, { x: punto.x, y: ALTURA_DE_LOS_EFECTOS_EN_METROS, z: punto.y });
    if (efecto === undefined) return;
    this.efectos.push(efecto);
    this.escena.add(efecto.puntos);
  }

  enfocar(punto: Punto, camara: AjustesDeCamara): void {
    this.camara.colocar(punto, camara);
    // Las medidas de pantalla que se piden después (dónde va un globo) deben salir de la cámara ya colocada.
    this.camara.camara.updateMatrixWorld();
  }

  dibujar(segundos: number): void {
    if (this.estaDestruido) return;
    this.personajes.avanzar(segundos);
    this.animaciones.avanzar(segundos);
    this.animarEfectos(segundos);
    this.dibujante.render(this.escena, this.camara.camara);
  }

  async mostrarGuias(guias: readonly GuiaDeDepuracion[]): Promise<void> {
    this.numeroDeGuias++;
    const estePedido = this.numeroDeGuias;
    // El dibujo de las guías se importa hasta que hace falta: así el modo depuración no pesa en producción.
    const { crearGrupoDeGuias, liberarGrupoDeGuias } = await import('./guias-en-el-piso.ts');
    if (this.estaDestruido || estePedido !== this.numeroDeGuias) return;

    if (this.quitarGuiasActuales !== undefined) {
      this.quitarGuiasActuales();
      this.quitarGuiasActuales = undefined;
    }
    if (guias.length === 0) return;

    const grupo = crearGrupoDeGuias(guias, this.fabrica.crearLienzo);
    this.escena.add(grupo);
    this.quitarGuiasActuales = () => {
      this.escena.remove(grupo);
      liberarGrupoDeGuias(grupo);
    };
  }

  alTocar(funcion: (toque: Toque) => void): () => void {
    return this.toques.alTocar(funcion);
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;

    this.toques.destruir();
    this.observadorDeTamano.disconnect();

    this.quitarEscenografia();
    this.personajes.quitarTodos();
    this.animaciones.olvidarTodas();
    this.tocables.clear();
    for (const efecto of this.efectos) {
      this.escena.remove(efecto.puntos);
      efecto.liberar();
    }
    this.efectos = [];
    if (this.quitarGuiasActuales !== undefined) {
      this.quitarGuiasActuales();
      this.quitarGuiasActuales = undefined;
    }
    this.almacen.liberarTodas();

    this.dibujante.dispose();
    this.dibujante.domElement.remove();
  }

  /** Mueve cada efecto y quita los que ya terminaron. */
  private animarEfectos(segundos: number): void {
    const efectosQueSiguen: EfectoDeParticulas[] = [];
    for (const efecto of this.efectos) {
      const sigueVivo = efecto.actualizar(segundos);
      if (sigueVivo) {
        efectosQueSiguen.push(efecto);
      } else {
        this.escena.remove(efecto.puntos);
        efecto.liberar();
      }
    }
    this.efectos = efectosQueSiguen;
  }

  private quitarEscenografia(): void {
    for (const pieza of this.escenografia.children) {
      this.tocables.delete(pieza);
      this.animaciones.olvidar(pieza);
      liberarPieza(pieza);
    }
    this.escenografia.clear();
  }

  /** Hace que el lienzo ocupe todo el elemento del host, también cuando este cambia de tamaño. */
  private ajustarAlElemento(): void {
    const ancho = this.elemento.clientWidth;
    const alto = this.elemento.clientHeight;
    if (ancho === 0 || alto === 0) return;
    this.dibujante.setSize(ancho, alto);
    this.camara.cambiarProporcion(ancho / alto);
    // Cambiar el tamaño borra el lienzo. Se dibuja de una vez, por si el juego está en pausa
    // y el siguiente cuadro tarda en llegar.
    this.dibujante.render(this.escena, this.camara.camara);
  }
}

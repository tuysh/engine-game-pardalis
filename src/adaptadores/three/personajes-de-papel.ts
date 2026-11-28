// Los personajes de papel que están en el escenario: cada uno es un grupo con su hoja y su sombra.
// Aquí se ponen, se quitan, se mueven, se voltean y cambian de dibujo.
//
// Un personaje se voltea como se voltea un papel: su hoja gira hasta quedar de canto y sigue hasta
// mostrar el otro lado («giro de papel», docs/DISENO-3.0.md §7.2).
// Y mientras camina da pasitos: su hoja sube y baja un poco y se mece, como una figura de papel
// que alguien lleva de la mano. Así no parece que se desliza.

import { Group } from 'three';
import type { Mesh, Object3D, Scene } from 'three';
import type { Punto } from '../../dominio/geometria.ts';
import type { Mira } from '../../dominio/mundo.ts';
import type { ImagenDeEscena, PersonajeDeEscena, Toque } from '../../puertos/escenario.ts';
import type { AlmacenDeTexturas } from './almacen-de-texturas.ts';
import type { AnimacionesDeHojas } from './animaciones-de-hojas.ts';
import { crearHojaParada, crearSombra, liberarPieza } from './piezas-de-papel.ts';

/** Lo que tarda un personaje en voltearse por completo. */
const DURACION_DEL_GIRO_DE_PAPEL_EN_SEGUNDOS = 0.18;

/** Cuántos pasitos da por segundo un personaje que camina. */
const PASITOS_POR_SEGUNDO = 2.6;
/** Cuánto se levanta del piso la hoja en lo más alto de un pasito. */
const ALTURA_DE_UN_PASITO_EN_METROS = 0.05;
/** Cuánto se inclina la hoja hacia cada lado al caminar, en radianes (unos 2 grados). */
const INCLINACION_AL_CAMINAR_EN_RADIANES = 0.035;
/** Qué tan pronto la hoja vuelve a quedar derecha y en el piso al detenerse. Más grande = más pronto. */
const RAPIDEZ_PARA_ASENTARSE = 14;
/** Un cambio de lugar más chico que esto no cuenta como caminar. */
const MOVIMIENTO_MINIMO_EN_METROS = 0.0005;

/** El ancho de la hoja como se ve de frente: 1 = mirando a la derecha, -1 = volteada como un espejo. */
const ANCHO_MIRANDO_A_LA_DERECHA = 1;
const ANCHO_MIRANDO_A_LA_IZQUIERDA = -1;

interface PersonajeDePapel {
  readonly grupo: Group;
  hoja: Mesh;
  altoEnMetros: number;
  /** A dónde quiere llegar el ancho de la hoja: 1 o -1. La hoja lo alcanza poco a poco. */
  anchoDeseado: number;
  readonly sePuedeTocar: boolean;
  /** Cuenta los cambios de dibujo pedidos: si dos se cruzan mientras cargan, gana el último que se pidió. */
  cambiosDeDibujoPedidos: number;
  /** `true` si cambió de lugar desde el cuadro anterior: entonces está caminando. */
  seMovioEnEsteCuadro: boolean;
  /** Por dónde va de su pasito, en radianes: cada media vuelta (π) es un pasito completo. */
  avanceDelPasito: number;
}

/** Lo que los personajes necesitan del escenario que los contiene. */
export interface PiezasDeLosPersonajes {
  readonly escena: Scene;
  readonly almacen: AlmacenDeTexturas;
  readonly animaciones: AnimacionesDeHojas;
  /** Los objetos que responden al toque: aquí se anota la hoja de cada personaje que se puede tocar. */
  readonly tocables: Map<Object3D, Toque>;
}

export class PersonajesDePapel {
  private readonly piezas: PiezasDeLosPersonajes;
  private readonly personajes = new Map<string, PersonajeDePapel>();
  /** Cambia cada vez que se quitan todos: un personaje que terminó de cargar para el lugar anterior no se agrega. */
  private numeroDeLugar = 0;

  constructor(piezas: PiezasDeLosPersonajes) {
    this.piezas = piezas;
  }

  /** Pone un personaje en el escenario. Termina cuando su imagen ya cargó. Si ya estaba, lo reemplaza. */
  async agregar(personaje: PersonajeDeEscena): Promise<void> {
    const lugarAlPedirlo = this.numeroDeLugar;
    const texturas = await this.piezas.almacen.cargar(personaje.imagen);
    if (lugarAlPedirlo !== this.numeroDeLugar) return;
    this.quitar(personaje.id);

    const grupo = new Group();
    grupo.add(crearSombra(personaje.imagen.anchoEnMetros));
    const hoja = crearHojaParada(texturas[0]!, personaje.imagen); // una imagen tiene al menos un cuadro
    grupo.add(hoja);
    grupo.position.set(personaje.posicion.x, 0, personaje.posicion.y);

    const anchoDeseado = anchoSegunLaMira(personaje.mira);
    // Al aparecer ya está mirando hacia su lado, sin giro.
    hoja.scale.x = anchoDeseado;
    this.personajes.set(personaje.id, {
      grupo,
      hoja,
      altoEnMetros: personaje.imagen.altoEnMetros,
      anchoDeseado,
      sePuedeTocar: personaje.sePuedeTocar,
      cambiosDeDibujoPedidos: 0,
      seMovioEnEsteCuadro: false,
      avanceDelPasito: 0,
    });
    this.piezas.escena.add(grupo);
    this.registrarHoja(personaje.id, hoja, personaje.sePuedeTocar);
    // Un personaje cuyo dibujo es una animación la repite sin parar: así respira o parpadea.
    const ritmo = { cuadrosPorSegundo: personaje.imagen.cuadrosPorSegundo, repite: true };
    this.piezas.animaciones.animar(hoja, texturas, ritmo);
  }

  quitar(id: string): void {
    const personaje = this.personajes.get(id);
    if (personaje === undefined) return;
    this.personajes.delete(id);
    this.olvidarHoja(personaje.hoja);
    this.piezas.escena.remove(personaje.grupo);
    for (const pieza of personaje.grupo.children) {
      liberarPieza(pieza);
    }
  }

  quitarTodos(): void {
    this.numeroDeLugar++;
    for (const id of [...this.personajes.keys()]) {
      this.quitar(id);
    }
  }

  mover(id: string, posicion: Punto): void {
    const personaje = this.personajes.get(id);
    if (personaje === undefined) return;
    // En el plano del lugar, la profundidad `y` es la `z` del espacio 3D.
    const distancia = Math.hypot(posicion.x - personaje.grupo.position.x, posicion.y - personaje.grupo.position.z);
    if (distancia > MOVIMIENTO_MINIMO_EN_METROS) {
      personaje.seMovioEnEsteCuadro = true;
    }
    personaje.grupo.position.set(posicion.x, 0, posicion.y);
  }

  /** Los dibujos de personajes miran a la derecha; para mirar a la izquierda, la hoja se voltea como un espejo. */
  voltear(id: string, mira: Mira): void {
    const personaje = this.personajes.get(id);
    if (personaje === undefined) return;
    personaje.anchoDeseado = anchoSegunLaMira(mira);
  }

  /**
   * Cambia el dibujo de un personaje. Termina cuando el dibujo nuevo ya se ve.
   * Con `repite` la animación vuelve a empezar al terminar; sin él, se queda en su último cuadro.
   */
  async ponerDibujo(id: string, imagen: ImagenDeEscena, opciones: { readonly repite: boolean }): Promise<void> {
    const personajeAlPedirlo = this.personajes.get(id);
    if (personajeAlPedirlo === undefined) return;
    personajeAlPedirlo.cambiosDeDibujoPedidos++;
    const cambioPedido = personajeAlPedirlo.cambiosDeDibujoPedidos;

    const texturas = await this.piezas.almacen.cargar(imagen);
    const personaje = this.personajes.get(id);
    // Mientras cargaba, el personaje pudo salir del escenario o recibir otro cambio de dibujo más nuevo.
    if (personaje === undefined || personaje !== personajeAlPedirlo) return;
    if (personaje.cambiosDeDibujoPedidos !== cambioPedido) return;

    // El dibujo nuevo puede medir distinto, así que se cambia la hoja completa y no solo su textura.
    const hojaNueva = crearHojaParada(texturas[0]!, imagen); // una imagen tiene al menos un cuadro
    hojaNueva.scale.x = personaje.hoja.scale.x;
    hojaNueva.position.y = personaje.hoja.position.y;
    hojaNueva.rotation.z = personaje.hoja.rotation.z;
    this.olvidarHoja(personaje.hoja);
    personaje.grupo.remove(personaje.hoja);
    liberarPieza(personaje.hoja);

    personaje.hoja = hojaNueva;
    personaje.altoEnMetros = imagen.altoEnMetros;
    personaje.grupo.add(hojaNueva);
    this.registrarHoja(id, hojaNueva, personaje.sePuedeTocar);
    const ritmo = { cuadrosPorSegundo: imagen.cuadrosPorSegundo, repite: opciones.repite };
    this.piezas.animaciones.animar(hojaNueva, texturas, ritmo);
  }

  /** La hoja (el dibujo) de un personaje, o `undefined` si no está en el escenario. */
  buscarHoja(id: string): Mesh | undefined {
    return this.personajes.get(id)?.hoja;
  }

  /** Dónde pisa un personaje y cuánto mide de alto, para saber dónde queda su cabeza. */
  buscarLugarYAltura(id: string): { readonly dondePisa: Punto; readonly altoEnMetros: number } | undefined {
    const personaje = this.personajes.get(id);
    if (personaje === undefined) return undefined;
    const posicion = personaje.grupo.position;
    return { dondePisa: { x: posicion.x, y: posicion.z }, altoEnMetros: personaje.altoEnMetros };
  }

  /**
   * Avanza lo que se anima solo: el giro de papel de quien se esté volteando y los pasitos de quien camina.
   * `segundos` es el tiempo desde el cuadro anterior.
   */
  avanzar(segundos: number): void {
    for (const personaje of this.personajes.values()) {
      avanzarElGiroDePapel(personaje, segundos);
      avanzarLosPasitos(personaje, segundos);
    }
  }

  private registrarHoja(id: string, hoja: Mesh, sePuedeTocar: boolean): void {
    if (sePuedeTocar) {
      this.piezas.tocables.set(hoja, { tipo: 'personaje', id });
    }
  }

  private olvidarHoja(hoja: Mesh): void {
    this.piezas.tocables.delete(hoja);
    this.piezas.animaciones.olvidar(hoja);
  }
}

/** Acerca el ancho de la hoja al que debe tener: pasa por cero (de canto) y sigue hasta mostrar el otro lado. */
function avanzarElGiroDePapel(personaje: PersonajeDePapel, segundos: number): void {
  const loQueFalta = personaje.anchoDeseado - personaje.hoja.scale.x;
  if (loQueFalta === 0) return;

  const anchoDeUnGiroCompleto = ANCHO_MIRANDO_A_LA_DERECHA - ANCHO_MIRANDO_A_LA_IZQUIERDA;
  const cambioMaximo = (anchoDeUnGiroCompleto * segundos) / DURACION_DEL_GIRO_DE_PAPEL_EN_SEGUNDOS;
  personaje.hoja.scale.x += Math.sign(loQueFalta) * Math.min(Math.abs(loQueFalta), cambioMaximo);
}

/** Mientras el personaje camina, su hoja sube, baja y se mece; al detenerse, vuelve a quedar derecha en el piso. */
function avanzarLosPasitos(personaje: PersonajeDePapel, segundos: number): void {
  let alturaDeseada = 0;
  let inclinacionDeseada = 0;
  if (personaje.seMovioEnEsteCuadro) {
    personaje.avanceDelPasito += Math.PI * PASITOS_POR_SEGUNDO * segundos;
    // El valor absoluto del seno da un rebote: sube, baja al piso y vuelve a subir en cada pasito.
    alturaDeseada = Math.abs(Math.sin(personaje.avanceDelPasito)) * ALTURA_DE_UN_PASITO_EN_METROS;
    inclinacionDeseada = Math.sin(personaje.avanceDelPasito) * INCLINACION_AL_CAMINAR_EN_RADIANES;
  } else {
    personaje.avanceDelPasito = 0;
  }
  personaje.seMovioEnEsteCuadro = false;

  // La hoja se acerca a su altura e inclinación poco a poco, para que no dé un brinco al arrancar ni al parar.
  const parteDelCamino = Math.min(1, RAPIDEZ_PARA_ASENTARSE * segundos);
  const hoja = personaje.hoja;
  hoja.position.y += (alturaDeseada - hoja.position.y) * parteDelCamino;
  hoja.rotation.z += (inclinacionDeseada - hoja.rotation.z) * parteDelCamino;
}

function anchoSegunLaMira(mira: Mira): number {
  if (mira === 'derecha') return ANCHO_MIRANDO_A_LA_DERECHA;
  return ANCHO_MIRANDO_A_LA_IZQUIERDA;
}

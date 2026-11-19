// Arma un nivel: lo monta en el escenario y crea todas sus piezas (estado, cámara, escenas, control del jugador,
// señales), ya conectadas entre sí. Ponerlo en marcha es cosa de jugar-nivel.ts.

import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Nivel } from '../dominio/nivel.ts';
import { crearTerreno } from '../dominio/terreno.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import { CamaraDeEscena } from './camara-de-escena.ts';
import { Cercania } from './cercania.ts';
import { ComentariosDeZona } from './comentarios-de-zona.ts';
import { decirLinea } from './decir-linea.ts';
import { buscarDireccionDeAsset } from './direccion-de-asset.ts';
import { EscenasDelNivel } from './escenas-del-nivel.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { Exploracion } from './exploracion.ts';
import { FlechaDeSalida } from './flecha-de-salida.ts';
import { FundidoDePantalla } from './fundido-de-pantalla.ts';
import { montarNivel } from './montar-nivel.ts';
import type { AvisosDelNivel, PedidoDeJuego, PuertosParaJugar } from './nivel-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { crearImagenDeEscena } from './preparar-escena.ts';
import type { Reparto } from './reparto.ts';
import { SalidaDelNivel } from './salida-del-nivel.ts';

/** Un nivel con todas sus piezas ya creadas y conectadas entre sí, listo para ponerse en marcha. */
export interface NivelArmado {
  readonly nivel: Nivel;
  readonly reparto: Reparto;
  readonly estado: EstadoEnJuego;
  /** El centro del mapa: a donde mira la cámara en un nivel sin jugador. */
  readonly centroDelLugar: Punto;
  /** El control libre del jugador. `undefined` en un nivel sin jugador. */
  readonly exploracion: Exploracion | undefined;
  readonly camara: CamaraDeEscena;
  /** Los diálogos y las cinemáticas. */
  readonly escenas: EscenasDelNivel;
  readonly comentarios: ComentariosDeZona;
  readonly salida: SalidaDelNivel;
  readonly flecha: FlechaDeSalida;
  readonly cercania: Cercania;
}

/** Lo que casi todas las piezas de un nivel necesitan para crearse. */
interface BaseDelNivel {
  readonly pedido: PedidoDeJuego;
  readonly puertos: PuertosParaJugar;
  readonly avisos: AvisosDelNivel;
  readonly reparto: Reparto;
  readonly estado: EstadoEnJuego;
  readonly centroDelLugar: Punto;
}

/** La promesa termina cuando el nivel ya se ve en el escenario y todas sus piezas existen. */
export async function armarNivel(
  pedido: PedidoDeJuego,
  puertos: PuertosParaJugar,
  avisos: AvisosDelNivel,
): Promise<NivelArmado> {
  const { nivel } = pedido;
  const { escenario, interfaz } = puertos;
  const reparto = await montarNivel(pedido, escenario);

  const estadoInicial = crearEstadoDeNivel(nivel.contenido.estado, pedido.variablesGuardadas);
  const estado = new EstadoEnJuego(estadoInicial, (objetivo) => avisos.alCumplirObjetivo(objetivo));
  const centroDelLugar = { x: nivel.mundo.anchoEnMetros / 2, y: nivel.mundo.profundidadEnMetros / 2 };
  const base: BaseDelNivel = { pedido, puertos, avisos, reparto, estado, centroDelLugar };

  const escena = crearPiezasDeEscena(base);
  const exploracion = crearExploracion(nivel, reparto);
  const comentarios = crearComentarios(base, escena);
  const camara = crearCamara(base);
  const escenas = crearEscenas(base, { escena, camara, comentarios, exploracion });

  return {
    nivel,
    reparto,
    estado,
    centroDelLugar,
    exploracion,
    camara,
    escenas,
    comentarios,
    salida: new SalidaDelNivel({
      nivel,
      estado,
      conversacion: escenas.conversacion,
      alSalir: (destino) => avisos.alSalir(destino),
    }),
    flecha: new FlechaDeSalida({ nivel, estado, escenario, interfaz }),
    cercania: new Cercania({ nivel, reparto, escenario, interfaz }),
  };
}

/** Lo que comparten las acciones que hacen que un paso se vea y se oiga. */
function crearPiezasDeEscena(base: BaseDelNivel): PiezasDeEscena {
  const { pedido, puertos, avisos } = base;
  const nivel = pedido.nivel;
  return {
    contenido: nivel.contenido,
    puntos: nivel.mundo.puntos,
    centroDelLugar: base.centroDelLugar,
    idiomaBase: pedido.idiomaBase,
    escenario: puertos.escenario,
    interfaz: puertos.interfaz,
    audio: puertos.audio,
    reloj: puertos.reloj,
    reparto: base.reparto,
    estado: base.estado,
    minijuegos: pedido.minijuegos,
    direccionDeAsset: (clave) => buscarDireccionDeAsset(clave, nivel.assets, pedido.ubicacion),
    alVerPalabra: (palabra) => avisos.alVerPalabra(palabra),
  };
}

/** El control libre del jugador, o `undefined` si el nivel no tiene jugador. */
function crearExploracion(nivel: Nivel, reparto: Reparto): Exploracion | undefined {
  const jugador = nivel.contenido.jugador;
  if (jugador === undefined) return undefined;

  return new Exploracion({
    reparto,
    terreno: crearTerreno(nivel.mundo),
    idDelJugador: jugador.personaje,
    velocidadEnMetrosPorSegundo: jugador.velocidadEnMetrosPorSegundo,
  });
}

/** Los comentarios que el jugador dice al entrar a una zona: se dicen como una línea que no detiene el juego. */
function crearComentarios(base: BaseDelNivel, escena: PiezasDeEscena): ComentariosDeZona {
  const nivel = base.pedido.nivel;
  return new ComentariosDeZona({
    contenido: nivel.contenido,
    zonas: nivel.mundo.zonas,
    azar: base.puertos.azar,
    decirComentario(linea, senal) {
      const textoCompleto = completarTexto(linea.texto, base.estado.actual);
      return decirLinea({ paso: linea, textoCompleto, seCierraConUnToque: false }, senal, escena);
    },
    alFallar: (error) => base.avisos.alFallar(error),
  });
}

/** Las piezas del nivel que las escenas necesitan además de la base. */
interface PiezasParaLasEscenas {
  readonly escena: PiezasDeEscena;
  readonly camara: CamaraDeEscena;
  readonly comentarios: ComentariosDeZona;
  readonly exploracion: Exploracion | undefined;
}

/** Los diálogos y las cinemáticas del nivel. */
function crearEscenas(base: BaseDelNivel, piezas: PiezasParaLasEscenas): EscenasDelNivel {
  const { pedido, puertos } = base;
  const nivel = pedido.nivel;
  return new EscenasDelNivel({
    escena: piezas.escena,
    nivel,
    camara: piezas.camara,
    fundido: pedido.fundido ?? new FundidoDePantalla(puertos.interfaz, puertos.reloj),
    video: puertos.video,
    imagenDeAsset: (clave) => crearImagenDeEscena(clave, nivel, pedido.ubicacion),
    cinematicasEnCodigo: pedido.cinematicasEnCodigo ?? {},
    avisos: base.avisos,
    alEmpezarUnaEscena: () => {
      // Un comentario nunca se encima con una escena: al empezar una, el comentario se calla.
      piezas.comentarios.callar();
      // Y el jugador no sigue caminando hacia el lugar que había tocado.
      if (piezas.exploracion !== undefined) {
        piezas.exploracion.detener();
      }
    },
  });
}

function crearCamara(base: BaseDelNivel): CamaraDeEscena {
  const nivel = base.pedido.nivel;
  return new CamaraDeEscena({
    escenario: base.puertos.escenario,
    reparto: base.reparto,
    contenido: nivel.contenido,
    puntos: nivel.mundo.puntos,
    decorado: nivel.mundo.decorado,
    centroDelLugar: base.centroDelLugar,
    conMenosMovimiento: base.pedido.conMenosMovimiento ?? false,
  });
}

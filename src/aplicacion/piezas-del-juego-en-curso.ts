// Lo que el juego completo (juego-en-curso.ts) necesita para funcionar, y cómo le avisa de lo que pasa
// a quien lo creó. En el navegador, `crear.ts` entrega estas piezas y convierte cada aviso en un evento
// de los que el host escucha con `juego.on(...)`.

import type { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import type { VariablesDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { Partida } from '../dominio/partida.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import type { ProgresoDeCarga } from '../dominio/progreso-de-carga.ts';
import type { Cargador } from '../puertos/cargador.ts';
import type { CinematicaEnCodigo } from '../puertos/cinematica-en-codigo.ts';
import type { Minijuego } from '../puertos/minijuego.ts';
import type { FuenteDeNiveles } from './leer-nivel-por-jugar.ts';
import type { HerramientasDeDepuracion, PuertosParaJugar } from './nivel-en-juego.ts';

/** Un cambio en las variables del nivel que se juega. */
export interface CambioDeEstadoDelNivel {
  /** Id del nivel al que pertenece el estado. */
  readonly nivel: string;
  /** Solo las variables que cambiaron, con su valor nuevo. */
  readonly cambios: VariablesDeEstado;
  /** Todas las variables del nivel, ya con el cambio. */
  readonly variables: VariablesDeEstado;
}

/** Cómo el juego le avisa de lo que pasa a quien lo creó. */
export interface AvisosDelJuego {
  /** Conviene guardar: aquí va la partida de este momento. */
  alGuardar(partida: Partida): void;
  alCumplirObjetivo(objetivo: string): void;
  alVerPalabra(palabra: PalabraDeVocabulario): void;
  /** Ya se puede jugar otro nivel. `anterior` es el id del que se dejó. */
  alCambiarDeNivel(id: string, anterior: string): void;
  alEmpezarCinematica(id: string): void;
  alTerminarCinematica(id: string): void;
  /** Cambió alguna variable del nivel que se juega. */
  alCambiarElEstado(cambio: CambioDeEstadoDelNivel): void;
  alEmpezarMinijuego(nombre: string): void;
  alTerminarMinijuego(nombre: string): void;
  /** El nivel terminó hacia un destino que no es un nivel registrado: el host decide. */
  alSalir(destino: string): void;
  /** Algo falló después de arrancar: un diálogo, una cinemática o la carga del nivel siguiente. */
  alFallar(error: ErrorDeEscenario): void;
}

export interface PiezasDelJuegoEnCurso {
  readonly fuente: FuenteDeNiveles;
  /** Carpeta o CDN donde están los assets. `undefined` = junto a cada `nivel.json`. */
  readonly raizDeAssets?: string;
  readonly cargador: Cargador;
  /** El idioma del sitio. */
  readonly idiomaBase: Idioma;
  readonly minijuegos: Readonly<Record<string, Minijuego>>;
  readonly cinematicasEnCodigo: Readonly<Record<string, CinematicaEnCodigo>>;
  /** `true` si el sistema pide menos movimiento. */
  readonly conMenosMovimiento: boolean;
  /** Si existe, se le avisa del avance mientras cargan las imágenes de cada nivel. */
  readonly alCargar?: (progreso: ProgresoDeCarga) => void;
  /** Lo que hace falta para el modo depuración. `undefined` = se juega sin depuración. */
  readonly depuracion?: HerramientasDeDepuracion;
  readonly puertos: PuertosParaJugar;
  readonly avisos: AvisosDelJuego;
  /** La partida con la que empieza el juego, ya revisada. `undefined` = partida nueva. */
  readonly partidaInicial: Partida | undefined;
}

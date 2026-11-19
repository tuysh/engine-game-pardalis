// Entrada pública `@pardalis/escenario-engine` (navegador).
// Es el único archivo del proyecto que solo reexporta: todo lo que un host puede importar está aquí.
// Importar este archivo no toca `window` ni `document`; solo `crearEscenario()` necesita navegador.

export { crearEscenario } from './crear.ts';
export { ErrorDeEscenario } from './dominio/error-de-escenario.ts';

export type { OpcionesDeEscenario } from './opciones-de-escenario.ts';
export type { ProgresoDeCarga } from './dominio/progreso-de-carga.ts';
export type {
  AvisoDeCinematica,
  CambioDeNivel,
  EventosDeJuego,
  Juego,
  NombreDeEvento,
  PalabraMostrada,
} from './juego.ts';

export type { LectorDeEstado, ValorDeEstado, VariablesDeEstado } from './dominio/estado.ts';
export type { Idioma } from './dominio/idioma.ts';
export type { Partida, PartidaDeNivel } from './dominio/partida.ts';

export type {
  AssetsParaMinijuego,
  AudioParaMinijuego,
  ContextoDeMinijuego,
  Minijuego,
  ResultadoDeMinijuego,
} from './puertos/minijuego.ts';
export type {
  CinematicaEnCodigo,
  EscenaDeCinematica,
  EstadoParaCinematica,
  OpcionesDeAnimacion,
  OpcionesDeDuracion,
  OpcionesDeLinea,
} from './puertos/cinematica-en-codigo.ts';

// Qué tan fuerte suena cada cosa del juego (docs/DISENO-3.0.md §4, «El objeto `juego`»). El host lo ajusta,
// por ejemplo con un botón grande de bocina para el salón de clases o para una casa donde alguien duerme.
//
// Hay un volumen general y uno por canal: la música de fondo, las voces y los efectos (sonidos y tonos).
// Lo que se oye de un canal es su volumen por el general; silenciado, no se oye nada, pero los volúmenes
// se conservan para cuando se quite el silencio.

/** Los canales de sonido del juego. */
export type CanalDeAudio = 'musica' | 'voces' | 'efectos';

/** Los volúmenes de cada canal. Cada uno va de 0 (callado) a 1 (completo). */
export interface VolumenesPorCanal {
  readonly musica: number;
  readonly voces: number;
  readonly efectos: number;
}

/** Todo lo que decide qué tan fuerte suena el juego. */
export interface VolumenesDeAudio extends VolumenesPorCanal {
  /** Multiplica a los tres canales. De 0 a 1. */
  readonly general: number;
  /** `true` = no se oye nada, sin olvidar los volúmenes. */
  readonly silenciado: boolean;
}

/** Así empieza el juego: todo a volumen completo y sin silenciar. */
export const VOLUMENES_POR_DEFECTO: VolumenesDeAudio = {
  general: 1,
  musica: 1,
  voces: 1,
  efectos: 1,
  silenciado: false,
};

/** El volumen más bajo y el más alto que se aceptan. */
export const VOLUMEN_MINIMO = 0;
export const VOLUMEN_MAXIMO = 1;

/** Lo que de verdad se oye de un canal, de 0 a 1: su volumen por el general, o 0 si está silenciado. */
export function volumenDelCanal(volumenes: VolumenesDeAudio, canal: CanalDeAudio): number {
  if (volumenes.silenciado) return 0;
  return volumenes.general * volumenes[canal];
}

/** `true` si `valor` es un número de 0 a 1, el único que sirve como volumen. */
export function esVolumenValido(valor: unknown): valor is number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return false;
  return valor >= VOLUMEN_MINIMO && valor <= VOLUMEN_MAXIMO;
}

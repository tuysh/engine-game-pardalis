// Qué hace una tecla mientras están a la vista las tarjetas de un paso `elige`.
//
// Hasta que salen las tarjetas, la niña o el niño que juega con teclado sigue cada línea con `Enter` o la
// barra espaciadora. Si al salir las tarjetas esas mismas teclas no hicieran nada, el juego parecería
// atorado justo cuando le preguntan algo. Por eso, con el foco en ningún lado, `Enter` o la barra llevan el
// foco a la primera tarjeta (se ve su marco) y la segunda vez la eligen, porque la tarjeta es un botón.
//
// No eligen a la primera: quien venía oprimiendo `Enter` para seguir el diálogo lo oprime de más sin querer,
// y elegir algo que no quiso (gastar su dinero en un antojo) sería un tropiezo. Tampoco eligen la tarjeta
// resaltada: el resalte solo marca de cuál se está hablando en voz alta, no lo que escogió.
//
// Por lo mismo, `Enter` o la barra no hacen nada durante medio segundo después de que salen las tarjetas y
// después de que una de esas teclas enfocó una: quien las oprime una y otra vez, deprisa, para seguir el
// diálogo, no llega a escoger la primera tarjeta con dos oprimidas seguidas. Es el mismo medio segundo que
// una línea debe llevar a la vista para que un toque la cierre.
//
// `Tab` con el foco en ningún lado también va directo a las tarjetas (la primera; con mayúsculas, la última),
// en vez de pasar antes por los botones del host que están antes en la página.
//
// Es una función sin página para poder probarla: quien la llama le dice si el foco está en un control.

/** Lo que se sabe de la tecla y de la página cuando se oprime. */
export interface TeclaConTarjetas {
  /** `KeyboardEvent.key`. */
  readonly tecla: string;
  /** `true` si llegó porque la tecla se quedó oprimida (`KeyboardEvent.repeat`). */
  readonly repetida: boolean;
  /** `true` si también estaba oprimida la tecla de mayúsculas. */
  readonly conMayusculas: boolean;
  /** Cuántas tarjetas hay a la vista; más de 0. */
  readonly cantidad: number;
  /** `true` si la tecla se oprimió en un control (ver `esTeclaDeUnControl`): entonces es de ese control. */
  readonly esDeUnControl: boolean;
  /** `true` si la tecla se oprimió en un campo de texto (ver `esTeclaDeUnCampo`). */
  readonly esDeUnCampo: boolean;
  /** `true` si ningún elemento tiene el foco (lo tiene el cuerpo de la página). */
  readonly nadaTieneElFoco: boolean;
  /**
   * Cuánto hace que salieron las tarjetas o que `Enter` o la barra enfocaron una, lo que pasó al último.
   * Antes de `MILISEGUNDOS_SIN_ENTER_EN_LAS_TARJETAS`, esas teclas no hacen nada.
   */
  readonly milisegundosDesdeElUltimoCambio: number;
}

/** Cuánto descansan `Enter` y la barra después de que salen las tarjetas o de que enfocaron una. */
export const MILISEGUNDOS_SIN_ENTER_EN_LAS_TARJETAS = 500;

/**
 * - `dejar`: la tecla no es para las tarjetas; no se cancela.
 * - `ignorar`: se cancela y no hace nada (una tecla que se quedó oprimida o que llegó muy pronto;
 *   cancelarla evita que oprima la tarjeta enfocada).
 * - `elegir` / `enfocar`: se cancela y se elige o se enfoca la tarjeta de esa posición.
 */
export type QueHaceLaTecla =
  | { readonly tipo: 'dejar' }
  | { readonly tipo: 'ignorar' }
  | { readonly tipo: 'elegir'; readonly posicion: number }
  | { readonly tipo: 'enfocar'; readonly posicion: number };

const DEJAR: QueHaceLaTecla = { tipo: 'dejar' };

export function queHaceLaTeclaConTarjetas(entrada: TeclaConTarjetas): QueHaceLaTecla {
  const numero = Number(entrada.tecla);
  const esElNumeroDeUnaTarjeta = Number.isInteger(numero) && numero >= 1 && numero <= entrada.cantidad;
  if (esElNumeroDeUnaTarjeta) return { tipo: 'elegir', posicion: numero - 1 };

  if (entrada.tecla === 'Enter' || entrada.tecla === ' ') {
    // En un campo de texto, la tecla escribe aunque se quede oprimida.
    if (entrada.esDeUnCampo) return DEJAR;
    // Quedarse oprimida no elige: la primera vez enfoca la primera tarjeta, y sin esto la repetición
    // siguiente ya la oprimiría (también una tarjeta enfocada con `Tab`).
    if (entrada.repetida) return { tipo: 'ignorar' };
    // Recién salidas las tarjetas, o recién enfocada una, es casi seguro una oprimida de más.
    if (entrada.milisegundosDesdeElUltimoCambio < MILISEGUNDOS_SIN_ENTER_EN_LAS_TARJETAS) return { tipo: 'ignorar' };
    // En un botón (una tarjeta, la bocina del host) la tecla oprime ese botón.
    if (entrada.esDeUnControl) return DEJAR;
    return { tipo: 'enfocar', posicion: 0 };
  }

  if (entrada.tecla === 'Tab') {
    // Desde un control, `Tab` sigue el orden de la página: así se sale de las tarjetas y se vuelve a ellas.
    if (!entrada.nadaTieneElFoco) return DEJAR;
    if (entrada.conMayusculas) return { tipo: 'enfocar', posicion: entrada.cantidad - 1 };
    return { tipo: 'enfocar', posicion: 0 };
  }

  return DEJAR;
}

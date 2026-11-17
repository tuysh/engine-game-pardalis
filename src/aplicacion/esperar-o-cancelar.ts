// Espera una acción larga, pero deja de esperar si se cancela.
//
// Toda acción debería terminar sola al cancelarse (AGENTS.md §4.8). Esta función es la red de seguridad
// para las que no lo hacen, como un minijuego del host que ignora la señal: sin ella, el diálogo
// quedaría trabado para siempre.

/** Cómo terminó la espera. */
export type Espera<Valor> =
  | { readonly tipo: 'termino'; readonly valor: Valor }
  | { readonly tipo: 'cancelada' };

/**
 * Termina con el valor de `promesa`, o con `cancelada` si `senal` se dispara antes.
 * Si `promesa` rechaza, esta también rechaza con el mismo error.
 */
export function esperarOCancelar<Valor>(promesa: Promise<Valor>, senal: AbortSignal): Promise<Espera<Valor>> {
  if (senal.aborted) {
    return Promise.resolve({ tipo: 'cancelada' });
  }

  return new Promise((terminar, rechazar) => {
    const alCancelar = (): void => {
      terminar({ tipo: 'cancelada' });
    };
    senal.addEventListener('abort', alCancelar, { once: true });

    const dejarDeEscucharLaSenal = (): void => {
      senal.removeEventListener('abort', alCancelar);
    };
    const alTerminar = (valor: Valor): void => {
      dejarDeEscucharLaSenal();
      terminar({ tipo: 'termino', valor });
    };
    const alFallar = (error: unknown): void => {
      dejarDeEscucharLaSenal();
      rechazar(error);
    };
    // Aquí se usa `.then()` y no `await` porque hay que reaccionar a lo que pase primero:
    // que la promesa termine o que llegue la cancelación.
    promesa.then(alTerminar, alFallar);
  });
}

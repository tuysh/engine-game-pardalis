// El puerto por el que pasa el tiempo del juego (AGENTS.md §4.8).
// La aplicación nunca llama a `setTimeout`: pide esperar aquí. Así las pruebas no esperan de verdad,
// el juego se puede pausar y las cinemáticas se pueden saltar.

export interface Reloj {
  /**
   * Promesa que termina cuando pasaron los segundos de juego pedidos.
   * Si `senal` se dispara antes, la promesa termina en ese momento: nunca rechaza ni queda colgada.
   * Quien llama revisa `senal.aborted` si necesita saber por qué terminó.
   */
  esperar(esperaEnSegundos: number, senal: AbortSignal): Promise<void>;

  /**
   * Llama a `funcion` en cada cuadro, con los segundos de juego que pasaron desde el cuadro anterior.
   * Devuelve una función que cancela las llamadas.
   */
  enCadaCuadro(funcion: (segundos: number) => void): () => void;
}

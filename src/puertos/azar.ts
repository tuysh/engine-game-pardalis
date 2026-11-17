// El puerto del azar: de dónde salen los números al azar del juego.
// En el navegador es `Math.random`; con la opción `semilla` del host, o en las pruebas, es una serie repetible
// (ver src/dominio/azar-con-semilla.ts).

/** Cada llamada entrega un número mayor o igual a 0 y menor que 1. */
export type Azar = () => number;

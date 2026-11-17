// Reúne las acciones que el ejecutor de pasos necesita (ver acciones-de-paso.ts),
// cada una con las piezas de la escena ya puestas.
//
// Estado:
// - `reproducirEfecto` todavía no dibuja partículas ni suena: solo hace una pausa del largo de un efecto.
// - `jugarMinijuego` todavía no abre el minijuego del host: responde que no hubo éxito, así que el diálogo
//   sigue por el camino amable `siNo`. Los minijuegos llegan en la fase 6 (docs/DISENO-3.0.md §13).

import type { AccionesDePaso } from './acciones-de-paso.ts';
import { caminarEnEscena } from './caminar-en-escena.ts';
import { decirLinea } from './decir-linea.ts';
import { elegirOpcion } from './elegir-opcion.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

const DURACION_DE_UN_EFECTO_EN_SEGUNDOS = 0.6;

export function crearAccionesDePaso(piezas: PiezasDeEscena): AccionesDePaso {
  return {
    decirLinea(linea, textoCompleto, senal) {
      return decirLinea(linea, textoCompleto, senal, piezas);
    },
    elegirOpcion(pregunta, opciones, senal) {
      return elegirOpcion(pregunta, opciones, senal, piezas);
    },
    reproducirEfecto(nombre, senal) {
      return piezas.reloj.esperar(DURACION_DE_UN_EFECTO_EN_SEGUNDOS, senal);
    },
    caminar(personaje, punto, senal) {
      return caminarEnEscena(personaje, punto, senal, piezas);
    },
    async jugarMinijuego() {
      return { exito: false };
    },
  };
}

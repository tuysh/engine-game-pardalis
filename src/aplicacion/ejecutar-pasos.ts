// El ejecutor de pasos: recorre una lista de pasos y hace que ocurran, uno tras otro.
// Decide el orden (condiciones, secuencias, qué sigue a un minijuego) y cambia el estado;
// lo que se ve y se oye lo delega en `AccionesDePaso`.
//
// Si la señal se dispara, el ejecutor termina sin ejecutar los pasos que faltaban.

import { cumpleCondicion } from '../dominio/condicion.ts';
import type { AlVolver, Contenido } from '../dominio/contenido.ts';
import type { Paso, PasoDeEleccion, PasoDeMinijuego, PasosOSecuencia } from '../dominio/paso.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import { esperarOCancelar } from './esperar-o-cancelar.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

/** Lo que acompaña a una ejecución de pasos de principio a fin. */
export interface EjecucionDePasos {
  readonly contenido: Contenido;
  readonly estado: EstadoEnJuego;
  readonly acciones: AccionesDePaso;
  /** Al dispararse, la ejecución termina. */
  readonly senal: AbortSignal;
  /** Qué hacer al volver de un minijuego. `undefined` = nada: se sigue con el paso siguiente. */
  readonly alVolver?: AlVolver;
}

export async function ejecutarPasos(pasos: readonly Paso[], ejecucion: EjecucionDePasos): Promise<void> {
  for (const paso of pasos) {
    if (ejecucion.senal.aborted) return;
    await ejecutarPaso(paso, ejecucion);
  }
}

/** Ejecuta los pasos escritos en un lugar, o la secuencia que ese lugar nombra. */
export async function ejecutarPasosOSecuencia(valor: PasosOSecuencia, ejecucion: EjecucionDePasos): Promise<void> {
  switch (valor.tipo) {
    case 'pasos':
      await ejecutarPasos(valor.pasos, ejecucion);
      break;
    case 'secuencia':
      await ejecutarSecuencia(valor.nombre, ejecucion);
      break;
  }
}

async function ejecutarPaso(paso: Paso, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, estado, senal } = ejecucion;

  switch (paso.tipo) {
    case 'linea': {
      const textoCompleto = completarTexto(paso.texto, estado.actual);
      await esperarOCancelar(acciones.decirLinea(paso, textoCompleto, senal), senal);
      break;
    }

    case 'elige':
      await ejecutarEleccion(paso, ejecucion);
      break;

    case 'efecto':
      await esperarOCancelar(acciones.reproducirEfecto(paso.nombre, senal), senal);
      break;

    case 'pon':
      estado.aplicar(paso.valores);
      break;

    case 'juego':
      await ejecutarMinijuego(paso, ejecucion);
      break;

    case 'camina': {
      // Sin `quien`, camina el jugador; la validación garantiza que entonces el nivel tiene jugador.
      const personaje = paso.personaje ?? ejecucion.contenido.jugador!.personaje;
      await esperarOCancelar(acciones.caminar(personaje, paso.punto, senal), senal);
      break;
    }

    case 'secuencia':
      await ejecutarSecuencia(paso.nombre, ejecucion);
      break;

    case 'condicional':
      if (cumpleCondicion(paso.condicion, estado.actual)) {
        await ejecutarPasos(paso.pasos, ejecucion);
      }
      break;
  }
}

async function ejecutarSecuencia(nombre: string, ejecucion: EjecucionDePasos): Promise<void> {
  const pasos = ejecucion.contenido.secuencias[nombre]!; // la validación garantiza que la secuencia existe
  await ejecutarPasos(pasos, ejecucion);
}

async function ejecutarEleccion(paso: PasoDeEleccion, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, estado, senal } = ejecucion;

  const opcionesVisibles = paso.opciones.filter((opcion) => {
    return opcion.condicion === undefined || cumpleCondicion(opcion.condicion, estado.actual);
  });
  // Sin opciones que mostrar no hay nada que elegir: el paso se salta (la validación lo advierte).
  if (opcionesVisibles.length === 0) return;

  const pregunta = completarTexto(paso.pregunta, estado.actual);
  const espera = await esperarOCancelar(acciones.elegirOpcion(pregunta, opcionesVisibles, senal), senal);
  if (espera.tipo === 'cancelada') return;

  const opcionElegida = opcionesVisibles[espera.valor];
  if (opcionElegida === undefined) {
    throw new Error(`[escenario-engine] se eligió la opción ${espera.valor}, pero solo había ${opcionesVisibles.length}`);
  }
  await ejecutarPasosOSecuencia(opcionElegida.alElegir, ejecucion);
}

async function ejecutarMinijuego(paso: PasoDeMinijuego, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, estado, senal } = ejecucion;

  const espera = await esperarOCancelar(acciones.jugarMinijuego(paso.nombre, paso.config, senal), senal);
  if (espera.tipo === 'cancelada') return;
  const resultado = espera.valor;

  if (resultado.otorgar !== undefined) {
    estado.aplicar(resultado.otorgar);
  }
  if (ejecucion.alVolver === undefined) return;

  const loQueSigue = resultado.exito ? ejecucion.alVolver.siLogrado : ejecucion.alVolver.siNo;
  // Se quita `alVolver` para que un minijuego abierto desde estos pasos no vuelva a dispararlo.
  await ejecutarPasosOSecuencia(loQueSigue, { ...ejecucion, alVolver: undefined });
}

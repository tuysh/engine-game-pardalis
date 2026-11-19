// El ejecutor de pasos: recorre una lista de pasos y hace que ocurran, uno tras otro.
// Aquí está lo que decide el ORDEN (condiciones, secuencias, pasos a la vez, qué sigue a un minijuego)
// y lo que cambia el estado. Los pasos que se ven y se oyen están en ejecutar-paso-de-escena.ts.
//
// A qué ritmo va una ejecución (normal, rápido o terminada) se explica en ejecucion-de-pasos.ts.

import { cumpleCondicion } from '../dominio/condicion.ts';
import type { Paso, PasoDeEleccion, PasoDeJuntos, PasoDeMinijuego, PasosOSecuencia } from '../dominio/paso.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import { estaEnModoRapido, yaTermino } from './ejecucion-de-pasos.ts';
import type { EjecucionDePasos } from './ejecucion-de-pasos.ts';
import { ejecutarPasoDeEscena } from './ejecutar-paso-de-escena.ts';
import { esperarOCancelar } from './esperar-o-cancelar.ts';

export async function ejecutarPasos(pasos: readonly Paso[], ejecucion: EjecucionDePasos): Promise<void> {
  for (const paso of pasos) {
    if (yaTermino(ejecucion)) return;
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
  switch (paso.tipo) {
    case 'pon':
      ejecucion.estado.aplicar(paso.valores);
      break;

    case 'secuencia':
      await ejecutarSecuencia(paso.nombre, ejecucion);
      break;

    case 'condicional':
      if (cumpleCondicion(paso.condicion, ejecucion.estado.actual)) {
        await ejecutarPasos(paso.pasos, ejecucion);
      }
      break;

    case 'juntos':
      await ejecutarJuntos(paso, ejecucion);
      break;

    case 'elige':
      await ejecutarEleccion(paso, ejecucion);
      break;

    case 'juego':
      await ejecutarMinijuego(paso, ejecucion);
      break;

    case 'linea':
    case 'efecto':
    case 'camina':
    case 'espera':
    case 'camara':
    case 'mira':
    case 'anima':
    case 'aparece':
    case 'desaparece':
    case 'musica':
    case 'sonido':
    case 'fundido':
    case 'video':
    case 'sale':
      await ejecutarPasoDeEscena(paso, ejecucion);
      break;
  }
}

async function ejecutarSecuencia(nombre: string, ejecucion: EjecucionDePasos): Promise<void> {
  const pasos = ejecucion.contenido.secuencias[nombre]!; // la validación garantiza que la secuencia existe
  await ejecutarPasos(pasos, ejecucion);
}

/** Empieza todos los pasos a la vez y termina cuando el último de ellos terminó. */
async function ejecutarJuntos(paso: PasoDeJuntos, ejecucion: EjecucionDePasos): Promise<void> {
  const pasosEnCurso: Promise<void>[] = [];
  for (const pasoInterno of paso.pasos) {
    pasosEnCurso.push(ejecutarPaso(pasoInterno, ejecucion));
  }
  await Promise.all(pasosEnCurso);
}

async function ejecutarEleccion(paso: PasoDeEleccion, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, estado, senal } = ejecucion;
  // Elegir necesita al jugador: en una escena que se salta no se pregunta nada.
  if (estaEnModoRapido(ejecucion)) return;

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
    throw new Error(
      `[escenario-engine] se eligió la opción ${espera.valor}, pero solo había ${opcionesVisibles.length}`,
    );
  }
  await ejecutarPasosOSecuencia(opcionElegida.alElegir, ejecucion);
}

async function ejecutarMinijuego(paso: PasoDeMinijuego, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, estado, senal } = ejecucion;
  // Un minijuego necesita al jugador: en una escena que se salta no se abre.
  if (estaEnModoRapido(ejecucion)) return;

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

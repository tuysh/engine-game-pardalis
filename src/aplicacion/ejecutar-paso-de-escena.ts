// Ejecuta los pasos que se ven y se oyen: hablar, caminar, mover la cámara, animar, fundir a negro…
// El orden entre pasos lo decide ejecutar-pasos.ts; aquí cada paso solo ocurre.
//
// Cuando la escena se salta (modo rápido, ver ejecucion-de-pasos.ts) hay tres clases de pasos:
//   - los que solo se ven o se oyen (una línea, un efecto, una espera, un sonido, un video) se omiten;
//   - los que tardan y dejan algo cambiado (caminar, mover la cámara, fundir) dejan su resultado final;
//   - los que ocurren de una vez (voltear, aparecer, cambiar la música) ocurren igual.

import type { Paso } from '../dominio/paso.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import { estaEnModoRapido } from './ejecucion-de-pasos.ts';
import type { EjecucionDePasos } from './ejecucion-de-pasos.ts';
import { esperarOCancelar } from './esperar-o-cancelar.ts';

/** Los pasos que este archivo sabe ejecutar: todos los que no llevan otros pasos dentro ni cambian el estado. */
export type PasoDeEscena = Exclude<Paso, { tipo: 'pon' | 'secuencia' | 'condicional' | 'juntos' | 'elige' | 'juego' }>;

export async function ejecutarPasoDeEscena(paso: PasoDeEscena, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, estado, senal } = ejecucion;

  switch (paso.tipo) {
    // --- Pasos que solo se ven o se oyen: al saltar la escena, se omiten. ---

    case 'linea': {
      if (estaEnModoRapido(ejecucion)) return;
      const textoCompleto = completarTexto(paso.texto, estado.actual);
      await esperarOCancelar(acciones.decirLinea(paso, textoCompleto, senal), senal);
      break;
    }

    case 'efecto':
      if (estaEnModoRapido(ejecucion)) return;
      await esperarOCancelar(acciones.reproducirEfecto(paso.nombre, senal), senal);
      break;

    case 'espera':
      if (estaEnModoRapido(ejecucion)) return;
      await esperarOCancelar(acciones.esperar(paso.esperaEnSegundos, senal), senal);
      break;

    case 'sonido':
      if (estaEnModoRapido(ejecucion)) return;
      acciones.tocarSonido(paso.clave);
      break;

    case 'video':
      if (estaEnModoRapido(ejecucion)) return;
      await esperarOCancelar(acciones.reproducirVideo(paso.clavePorIdioma, senal), senal);
      break;

    // --- Pasos que tardan y dejan algo cambiado: al saltar la escena, dejan su resultado final. ---

    case 'camina': {
      // Sin `quien`, camina el jugador; la validación garantiza que entonces el nivel tiene jugador.
      const personaje = paso.personaje ?? ejecucion.contenido.jugador!.personaje;
      if (!estaEnModoRapido(ejecucion)) {
        await esperarOCancelar(acciones.caminar(personaje, paso.punto, senal), senal);
      }
      if (estaEnModoRapido(ejecucion)) {
        acciones.colocar(personaje, paso.punto);
      }
      break;
    }

    case 'camara':
      if (!estaEnModoRapido(ejecucion)) {
        await esperarOCancelar(acciones.moverCamara(paso, senal), senal);
      }
      if (estaEnModoRapido(ejecucion)) {
        acciones.cortarCamara(paso.destino);
      }
      break;

    case 'fundido':
      if (!estaEnModoRapido(ejecucion)) {
        await esperarOCancelar(acciones.fundir(paso, senal), senal);
      }
      if (estaEnModoRapido(ejecucion)) {
        acciones.dejarFundido(paso.sentido);
      }
      break;

    case 'anima':
      // Una animación que pasa una sola vez solo se ve. Una que se repite deja al personaje con otro dibujo.
      if (estaEnModoRapido(ejecucion) && !paso.repite) return;
      await acciones.animar(paso, senal);
      break;

    // --- Pasos que ocurren de una vez: ocurren igual a ritmo normal y al saltar la escena. ---

    case 'mira':
      acciones.mirar(paso);
      break;

    case 'aparece':
      await acciones.aparecer(paso);
      break;

    case 'desaparece':
      acciones.desaparecer(paso.personaje);
      break;

    case 'musica':
      acciones.ponerMusica(paso.clave);
      break;

    case 'sale':
      acciones.pedirSalida(paso.destino);
      break;
  }
}

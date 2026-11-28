// Convierte lo que el juego avisa por dentro en los eventos que el host escucha con `juego.on(...)`.

import type { AvisosDelJuego } from './aplicacion/piezas-del-juego-en-curso.ts';
import type { EmisorDeEventos } from './emisor-de-eventos.ts';

export function crearAvisosParaElHost(emisor: EmisorDeEventos): AvisosDelJuego {
  return {
    alGuardar: (partida) => emisor.emitir('guardar', partida),
    alCumplirObjetivo: (objetivo) => emisor.emitir('objetivo', objetivo),
    alVerPalabra: (palabra) => emisor.emitir('palabra', palabra),
    alCambiarDeNivel: (id, anterior) => emisor.emitir('nivel', { id, anterior }),
    alEmpezarCinematica: (id) => emisor.emitir('cinematica', { id, fase: 'inicio' }),
    alTerminarCinematica: (id) => emisor.emitir('cinematica', { id, fase: 'fin' }),
    alCambiarElEstado: (cambio) => emisor.emitir('estado', cambio),
    alEmpezarMinijuego: (nombre) => emisor.emitir('minijuego', { nombre, fase: 'inicio' }),
    alTerminarMinijuego: (nombre, cierre) => {
      emisor.emitir('minijuego', { nombre, fase: 'fin', exito: cierre.exito, cambios: cierre.cambios });
    },
    alSalir: (destino) => emisor.emitir('salida', destino),
    alFallar: (error) => emisor.emitir('error', error),
  };
}

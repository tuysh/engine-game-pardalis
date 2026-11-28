// Reúne las acciones que el ejecutor de pasos necesita (ver acciones-de-paso.ts),
// cada una con las piezas del nivel ya puestas. Aquí no hay lógica: cada acción vive en su archivo.

import type { AccionesDeDialogo, AccionesDeDireccion, AccionesDePaso } from './acciones-de-paso.ts';
import { animarEnEscena } from './animar-en-escena.ts';
import { caminarEnEscena, colocarEnEscena } from './caminar-en-escena.ts';
import { decirLinea } from './decir-linea.ts';
import { elegirOpcion } from './elegir-opcion.ts';
import { jugarMinijuego } from './jugar-minijuego.ts';
import { aparecerEnEscena, mirarEnEscena } from './mover-personajes-en-escena.ts';
import type { PiezasDeDireccion } from './piezas-de-direccion.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { reproducirEfecto } from './reproducir-efecto.ts';
import { ponerMusicaEnEscena, reproducirVideoEnEscena, tocarSonidoEnEscena } from './sonar-en-escena.ts';

export function crearAccionesDePaso(piezas: PiezasDeDireccion): AccionesDePaso {
  return { ...crearAccionesDeDialogo(piezas.escena), ...crearAccionesDeDireccion(piezas) };
}

function crearAccionesDeDialogo(escena: PiezasDeEscena): AccionesDeDialogo {
  return {
    decirLinea(linea, textoCompleto, senal) {
      return decirLinea({ paso: linea, textoCompleto, seCierraConUnToque: true }, senal, escena);
    },
    elegirOpcion(pregunta, opciones, senal) {
      return elegirOpcion({ pregunta, opciones }, senal, escena);
    },
    reproducirEfecto(efecto, senal) {
      return reproducirEfecto(efecto, senal, escena);
    },
    caminar(personaje, punto, senal) {
      return caminarEnEscena({ personaje, punto }, senal, escena);
    },
    colocar(personaje, punto) {
      colocarEnEscena({ personaje, punto }, escena);
    },
    jugarMinijuego(nombre, config, senal) {
      return jugarMinijuego({ nombre, config }, senal, escena);
    },
    esperar(esperaEnSegundos, senal) {
      return escena.reloj.esperar(esperaEnSegundos, senal);
    },
  };
}

function crearAccionesDeDireccion(piezas: PiezasDeDireccion): AccionesDeDireccion {
  const escena = piezas.escena;
  return {
    moverCamara(paso, senal) {
      return piezas.camara.viajarA(paso.destino, paso.duracionEnSegundos, senal);
    },
    cortarCamara(destino) {
      piezas.camara.cortarA(destino);
    },
    mirar(paso) {
      mirarEnEscena(paso, piezas);
    },
    animar(paso, senal) {
      return animarEnEscena(paso, senal, piezas);
    },
    aparecer(paso) {
      return aparecerEnEscena(paso, piezas);
    },
    desaparecer(personaje) {
      escena.reparto.quitar(personaje);
    },
    ponerMusica(clave) {
      ponerMusicaEnEscena(clave, escena);
    },
    tocarSonido(clave) {
      tocarSonidoEnEscena(clave, escena);
    },
    fundir(paso, senal) {
      return piezas.fundido.fundir(paso.sentido, paso.duracionEnSegundos, senal);
    },
    dejarFundido(sentido) {
      piezas.fundido.dejar(sentido);
    },
    reproducirVideo(clavePorIdioma, senal) {
      return reproducirVideoEnEscena(clavePorIdioma, senal, piezas);
    },
    pedirSalida(destino) {
      piezas.pedirSalida(destino);
    },
    cambiarAcompanante(personaje) {
      piezas.cambiarAcompanante(personaje);
    },
  };
}

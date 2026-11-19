// Reúne las acciones que el ejecutor de pasos necesita (ver acciones-de-paso.ts),
// cada una con las piezas del nivel ya puestas.

import type { AccionesDePaso } from './acciones-de-paso.ts';
import { animarEnEscena } from './animar-en-escena.ts';
import { caminarEnEscena } from './caminar-en-escena.ts';
import { decirLinea } from './decir-linea.ts';
import { elegirOpcion } from './elegir-opcion.ts';
import { jugarMinijuego } from './jugar-minijuego.ts';
import { aparecerEnEscena, mirarEnEscena } from './mover-personajes-en-escena.ts';
import type { PiezasDeDireccion } from './piezas-de-direccion.ts';
import { reproducirEfecto } from './reproducir-efecto.ts';

export function crearAccionesDePaso(piezas: PiezasDeDireccion): AccionesDePaso {
  const escena = piezas.escena;

  return {
    decirLinea(linea, textoCompleto, senal) {
      return decirLinea({ paso: linea, textoCompleto, seCierraConUnToque: true }, senal, escena);
    },
    elegirOpcion(pregunta, opciones, senal) {
      return elegirOpcion({ pregunta, opciones }, senal, escena);
    },
    reproducirEfecto(nombre, senal) {
      return reproducirEfecto(nombre, senal, escena);
    },
    caminar(personaje, punto, senal) {
      return caminarEnEscena({ personaje, punto }, senal, escena);
    },
    colocar(personaje, punto) {
      const destino = escena.puntos[punto]!; // la validación garantiza que el punto existe
      escena.reparto.mirarHacia(personaje, destino);
      escena.reparto.mover(personaje, destino);
    },
    jugarMinijuego(nombre, config, senal) {
      return jugarMinijuego({ nombre, config }, senal, escena);
    },

    esperar(esperaEnSegundos, senal) {
      return escena.reloj.esperar(esperaEnSegundos, senal);
    },
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
      // Si la música no está en los assets, la validación ya lo advirtió: sigue sonando la que había.
      const direccion = escena.direccionDeAsset(clave);
      if (direccion !== undefined) {
        escena.audio.ponerMusica(direccion);
      }
    },
    tocarSonido(clave) {
      // Un sonido que no está en los assets ya se advirtió al validar: aquí solo no suena.
      const direccion = escena.direccionDeAsset(clave);
      if (direccion !== undefined) {
        escena.audio.tocar(direccion);
      }
    },

    fundir(paso, senal) {
      return piezas.fundido.fundir(paso.sentido, paso.duracionEnSegundos, senal);
    },
    dejarFundido(sentido) {
      piezas.fundido.dejar(sentido);
    },

    async reproducirVideo(clavePorIdioma, senal) {
      const clave = clavePorIdioma[escena.idiomaBase];
      const direccion = escena.direccionDeAsset(clave);
      // La validación garantiza que el video existe; si aun así faltara, la escena sigue sin él.
      if (direccion === undefined) return;

      const resultado = await piezas.video.reproducir(direccion, senal);
      if (resultado === 'no_se_pudo') {
        console.warn(`[escenario-engine] no se pudo reproducir el video "${clave}"; la escena sigue sin él`);
      }
    },

    pedirSalida(destino) {
      piezas.pedirSalida(destino);
    },
  };
}

// Cómo se escribe el archivo de contenido de un nivel, y su conversión al `Contenido` del dominio.
// Los objetos son estrictos: una clave que el motor no conoce es un error, para atrapar errores de dedo.

import { z } from 'zod';
import {
  AJUSTES_DEL_MUNDO_POR_DEFECTO,
  GROSORES_DE_FRANJAS,
  VELOCIDAD_DEL_JUGADOR_POR_DEFECTO,
} from '../../dominio/contenido.ts';
import type {
  AjustesDeCamara,
  AjustesDelMundo,
  AlVolver,
  Contenido,
  FlechaDeSalida,
  Interlocutor,
  Jugador,
  Plano,
  Rama,
  Salida,
  SenalDePendiente,
} from '../../dominio/contenido.ts';
import { esquemaDeCinematicas } from './esquema-de-cinematicas.ts';
import { esquemaDeCondicion } from './esquema-de-condicion.ts';
import { esquemaDeLinea, esquemaDePaso, esquemaDePasosOSecuencia } from './esquema-de-pasos.ts';

const esquemaDePersonaje = z.strictObject({
  idioma: z.enum(['es', 'en']),
  sprite: z.string().min(1),
});

const esquemaDeMeta = z.strictObject({
  id: z.string().min(1),
  titulo: z.string(),
  personajes: z.record(z.string(), esquemaDePersonaje),
});

const esquemaDeJugador = z
  .strictObject({
    personaje: z.string().min(1),
    velocidad: z.number().positive().default(VELOCIDAD_DEL_JUGADOR_POR_DEFECTO),
    acompanante: z.string().min(1).optional(),
  })
  .transform(
    (json): Jugador => ({
      personaje: json.personaje,
      velocidadEnMetrosPorSegundo: json.velocidad,
      acompanante: json.acompanante,
    }),
  );

const CAMARA_POR_DEFECTO = AJUSTES_DEL_MUNDO_POR_DEFECTO.camara;

const esquemaDeCamara = z
  .strictObject({
    distancia: z.number().positive().default(CAMARA_POR_DEFECTO.distanciaEnMetros),
    altura: z.number().nonnegative().default(CAMARA_POR_DEFECTO.alturaEnMetros),
    giro: z.number().default(CAMARA_POR_DEFECTO.giroEnGrados),
  })
  .transform(
    (json): AjustesDeCamara => ({
      distanciaEnMetros: json.distancia,
      alturaEnMetros: json.altura,
      giroEnGrados: json.giro,
    }),
  );

const esquemaDePlano = z
  .strictObject({
    mira: z.string().min(1),
    distancia: z.number().positive(),
    altura: z.number().nonnegative(),
    giro: z.number().default(CAMARA_POR_DEFECTO.giroEnGrados),
  })
  .transform(
    (json): Plano => ({
      mira: json.mira,
      distanciaEnMetros: json.distancia,
      alturaEnMetros: json.altura,
      giroEnGrados: json.giro,
    }),
  );

// Un color escrito como en CSS, con sus seis cifras: "#" y tres pares de rojo, verde y azul.
// Acepta "#2b1a0c" y "#BFE6F5"; no acepta "#fff", "rojo" ni "rgb(0, 0, 0)".
const COLOR_CON_SEIS_CIFRAS = /^#[0-9a-fA-F]{6}$/;

const esquemaDeColor = z.string().regex(COLOR_CON_SEIS_CIFRAS, {
  error: 'se espera un color escrito como "#rrggbb", por ejemplo "#bfe6f5"',
});

const esquemaDeMundo = z
  .strictObject({
    pixelesPorMetro: z.number().positive().default(AJUSTES_DEL_MUNDO_POR_DEFECTO.pixelesPorMetro),
    // `prefault({})`: si falta la sección, se lee como si viniera vacía y entran sus valores por defecto.
    camara: esquemaDeCamara.prefault({}),
    fondo: esquemaDeColor.default(AJUSTES_DEL_MUNDO_POR_DEFECTO.colorDeFondo),
    sonidos: z.strictObject({ musica: z.string().min(1).optional() }).prefault({}),
    planos: z.record(z.string(), esquemaDePlano).default({}),
    franjas: z.enum(GROSORES_DE_FRANJAS).optional(),
  })
  .transform(
    (json): AjustesDelMundo => ({
      pixelesPorMetro: json.pixelesPorMetro,
      camara: json.camara,
      colorDeFondo: json.fondo,
      sonidos: json.sonidos,
      planos: json.planos,
      franjas: json.franjas,
    }),
  );

const esquemaDeEstado = z.strictObject({
  objetivos: z.array(z.string().min(1)).default([]),
  variables: z.array(z.string().min(1)).default([]),
  compartidas: z.array(z.string().min(1)).optional(),
  lista: z.record(z.string(), z.string()).default({}),
  dinero: z.number().optional(),
});

const esquemaDeRama = z
  .strictObject({ cuando: esquemaDeCondicion.optional(), dice: z.array(esquemaDePaso) })
  .transform((json): Rama => ({ condicion: json.cuando, pasos: json.dice }));

const esquemaDeAlVolver: z.ZodType<AlVolver> = z.strictObject({
  siLogrado: esquemaDePasosOSecuencia,
  siNo: esquemaDePasosOSecuencia,
});

const esquemaDeSenalDePendiente: z.ZodType<SenalDePendiente> = z.strictObject({
  visibleCuando: esquemaDeCondicion.optional(),
});

const esquemaDeInterlocutor: z.ZodType<Interlocutor> = z.strictObject({
  dialogo: z.array(esquemaDeRama),
  alVolver: esquemaDeAlVolver.optional(),
  senal: esquemaDeSenalDePendiente.optional(),
});

const esquemaDeFlecha: z.ZodType<FlechaDeSalida> = z.strictObject({
  visibleCuando: esquemaDeCondicion.optional(),
  texto: z.string().optional(),
});

const esquemaDeSalida: z.ZodType<Salida> = z.strictObject({
  destino: z.string().min(1),
  requiere: esquemaDeCondicion.optional(),
  siBloqueada: esquemaDePasosOSecuencia.optional(),
  flecha: esquemaDeFlecha.optional(),
});

export const esquemaDeContenido: z.ZodType<Contenido> = z.strictObject({
  meta: esquemaDeMeta,
  jugador: esquemaDeJugador.optional(),
  // `prefault({})`: si el nivel no trae la sección, se lee como si trajera una vacía.
  mundo: esquemaDeMundo.prefault({}),
  estado: esquemaDeEstado.prefault({}),
  secuencias: z.record(z.string(), z.array(esquemaDePaso)).default({}),
  npcs: z.record(z.string(), esquemaDeInterlocutor).default({}),
  interactivos: z.record(z.string(), esquemaDeInterlocutor).default({}),
  comentarios: z.record(z.string(), z.array(esquemaDeLinea)).default({}),
  cinematicas: esquemaDeCinematicas.prefault({}),
  salida: esquemaDeSalida.optional(),
});

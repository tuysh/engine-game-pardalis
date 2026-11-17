// Cómo se escribe el archivo de contenido de un nivel, y su conversión al `Contenido` del dominio.
// Los objetos son estrictos: una clave que el motor no conoce es un error, para atrapar errores de dedo.

import { z } from 'zod';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO, VELOCIDAD_DEL_JUGADOR_POR_DEFECTO } from '../../dominio/contenido.ts';
import type {
  AjustesDeCamara,
  AjustesDelMundo,
  AlVolver,
  Contenido,
  FlechaDeSalida,
  Interlocutor,
  Jugador,
  Rama,
  Salida,
} from '../../dominio/contenido.ts';
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
  })
  .transform((json): Jugador => ({ personaje: json.personaje, velocidadEnMetrosPorSegundo: json.velocidad }));

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

const esquemaDeMundo: z.ZodType<AjustesDelMundo> = z.strictObject({
  pixelesPorMetro: z.number().positive().default(AJUSTES_DEL_MUNDO_POR_DEFECTO.pixelesPorMetro),
  // `prefault({})`: si falta la sección, se lee como si viniera vacía y entran sus valores por defecto.
  camara: esquemaDeCamara.prefault({}),
});

const esquemaDeEstado = z.strictObject({
  objetivos: z.array(z.string().min(1)).default([]),
  variables: z.array(z.string().min(1)).default([]),
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

const esquemaDeInterlocutor: z.ZodType<Interlocutor> = z.strictObject({
  dialogo: z.array(esquemaDeRama),
  alVolver: esquemaDeAlVolver.optional(),
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
  salida: esquemaDeSalida.optional(),
});

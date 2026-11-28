import { expect, test } from 'bun:test';
import type { Contenido } from '../../dominio/contenido.ts';
import type { Paso } from '../../dominio/paso.ts';
import { LectorDeNivelesDeJson } from './lector-de-niveles-de-json.ts';

const META = { id: 'tortilleria', titulo: 'La Tortillería', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } };

/** Lee un contenido cuyo único diálogo son esos pasos y devuelve los pasos ya convertidos. */
function leerPasos(pasosEnJson: unknown[]): readonly Paso[] {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    npcs: { tortu: { dialogo: [{ dice: pasosEnJson }] } },
  });
  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  return lectura.valor.npcs['tortu']!.dialogo[0]!.pasos;
}

/** Lee un contenido que debe estar mal y devuelve sus errores. */
function erroresDe(contenidoEnJson: unknown): readonly string[] {
  const lectura = new LectorDeNivelesDeJson().leerContenido(contenidoEnJson);
  if (lectura.tipo !== 'invalido') throw new Error('se esperaba un contenido inválido');
  return lectura.errores;
}

test('un contenido con solo "meta" se lee con todas las demás secciones vacías', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({ meta: META });

  const esperado: Contenido = {
    meta: { id: 'tortilleria', titulo: 'La Tortillería', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } },
    jugador: undefined,
    mundo: {
      pixelesPorMetro: 100,
      camara: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 },
      colorDeFondo: '#bfe6f5',
      sonidos: {},
      planos: {},
    },
    estado: { objetivos: [], variables: [], lista: {}, dinero: undefined },
    secuencias: {},
    npcs: {},
    interactivos: {},
    cinematicas: {},
    comentarios: {},
    salida: undefined,
  };
  expect(lectura).toEqual({ tipo: 'leido', valor: esperado });
});

test('el jugador y el mundo se leen con sus unidades, y lo que falta toma su valor por defecto', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    jugador: { personaje: 'tortu', velocidad: 3 },
    mundo: { pixelesPorMetro: 64, camara: { giro: 20 }, sonidos: { musica: 'mus_barrio' } },
  });

  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.jugador).toEqual({ personaje: 'tortu', velocidadEnMetrosPorSegundo: 3 });
  expect(lectura.valor.mundo).toEqual({
    pixelesPorMetro: 64,
    camara: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 20 },
    colorDeFondo: '#bfe6f5',
    sonidos: { musica: 'mus_barrio' },
    planos: {},
  });
});

test('jugador.distanciaDelAcompanante se lee en metros y debe ser un número positivo', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    jugador: { personaje: 'tortu', acompanante: 'tortu', distanciaDelAcompanante: 1.4 },
  });
  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.jugador?.distanciaDelAcompananteEnMetros).toBe(1.4);

  const errores = erroresDe({ meta: META, jugador: { personaje: 'tortu', distanciaDelAcompanante: 0 } });
  expect(errores).toEqual(['jugador.distanciaDelAcompanante: Demasiado pequeño: se esperaba que número fuera >0']);
});

test('una línea se convierte con su hablante, traducción, audio y tarjeta de vocabulario', () => {
  const pasos = leerPasos([
    { dice: 'tortu', texto: '¡Cuidado!', trad: 'Careful!', en: 'hot', es: 'caliente', audio: 'vo_tortu_caliente' },
  ]);

  expect(pasos).toEqual([
    {
      tipo: 'linea',
      hablante: 'tortu',
      texto: '¡Cuidado!',
      traduccion: 'Careful!',
      palabra: { en: 'hot', es: 'caliente' },
      audio: 'vo_tortu_caliente',
    },
  ]);
});

test('cada paso corto del JSON se convierte en su forma con "tipo"', () => {
  const pasos = leerPasos([
    { efecto: 'magia' },
    { pon: { globo: 'rosa', dinero: 50, listo: true } },
    { juego: 'Tortilleria', config: { palabras: ['hot'] } },
    { camina: 'frente_tortilleria' },
    { camina: 'frente_tortilleria', quien: 'tortu' },
    { secuencia: 'aun_no_item' },
  ]);

  expect(pasos).toEqual([
    { tipo: 'efecto', nombre: 'magia' },
    { tipo: 'pon', valores: { globo: 'rosa', dinero: 50, listo: true } },
    { tipo: 'juego', nombre: 'Tortilleria', config: { palabras: ['hot'] } },
    { tipo: 'camina', punto: 'frente_tortilleria', personaje: undefined },
    { tipo: 'camina', punto: 'frente_tortilleria', personaje: 'tortu' },
    { tipo: 'secuencia', nombre: 'aun_no_item' },
  ]);
});

test('un condicional lleva su condición ya interpretada y sus pasos de adentro', () => {
  const pasos = leerPasos([{ cuando: 'no tengo tortillas', dice: [{ efecto: 'magia' }] }]);

  expect(pasos).toEqual([
    {
      tipo: 'condicional',
      condicion: { tipo: 'no', condicion: { tipo: 'variable', nombre: 'tortillas' } },
      pasos: [{ tipo: 'efecto', nombre: 'magia' }],
    },
  ]);
});

test('una condición puede ser un texto, una lista (todas) o { "alguno" } (alguna)', () => {
  const pasos = leerPasos([{ cuando: ['globo', { alguno: ['tengo tortillas', 'objetivosCompletos'] }], dice: [] }]);

  expect(pasos).toEqual([
    {
      tipo: 'condicional',
      condicion: {
        tipo: 'todas',
        condiciones: [
          { tipo: 'variable', nombre: 'globo' },
          { tipo: 'alguna', condiciones: [{ tipo: 'variable', nombre: 'tortillas' }, { tipo: 'objetivosCompletos' }] },
        ],
      },
      pasos: [],
    },
  ]);
});

test('una opción lleva sus pasos escritos en el lugar o el nombre de una secuencia', () => {
  const pasos = leerPasos([
    {
      elige: '¿Cuál quieres?',
      opciones: [
        { imagen: 'img_rosa', audio: 'vo_rosa', cuando: 'globo', secuencia: [{ efecto: 'confeti' }] },
        { texto: 'Ninguno', trad: 'None', secuencia: 'despedida' },
      ],
    },
  ]);

  expect(pasos).toEqual([
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [
        {
          texto: undefined,
          traduccion: undefined,
          imagen: 'img_rosa',
          audio: 'vo_rosa',
          condicion: { tipo: 'variable', nombre: 'globo' },
          alElegir: { tipo: 'pasos', pasos: [{ tipo: 'efecto', nombre: 'confeti' }] },
        },
        {
          texto: 'Ninguno',
          traduccion: 'None',
          imagen: undefined,
          audio: undefined,
          condicion: undefined,
          alElegir: { tipo: 'secuencia', nombre: 'despedida' },
        },
      ],
    },
  ]);
});

test('un campo con el tipo equivocado se reporta con su ruta dentro del archivo', () => {
  const errores = erroresDe({ meta: META, npcs: { tortu: { dialogo: [{ dice: [{ dice: 'tortu', texto: 5 }] }] } } });

  expect(errores).toEqual(['npcs.tortu.dialogo[0].dice[0].texto: Entrada inválida: se esperaba texto, recibido número']);
});

test('una clave que el motor no conoce es un error: así se atrapan los errores de dedo', () => {
  const errores = erroresDe({
    meta: META,
    npcs: { tortu: { dialogo: [{ dice: [{ dice: 'tortu', texto: 'Hola', audioo: 'vo_hola' }] }] } },
    salidas: {},
  });

  expect(errores).toEqual(['npcs.tortu.dialogo[0].dice[0]: Llave desconocida: "audioo"', '(raíz): Llave desconocida: "salidas"']);
});

test('un paso que no se reconoce lista las claves posibles', () => {
  const errores = erroresDe({ meta: META, secuencias: { saludo: [{ grita: '¡Hola!' }] } });

  expect(errores).toEqual([
    'secuencias.saludo[0]: no se reconoce el paso: debe ser un objeto con una de estas claves: ' +
      '"cuando", "elige", "juego", "camina", "secuencia", "efecto", "pon", "juntos", "espera", "camara", "mira", ' +
      '"anima", "aparece", "desaparece", "musica", "sonido", "fundido", "video", "sale", "acompana", "dice"',
  ]);
});

test('una tarjeta de vocabulario con solo "en" o solo "es" es un error', () => {
  const errores = erroresDe({ meta: META, secuencias: { saludo: [{ dice: 'tortu', texto: 'Hot!', en: 'hot' }] } });

  expect(errores).toEqual(['secuencias.saludo[0]: una tarjeta de vocabulario necesita "en" y "es" juntos']);
});

test('una condición con otra forma explica cuáles se aceptan', () => {
  const errores = erroresDe({ meta: META, salida: { destino: 'Selector', requiere: 5 } });

  expect(errores).toEqual([
    'salida.requiere: se espera una condición: un texto, una lista de condiciones o { "alguno": [...] }',
  ]);
});

test('donde va una lista de pasos o una secuencia, otra cosa es un error', () => {
  const errores = erroresDe({ meta: META, salida: { destino: 'Selector', siBloqueada: { secuencia: 'x' } } });

  expect(errores).toEqual(['salida.siBloqueada: se espera una lista de pasos o el nombre de una secuencia']);
});

test('el error de un paso dentro de una opción conserva la ruta completa', () => {
  const errores = erroresDe({
    meta: META,
    secuencias: { pregunta: [{ elige: '¿Cuál?', opciones: [{ imagen: 'img_rosa', secuencia: [{ efecto: 7 }] }] }] },
  });

  expect(errores).toEqual([
    'secuencias.pregunta[0].opciones[0].secuencia[0].efecto: Entrada inválida: se esperaba texto, recibido número',
  ]);
});

test('un contenido que no es un objeto se reporta en la raíz', () => {
  expect(erroresDe('hola')).toEqual(['(raíz): Entrada inválida: se esperaba objeto, recibido texto']);
});

test('nivel.json se lee con sus tres rutas', () => {
  const lectura = new LectorDeNivelesDeJson().leerDescripcionDeNivel({
    mapa: 'mapa.tmj',
    contenido: 'contenido.json',
    assets: ['.', '../comun'],
  });

  expect(lectura).toEqual({
    tipo: 'leido',
    valor: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.', '../comun'] },
  });
});

test('en nivel.json, sin "assets" se usa la carpeta del propio nivel', () => {
  const lectura = new LectorDeNivelesDeJson().leerDescripcionDeNivel({ mapa: 'mapa.tmj', contenido: 'contenido.json' });

  expect(lectura).toEqual({ tipo: 'leido', valor: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] } });
});

test('en nivel.json, una ruta que falta se reporta por su nombre', () => {
  const lectura = new LectorDeNivelesDeJson().leerDescripcionDeNivel({ mapa: 'mapa.tmj' });

  expect(lectura).toEqual({
    tipo: 'invalido',
    errores: ['contenido: Entrada inválida: se esperaba texto, recibido indefinido'],
  });
});

test('cada paso de escena del JSON se convierte en su forma con "tipo"', () => {
  const pasos = leerPasos([
    { juntos: [{ espera: 2 }, { sonido: 'puerta_abre' }] },
    { camara: 'plano_sala', duracion: 2 },
    { camara: 'jugador' },
    { mira: 'tortu', hacia: 'puerta' },
    { anima: 'tortu', con: 'tortu_saluda' },
    { anima: 'tortu', con: 'tortu_baila', repite: true },
    { aparece: 'tortu', en: 'puerta' },
    { desaparece: 'tortu' },
    { musica: 'mus_casa' },
    { fundido: 'abrir', duracion: 1 },
    { fundido: 'cerrar' },
    { video: 'intro_tele' },
    { video: { es: 'intro_es', en: 'intro_en' } },
    { sale: 'barrio' },
  ]);

  expect(pasos).toEqual([
    {
      tipo: 'juntos',
      pasos: [
        { tipo: 'espera', esperaEnSegundos: 2 },
        { tipo: 'sonido', clave: 'puerta_abre' },
      ],
    },
    { tipo: 'camara', destino: 'plano_sala', duracionEnSegundos: 2 },
    { tipo: 'camara', destino: 'jugador', duracionEnSegundos: 0 },
    { tipo: 'mira', personaje: 'tortu', hacia: 'puerta' },
    { tipo: 'anima', personaje: 'tortu', clave: 'tortu_saluda', repite: false },
    { tipo: 'anima', personaje: 'tortu', clave: 'tortu_baila', repite: true },
    { tipo: 'aparece', personaje: 'tortu', punto: 'puerta' },
    { tipo: 'desaparece', personaje: 'tortu' },
    { tipo: 'musica', clave: 'mus_casa' },
    { tipo: 'fundido', sentido: 'abrir', duracionEnSegundos: 1 },
    { tipo: 'fundido', sentido: 'cerrar', duracionEnSegundos: 0 },
    { tipo: 'video', clavePorIdioma: { es: 'intro_tele', en: 'intro_tele' } },
    { tipo: 'video', clavePorIdioma: { es: 'intro_es', en: 'intro_en' } },
    { tipo: 'sale', destino: 'barrio' },
  ]);
});

test('una cinemática se lee con su inicio, y sin "cuando" solo empieza si no se ha visto', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    cinematicas: {
      intro: { inicia: 'alEntrar', pasos: [{ espera: 1 }] },
      festejo: { inicia: { objetivo: 'tortillas' }, cuando: 'globo', saltable: false, codigo: 'festejo' },
      paseo: { inicia: { zona: 'plaza' }, pasos: [] },
      despedida: { inicia: 'manual', pasos: [] },
    },
  });

  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.cinematicas).toEqual({
    intro: {
      inicio: { tipo: 'alEntrar' },
      condicion: { tipo: 'no', condicion: { tipo: 'variable', nombre: 'vista.intro' } },
      saltable: true,
      guion: { tipo: 'pasos', pasos: [{ tipo: 'espera', esperaEnSegundos: 1 }] },
    },
    festejo: {
      inicio: { tipo: 'objetivo', objetivo: 'tortillas' },
      condicion: { tipo: 'variable', nombre: 'globo' },
      saltable: false,
      guion: { tipo: 'codigo', nombre: 'festejo' },
    },
    paseo: {
      inicio: { tipo: 'zona', zona: 'plaza' },
      condicion: { tipo: 'no', condicion: { tipo: 'variable', nombre: 'vista.paseo' } },
      saltable: true,
      guion: { tipo: 'pasos', pasos: [] },
    },
    despedida: {
      inicio: { tipo: 'manual' },
      condicion: { tipo: 'no', condicion: { tipo: 'variable', nombre: 'vista.despedida' } },
      saltable: true,
      guion: { tipo: 'pasos', pasos: [] },
    },
  });
});

test('una cinemática con pasos y código a la vez, o sin ninguno de los dos, es un error', () => {
  const errores = erroresDe({
    meta: META,
    cinematicas: {
      doble: { inicia: 'alEntrar', pasos: [], codigo: 'doble' },
      vacia: { inicia: 'alEntrar' },
    },
  });

  expect(errores).toEqual([
    'cinematicas.doble: una cinemática lleva "pasos" o "codigo": uno de los dos, ni ambos ni ninguno',
    'cinematicas.vacia: una cinemática lleva "pasos" o "codigo": uno de los dos, ni ambos ni ninguno',
  ]);
});

test('una cinemática con un inicio desconocido explica cuáles se aceptan', () => {
  const errores = erroresDe({ meta: META, cinematicas: { rara: { inicia: 'alSalir', pasos: [] } } });

  expect(errores).toEqual([
    'cinematicas.rara.inicia: se espera "alEntrar", "manual", { "zona": nombre } o { "objetivo": nombre }',
  ]);
});

test('un plano de cámara se lee con sus medidas en metros y grados', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    mundo: { planos: { plano_sala: { mira: 'sillon', distancia: 6, altura: 2.5, giro: 20 } } },
  });

  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.mundo.planos).toEqual({
    plano_sala: { mira: 'sillon', distanciaEnMetros: 6, alturaEnMetros: 2.5, giroEnGrados: 20 },
  });
});

test('el fondo del mundo se lee como color, y uno mal escrito es un error que dice cómo va', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({ meta: META, mundo: { fondo: '#2b1a0c' } });
  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.mundo.colorDeFondo).toBe('#2b1a0c');

  const errores = erroresDe({ meta: META, mundo: { fondo: 'cafe' } });
  expect(errores).toEqual(['mundo.fondo: se espera un color escrito como "#rrggbb", por ejemplo "#bfe6f5"']);
});

test('"pon" acepta sumar y restar, y cualquier otra forma dice qué se espera', () => {
  const pasos = leerPasos([{ pon: { dinero: { resta: 10 }, estrellas: { suma: 1 } } }]);
  expect(pasos).toEqual([{ tipo: 'pon', valores: { dinero: { resta: 10 }, estrellas: { suma: 1 } } }]);

  const errores = erroresDe({ meta: META, secuencias: { pago: [{ pon: { dinero: { quita: 10 } } }] } });
  expect(errores).toEqual([
    'secuencias.pago[0].pon.dinero: se espera un texto, un número, true, false, { "suma": número } o { "resta": número }',
  ]);
});

test('una línea puede traer la pose de quien habla, las reacciones de quienes escuchan y ser un pensamiento', () => {
  const pasos = leerPasos([
    { dice: 'tortu', texto: '¡Ay!', con: 'tortu_sorpresa', reacciona: { tommy: 'tommy_feliz' }, piensa: true },
  ]);

  expect(pasos).toEqual([
    {
      tipo: 'linea',
      hablante: 'tortu',
      texto: '¡Ay!',
      pose: 'tortu_sorpresa',
      reacciones: { tommy: 'tommy_feliz' },
      esPensamiento: true,
    },
  ]);
});

test('el jugador puede traer acompañante, y el paso "acompana" lo cambia o lo quita con null', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    jugador: { personaje: 'tortu', acompanante: 'bobby' },
  });
  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.jugador?.acompanante).toBe('bobby');

  expect(leerPasos([{ acompana: 'bobby' }, { acompana: null }])).toEqual([
    { tipo: 'acompana', personaje: 'bobby' },
    { tipo: 'acompana', personaje: undefined },
  ]);
});

test('la voz de un personaje se lee con su tono y su velocidad, y lo que falta queda en 1', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: {
      id: 'mercado',
      titulo: 'El mercado',
      personajes: {
        mama: { idioma: 'es', sprite: 'spr_mama', voz: { tono: 0.9, velocidad: 0.95 } },
        bobby: { idioma: 'en', sprite: 'spr_bobby', voz: { tono: 1.3 } },
      },
    },
  });

  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.meta.personajes['mama']!.voz).toEqual({ tono: 0.9, velocidad: 0.95 });
  expect(lectura.valor.meta.personajes['bobby']!.voz).toEqual({ tono: 1.3, velocidad: 1 });
});

test('un tono o una velocidad fuera de sus límites dice cuáles son y qué es lo normal', () => {
  const errores = erroresDe({
    meta: {
      id: 'mercado',
      titulo: 'El mercado',
      personajes: {
        pardi: { idioma: 'es', sprite: 'spr_pardi', voz: { tono: 3, velocidad: 'rápido' } },
        bobby: { idioma: 'en', sprite: 'spr_bobby', voz: { tono: 1.2, volumen: 1 } },
      },
    },
  });

  expect(errores).toEqual([
    'meta.personajes.pardi.voz.tono: el tono va de 0.5 (más grave) a 2 (más agudo); 1 es la voz normal',
    'meta.personajes.pardi.voz.velocidad: la velocidad va de 0.5 (más despacio) a 2 (más rápido); 1 es la voz normal',
    'meta.personajes.bobby.voz: Llave desconocida: "volumen"',
  ]);
});

test('mundo.franjas acepta "normales", "delgadas" y "ninguna"; otro valor es error', () => {
  const lector = new LectorDeNivelesDeJson();
  const delgadas = lector.leerContenido({ meta: META, mundo: { franjas: 'delgadas' } });
  if (delgadas.tipo !== 'leido') throw new Error(`no se pudo leer: ${delgadas.errores.join('; ')}`);
  expect(delgadas.valor.mundo.franjas).toBe('delgadas');

  const gruesas = lector.leerContenido({ meta: META, mundo: { franjas: 'gruesas' } });
  expect(gruesas.tipo).toBe('invalido');
  if (gruesas.tipo !== 'invalido') return;
  expect(gruesas.errores).toEqual(['mundo.franjas: Opción inválida: se esperaba una de "normales"|"delgadas"|"ninguna"']);
});

test('un paso "efecto" puede nombrar el sonido que lo acompaña', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    secuencias: { foto: [{ efecto: 'destello', sonido: 'sfx_foto' }, { efecto: 'magia' }] },
  });

  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.secuencias['foto']).toEqual([
    { tipo: 'efecto', nombre: 'destello', sonido: 'sfx_foto' },
    { tipo: 'efecto', nombre: 'magia' },
  ]);
});

test('un NPC puede llevar "senal" con su visibleCuando; otra clave dentro de "senal" es error', () => {
  const lector = new LectorDeNivelesDeJson();
  const lectura = lector.leerContenido({
    meta: META,
    npcs: { tortu: { dialogo: [], senal: { visibleCuando: 'no tengo tortillas' } } },
  });
  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.npcs['tortu']?.senal).toEqual({
    visibleCuando: { tipo: 'no', condicion: { tipo: 'variable', nombre: 'tortillas' } },
  });

  const conError = lector.leerContenido({ meta: META, npcs: { tortu: { dialogo: [], senal: { cuando: 'x' } } } });
  expect(conError.tipo).toBe('invalido');
  if (conError.tipo !== 'invalido') return;
  expect(conError.errores).toEqual(['npcs.tortu.senal: Llave desconocida: "cuando"']);
});

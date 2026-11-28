import { expect, spyOn, test } from 'bun:test';
import { VocesDelNivel } from './voces-del-nivel.ts';

test('da la voz grabada de una clave y la voz de un personaje del nivel', () => {
  const voces = new VocesDelNivel({
    personajes: {
      bobby: { idioma: 'en', sprite: 'spr_bobby', voz: { tono: 1.3, velocidad: 1.1 } },
      mama: { idioma: 'es', sprite: 'spr_mama' },
    },
    direccionDeAsset: (clave) => (clave === 'vo_bobby_corn' ? '/voz/vo_bobby_corn.mp3' : undefined),
  });

  expect(voces.direccionDeVoz('vo_bobby_corn', 'juego.decir')).toBe('/voz/vo_bobby_corn.mp3');
  expect(voces.vozDe('bobby', 'juego.decir')).toEqual({ tono: 1.3, velocidad: 1.1 });
  // Un personaje sin `voz` habla con la voz normal, y eso no es algo que avisar.
  expect(voces.vozDe('mama', 'juego.decir')).toBeUndefined();
});

test('lo que falta se avisa una sola vez, aunque lo pidan distintas llamadas', () => {
  const avisos: string[] = [];
  const espia = spyOn(console, 'warn').mockImplementation((aviso: unknown) => {
    avisos.push(String(aviso));
  });
  const voces = new VocesDelNivel({ personajes: {}, direccionDeAsset: () => undefined });

  try {
    voces.direccionDeVoz('vo_hola', 'juego.decir');
    voces.direccionDeVoz('vo_hola', 'contexto.audio.decir');
    voces.vozDe('constructor', 'juego.decir');
    voces.vozDe('constructor', 'juego.decir');
  } finally {
    espia.mockRestore();
  }

  expect(avisos).toEqual([
    '[escenario-engine] juego.decir: "vo_hola" no está en los assets del nivel; se usa voz sintetizada',
    '[escenario-engine] juego.decir: "constructor" no es un personaje del nivel (meta.personajes); se usa la voz normal',
  ]);
});

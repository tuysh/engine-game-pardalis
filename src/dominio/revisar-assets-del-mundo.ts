// Cruza el mapa con los assets del nivel: revisa que exista la imagen del suelo,
// la de cada telón, la de cada objeto del decorado y el dibujo con que empieza un personaje (`anima`).
// Una imagen que falta es un error.

import type { AssetsDeNivel } from './assets-de-nivel.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Mundo } from './mundo.ts';
import { problemaDeImagen } from './revisar-assets.ts';

export function revisarAssetsDelMundo(mundo: Mundo, assets: AssetsDeNivel, diagnostico: Diagnostico): void {
  if (mundo.suelo !== undefined) {
    anotarSiHayProblema(mundo.suelo.asset, 'la capa "suelo"', assets, diagnostico);
  }
  for (const telon of mundo.telones) {
    anotarSiHayProblema(telon.asset, `${telon.descripcion} (telón)`, assets, diagnostico);
  }
  for (const objeto of mundo.decorado) {
    anotarSiHayProblema(objeto.asset, `${objeto.descripcion} (decorado)`, assets, diagnostico);
  }
  for (const id of Object.keys(mundo.npcs)) {
    const npc = mundo.npcs[id]!; // `id` viene de `Object.keys`, así que existe
    if (npc.dibujoInicial !== undefined) {
      anotarSiHayProblema(npc.dibujoInicial, `${npc.descripcion} (npc), propiedad "anima"`, assets, diagnostico);
    }
  }
  for (const inicio of mundo.iniciosDelJugador) {
    if (inicio.dibujoInicial !== undefined) {
      const donde = `${inicio.descripcion} (inicioJugador), propiedad "anima"`;
      anotarSiHayProblema(inicio.dibujoInicial, donde, assets, diagnostico);
    }
  }
}

function anotarSiHayProblema(clave: string, donde: string, assets: AssetsDeNivel, diagnostico: Diagnostico): void {
  const problema = problemaDeImagen(clave, assets);
  if (problema !== undefined) {
    diagnostico.errores.push(`mapa: ${donde}: ${problema}`);
  }
}

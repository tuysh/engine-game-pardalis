// Cruza el mapa con los assets del nivel: revisa que exista la imagen del suelo,
// la de cada telón y la de cada objeto del decorado. Una imagen que falta es un error.

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
}

function anotarSiHayProblema(clave: string, donde: string, assets: AssetsDeNivel, diagnostico: Diagnostico): void {
  const problema = problemaDeImagen(clave, assets);
  if (problema !== undefined) {
    diagnostico.errores.push(`mapa: ${donde}: ${problema}`);
  }
}

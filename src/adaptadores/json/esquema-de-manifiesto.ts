// Cómo se escribe el manifiesto de assets (`assets.json`) y su conversión al `Manifiesto` del dominio.
// También la conversión de vuelta, para escribir el archivo, y la forma de `assets.config.json`.
//
//   "spr_mama":   { "tipo": "imagen", "archivo": "img/spr_mama.svg", "ancho": 110, "alto": 170 }
//   "tommy_tele": { "tipo": "animacion", "cuadros": ["img/tommy_tele_1.svg", ...], "fps": 4, "ancho": 90, "alto": 160 }
//   "vo_hola":    { "tipo": "audio", "archivo": "voz/vo_hola.mp3" }
//   "intro_tele": { "tipo": "video", "archivo": "video/intro_tele.mp4" }

import { z } from 'zod';
import type { Asset, ConfiguracionDeAssets, Manifiesto } from '../../dominio/manifiesto.ts';
import { esRutaSeguraDeAsset } from '../../dominio/ruta-de-asset.ts';

const esquemaDeRuta = z.string().refine(esRutaSeguraDeAsset, {
  error: 'ruta no permitida: debe ser relativa a la carpeta de assets, sin ".." y sin ser una URL',
});

const esquemaDeTamano = z.number().positive();

const formaDeAsset = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('imagen'), archivo: esquemaDeRuta, ancho: esquemaDeTamano, alto: esquemaDeTamano }),
  z.strictObject({
    tipo: z.literal('animacion'),
    cuadros: z.array(esquemaDeRuta).min(1),
    fps: z.number().positive(),
    ancho: esquemaDeTamano,
    alto: esquemaDeTamano,
  }),
  z.strictObject({ tipo: z.literal('audio'), archivo: esquemaDeRuta }),
  z.strictObject({ tipo: z.literal('video'), archivo: esquemaDeRuta }),
]);

/** Un asset tal como se escribe en el archivo. */
type AssetEnJson = z.output<typeof formaDeAsset>;

const esquemaDeAsset = formaDeAsset.transform((json): Asset => {
  switch (json.tipo) {
    case 'imagen':
      return { tipo: 'imagen', archivo: json.archivo, anchoEnPixeles: json.ancho, altoEnPixeles: json.alto };
    case 'animacion':
      return {
        tipo: 'animacion',
        cuadros: json.cuadros,
        cuadrosPorSegundo: json.fps,
        anchoEnPixeles: json.ancho,
        altoEnPixeles: json.alto,
      };
    case 'audio':
      return { tipo: 'audio', archivo: json.archivo };
    case 'video':
      return { tipo: 'video', archivo: json.archivo };
  }
});

export const esquemaDeManifiesto: z.ZodType<Manifiesto> = z.record(z.string(), esquemaDeAsset);

/** La forma de `assets.config.json`: `{ "fps": { "tommy_viendo_tele": 4 } }`. */
export const esquemaDeConfiguracionDeAssets: z.ZodType<ConfiguracionDeAssets> = z
  .strictObject({ fps: z.record(z.string(), z.number().positive()).default({}) })
  .transform((json): ConfiguracionDeAssets => ({ cuadrosPorSegundo: json.fps }));

/** Convierte un asset del dominio a la forma en que se escribe en el archivo. */
export function convertirAssetAJson(asset: Asset): AssetEnJson {
  switch (asset.tipo) {
    case 'imagen':
      return { tipo: 'imagen', archivo: asset.archivo, ancho: asset.anchoEnPixeles, alto: asset.altoEnPixeles };
    case 'animacion':
      return {
        tipo: 'animacion',
        cuadros: [...asset.cuadros],
        fps: asset.cuadrosPorSegundo,
        ancho: asset.anchoEnPixeles,
        alto: asset.altoEnPixeles,
      };
    case 'audio':
      return { tipo: 'audio', archivo: asset.archivo };
    case 'video':
      return { tipo: 'video', archivo: asset.archivo };
  }
}

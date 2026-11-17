// Reglas para las rutas de archivos de assets (AGENTS.md §2, principio 5: solo se piden archivos permitidos).
// Una ruta segura es relativa a su carpeta de assets: no sube de carpeta, no empieza en la raíz y no es una URL.

/** Los tipos de archivo que el motor reconoce como assets, por extensión (en minúsculas, con punto). */
const TIPO_POR_EXTENSION: Readonly<Record<string, 'imagen' | 'audio' | 'video'>> = {
  '.svg': 'imagen',
  '.png': 'imagen',
  '.webp': 'imagen',
  '.mp3': 'audio',
  '.ogg': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.mp4': 'video',
};

// Una barra normal o invertida. Sirve para separar las carpetas de una ruta escrita en cualquier sistema.
const SEPARADOR_DE_CARPETAS = /[\\/]/;

// Una ruta que empieza con un esquema de URL. Ejemplos que acepta: "https://sitio/a.svg", "data:image/png", "file:a".
const EMPIEZA_CON_ESQUEMA_DE_URL = /^[a-z][a-z0-9+.-]*:/i;

/** Dice si la ruta se puede usar para pedir un archivo dentro de una carpeta de assets. */
export function esRutaSeguraDeAsset(ruta: string): boolean {
  // Se revisa también la versión decodificada: "%2e%2e" es otra forma de escribir "..".
  const rutaDecodificada = decodificar(ruta).trim();

  if (rutaDecodificada === '') return false;

  const partes = rutaDecodificada.split(SEPARADOR_DE_CARPETAS);
  const subeDeCarpeta = partes.includes('..');
  const empiezaEnLaRaiz = partes[0] === '';
  const esUnaUrl = EMPIEZA_CON_ESQUEMA_DE_URL.test(rutaDecodificada);

  return !subeDeCarpeta && !empiezaEnLaRaiz && !esUnaUrl;
}

/** La extensión de un archivo, en minúsculas y con punto. Ejemplo: `'img/Foto.PNG'` → `'.png'`. Sin extensión, `''`. */
export function extensionDe(ruta: string): string {
  const nombre = nombreDeArchivoDe(ruta);
  const posicionDelPunto = nombre.lastIndexOf('.');
  if (posicionDelPunto <= 0) return '';
  return nombre.slice(posicionDelPunto).toLowerCase();
}

/** El nombre del archivo sin carpetas ni extensión. Ejemplo: `'img/spr_mama.svg'` → `'spr_mama'`. */
export function nombreSinExtensionDe(ruta: string): string {
  const nombre = nombreDeArchivoDe(ruta);
  const extension = extensionDe(ruta);
  return nombre.slice(0, nombre.length - extension.length);
}

/** Qué clase de asset es un archivo, por su extensión. `undefined` = no es un asset (se ignora). */
export function tipoDeArchivoDeAsset(ruta: string): 'imagen' | 'audio' | 'video' | undefined {
  const extension = extensionDe(ruta);
  if (!Object.hasOwn(TIPO_POR_EXTENSION, extension)) return undefined;
  return TIPO_POR_EXTENSION[extension];
}

function nombreDeArchivoDe(ruta: string): string {
  const partes = ruta.split(SEPARADOR_DE_CARPETAS);
  return partes[partes.length - 1]!; // `split` siempre devuelve al menos una parte
}

function decodificar(ruta: string): string {
  try {
    return decodeURIComponent(ruta);
  } catch (error) {
    // Un "%" mal escrito no se puede decodificar; en ese caso se revisa la ruta tal como llegó.
    if (error instanceof URIError) return ruta;
    throw error;
  }
}

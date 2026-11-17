// Decide si el motor puede pedir un archivo a una dirección (AGENTS.md §2, principio 5).
// Solo se permiten dos casos: el mismo sitio que la página, o un origen HTTPS que el host
// puso en `origenesPermitidos` (por ejemplo, su CDN).

/**
 * `direccion` puede ser completa (`https://...`) o relativa a la página.
 * `direccionDeLaPagina` es la dirección completa de la página que muestra el juego.
 */
export function esDireccionPermitida(
  direccion: string,
  direccionDeLaPagina: string,
  origenesPermitidos: readonly string[],
): boolean {
  const origenDeLaPagina = origenDe(direccionDeLaPagina, undefined);
  const destino = leerDireccion(direccion, direccionDeLaPagina);
  if (origenDeLaPagina === undefined || destino === undefined) return false;

  if (destino.origin === origenDeLaPagina) return true;

  // Fuera del propio sitio solo se acepta HTTPS, aunque el origen esté en la lista.
  if (destino.protocol !== 'https:') return false;
  for (const origenPermitido of origenesPermitidos) {
    if (origenDe(origenPermitido, undefined) === destino.origin) return true;
  }
  return false;
}

/** El origen de una dirección (`https://sitio.mx`), o `undefined` si la dirección no se entiende. */
function origenDe(direccion: string, base: string | undefined): string | undefined {
  const url = leerDireccion(direccion, base);
  if (url === undefined) return undefined;
  return url.origin;
}

function leerDireccion(direccion: string, base: string | undefined): URL | undefined {
  try {
    return new URL(direccion, base);
  } catch (error) {
    // `new URL` lanza TypeError cuando el texto no es una dirección; eso aquí significa «no permitida».
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

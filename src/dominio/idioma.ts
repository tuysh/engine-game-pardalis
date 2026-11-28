// Los idiomas que maneja el motor: español (lengua de las niñas y niños) e inglés (la que aprenden).

export type Idioma = 'es' | 'en';

/** El otro de los dos idiomas: el de la traducción de algo dicho en `idioma`. */
export function otroIdioma(idioma: Idioma): Idioma {
  return idioma === 'es' ? 'en' : 'es';
}

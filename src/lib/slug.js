import { normalitza } from './text'

/** Converteix un text en un identificador apte per a URLs i noms de
 *  fitxer: sense accents, en minúscules i amb guions. */
export function slug(text) {
  return normalitza(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

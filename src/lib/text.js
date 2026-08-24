// Funcions de text compartides.
//
// Treure els accents és el pas comú a tota l'app: comparar noms d'alumnes,
// cercar, generar claus... Cada lloc hi afegeix el que necessita (minúscules,
// guions, partir en paraules), però el pas d'accents és sempre el mateix i
// viu aquí, en un sol lloc: si algun dia cal canviar el criteri (per exemple,
// tractar la ç o la ñ d'una altra manera), es canvia només aquí.

/** Treu els accents i els diacrítics, deixant les lletres bàsiques. */
export function senseAccents(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Treu accents i passa a minúscules, per comparar text de manera tolerant. */
export function normalitza(text) {
  return senseAccents(text).toLowerCase().trim()
}

/**
 * Les paraules d'un text, en minúscules i sense accents ni signes.
 * S'usa per comparar noms escrits de maneres diferents.
 */
export function paraulesDe(text) {
  return normalitza(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Una clau per comparar noms: sense accents, minúscules i sense res que
 * no siguin lletres o números (espais, comes i guions inclosos). Així
 * "Pérez Mena, Pol-Conan" i "perez mena pol conan" donen la mateixa.
 */
export function clauDeText(text) {
  return normalitza(text).replace(/[^a-z0-9]/g, '')
}

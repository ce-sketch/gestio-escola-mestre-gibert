/** Treu accents i passa a minúscules, per comparar text de manera tolerant. */
export function normalitza(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Compatibilitat amb el codi que ja fa servir els 3 estats bàsics
// (Valoracions: cicles, comissions i comissions mixtes). El catàleg complet
// d'escales viu ara a `escales.js`; això només n'exposa la primera, que és
// la de sempre: No fet (0%) / En procés (40%) / Fet (100%).
import { ESCALES, opcioDe } from './escales'

export const ESTATS_EXECUCIO = ESCALES[0].opcions

export function estatDe(valor) {
  return opcioDe('execucio', valor)
}

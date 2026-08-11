// Valoracions de cicle/comissió/equip, fidels a l'estructura real dels
// fulls de càlcul "Valoració ..." del centre: Responsable, Membres, una
// llista d'Objectius (cada un amb Gener/Juny en %), i opcionalment — pels
// que ho necessitin (comissions/equips) — una llista d'"Actuacions" amb el
// seu propi indicador i percentatges, dins de cada objectiu.

export function actuacioBuida() {
  return { id: crypto.randomUUID(), text: '', indicador: '', gener: '', juny: '' }
}

export function objectiuBuit() {
  return { id: crypto.randomUUID(), text: '', gener: '', juny: '', actuacions: [] }
}

export function valoracioBuida() {
  return {
    responsable: '',
    membres: '',
    objectius: [objectiuBuit()],
    valoracioRevisio: '',
    valoracioFinal: '',
    metodologies: '',
    propostesMillora: '',
  }
}

// Alguns noms habituals, com a suggeriment ràpid — el camp és de text
// lliure, no un desplegable tancat, perquè cada curs poden variar.
export const CICLES = ['Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior']

export const NOMS_SUGGERITS = [
  'Comissió TAC', 'Comissió Material', 'Comissió Anglès', 'Comissió Biblioteca',
  'Comissió Espais',
  'Comissió de Transformem els Patis',
  "Equip d'Atenció a la Diversitat", 'Coordinació de Riscos Laborals', 'Equip LIC',
]

// Comissions que tenen relació directa amb l'AFA — es mostren en un botó a
// part dins de Valoracions, en comptes de barrejar-se amb la resta.
export const NOMS_AFA = ['Comissió Comunicació', 'Comissió Espai de migdia']

/** Mitjana de Gener/Juny d'un objectiu — si té actuacions, la mitjana és
 *  de les actuacions; si no, es fa servir el valor introduït directament
 *  a l'objectiu (com als cicles, que no desglossen en actuacions). */
export function mitjanaObjectiu(objectiu, camp) {
  if (objectiu.actuacions && objectiu.actuacions.length > 0) {
    const valors = objectiu.actuacions
      .filter((a) => a[camp] !== '' && a[camp] !== null && a[camp] !== undefined)
      .map((a) => Number(a[camp]))
    if (valors.length === 0) return null
    return valors.reduce((a, b) => a + b, 0) / valors.length
  }
  if (objectiu[camp] === '' || objectiu[camp] === null || objectiu[camp] === undefined) return null
  return Number(objectiu[camp])
}

/** Mitjana general de tots els objectius d'una valoració (equival al
 *  "Resultat PGAC" / "Grau d'assoliment dels objectius" del full original). */
export function mitjanaValoracio(valoracio, camp) {
  const valors = valoracio.objectius
    .map((o) => mitjanaObjectiu(o, camp))
    .filter((v) => v !== null)
  if (valors.length === 0) return null
  return valors.reduce((a, b) => a + b, 0) / valors.length
}

// Festes del curs (es mantenen com a valoració simple i separada).
export const FESTES = [
  { id: 'castanyada', label: 'Castanyada' },
  { id: 'nadal', label: 'Nadal' },
  { id: 'carnestoltes', label: 'Carnestoltes' },
  { id: 'mona', label: 'Mona' },
  { id: 'santjordi', label: 'Sant Jordi' },
  { id: 'gimcana', label: 'Gimcana i comiat' },
]

export function festesBuides() {
  const festes = {}
  for (const f of FESTES) festes[f.id] = ''
  return festes
}

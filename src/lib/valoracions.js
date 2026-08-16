// Valoracions de cicle/comissió/equip, fidels a l'estructura real dels
// fulls de càlcul "Valoració ..." del centre: Responsable, Membres, una
// llista d'Objectius (cada un amb Gener/Juny en %), i opcionalment — pels
// que ho necessitin (comissions/equips) — una llista d'"Actuacions" amb el
// seu propi indicador i percentatges, dins de cada objectiu.

export function actuacioBuida() {
  // Les actuacions de comissions i equips fan servir l'escala dels seus
  // fulls, on "En procés" val 50% (als fulls del PGAC en val 40).
  //
  // "dades" només s'omple als objectius de recollida (per exemple
  // "Enregistrar les dades del SIC"), on el full té columnes de text lliure
  // per a tres moments del curs. No entra mai al càlcul: el percentatge
  // segueix sortint del Fet/No fet, igual que al full original.
  return {
    id: crypto.randomUUID(),
    text: '', indicador: '', gener: '', juny: '',
    escala: 'execucio50', opcions: null,
    dades: { inici: '', gener: '', juny: '' },
  }
}

/** Els tres moments en què es recullen dades, tal com surten als fulls. */
export const MOMENTS_DADES = [
  { id: 'inici', label: 'Inici de curs' },
  { id: 'gener', label: 'Gener' },
  { id: 'juny', label: 'Juny' },
]

export function objectiuBuit() {
  // Els fulls de cicle no tenen estats: s'hi escriu el percentatge directament.
  return {
    id: crypto.randomUUID(), text: '', gener: '', juny: '',
    escala: 'lliure', opcions: null,
    recullDades: false,
    etiquetesDades: { inici: 'Inici de curs', gener: 'Gener', juny: 'Juny' },
    actuacions: [],
  }
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
  "Equip d'Atenció a la Diversitat", 'Coordinació de Riscos Laborals', 'Equip LIC',
  // L'Equip Directiu no és una comissió, però el seu full té la mateixa
  // estructura (Resum + un full per objectiu), així que va aquí mateix.
  'Equip Directiu',
]

// Comissions mixtes (amb participació de famílies/AFA) — es mostren en un
// botó a part dins de Valoracions, en comptes de barrejar-se amb la resta.
// L'AREP hi va perquè és un projecte amb una entitat de fora de l'escola,
// com les altres tres tenen participació de famílies o de l'AFA.
export const NOMS_AFA = [
  'Comissió Comunicació', 'Comissió Espai de migdia',
  'Comissió de Transformem els Patis', 'Jardins. AREP',
]

/**
 * Resultat d'un objectiu, tal com el calculen els fulls originals:
 * `=AVERAGE(...)` de les seves actuacions. Ull amb un detall que canvia molt
 * el número: als fulls, les actuacions vénen pre-omplertes amb "No fet", o
 * sigui que **les que no s'han valorat compten 0**, no s'ignoren. Si
 * s'ignoressin, una comissió amb un sol objectiu fet donaria 100% quan el
 * full real dona 10%.
 */
export function mitjanaObjectiu(objectiu, camp) {
  const actuacions = objectiu.actuacions ?? []
  if (actuacions.length > 0) {
    const suma = actuacions.reduce((total, a) => total + valorNumeric(a[camp]), 0)
    return suma / actuacions.length
  }
  if (objectiu[camp] === '' || objectiu[camp] === null || objectiu[camp] === undefined) return 0
  return Number(objectiu[camp])
}

/** Resultat de la valoració sencera: `=average(...)` de tots els objectius,
 *  comptant també els que encara no s'han valorat. */
export function mitjanaValoracio(valoracio, camp) {
  const objectius = valoracio.objectius ?? []
  if (objectius.length === 0) return null
  const suma = objectius.reduce((total, o) => total + (mitjanaObjectiu(o, camp) ?? 0), 0)
  return suma / objectius.length
}

function valorNumeric(v) {
  if (v === '' || v === null || v === undefined) return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

function esBuit(v) {
  return v === '' || v === null || v === undefined
}

/** Quantes caselles queden per valorar dins d'un objectiu, per poder-ho dir
 *  al costat del resultat: un 10% a l'octubre no és un mal resultat, és que
 *  encara no toca. */
export function pendentsObjectiu(objectiu, camp) {
  const actuacions = objectiu.actuacions ?? []
  if (actuacions.length > 0) {
    return { total: actuacions.length, valorats: actuacions.filter((a) => !esBuit(a[camp])).length }
  }
  return { total: 1, valorats: esBuit(objectiu[camp]) ? 0 : 1 }
}

/** El mateix, per a tota la valoració. */
export function pendentsValoracio(valoracio, camp) {
  return (valoracio.objectius ?? []).reduce((acc, o) => {
    const p = pendentsObjectiu(o, camp)
    return { total: acc.total + p.total, valorats: acc.valorats + p.valorats }
  }, { total: 0, valorats: 0 })
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

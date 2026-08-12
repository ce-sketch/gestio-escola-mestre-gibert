// Model detallat de valoració de festes, fidel a les plantilles reals:
// cada festa té uns Objectius (amb un pes % entre ells), i es desglossa
// per grup (Educació Infantil, Cicle Inicial, Cicle Mitjà, Cicle Superior,
// Equip Directiu, i a vegades Comissió festes / Equip de coordinació), amb
// un pes % entre grups. Dins de cada grup, cada objectiu té una llista
// d'activitats/indicadors, cadascuna amb un grau d'assoliment (escala de 6
// nivells, igual que als fulls originals).

export const GRUPS = ['Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior', 'Equip Directiu']

export const NIVELLS_GRAU = [
  { id: 'no_assolit', label: 'No assolit', valor: 0 },
  { id: 'baix', label: 'Baix', valor: 20 },
  { id: 'poc_satisfactori', label: 'Poc satisfactori', valor: 40 },
  { id: 'satisfactori', label: 'Satisfactori', valor: 60 },
  { id: 'bo', label: 'Bo', valor: 80 },
  { id: 'alt', label: 'Alt', valor: 100 },
]

export function activitatBuida() {
  return { id: crypto.randomUUID(), text: '', grau: '' }
}

export function objectiuFestaBuit(pes = 0) {
  return { id: crypto.randomUUID(), text: '', pes }
}

function grupBuit(objectius) {
  const perObjectiu = {}
  for (const o of objectius) perObjectiu[o.id] = { activitats: [], comentaris: '' }
  return perObjectiu
}

export function festaBuida(festaLabel) {
  const objectius = [objectiuFestaBuit(100)]
  const grups = {}
  for (const g of GRUPS) grups[g] = grupBuit(objectius)
  return {
    activitat: festaLabel,
    data: '',
    objectius,
    pesCicles: 80,
    pesEquipDirectiu: 20,
    grups,
  }
}

/** Mitjana d'un objectiu concret dins d'un grup — mitjana de les activitats
 *  que ja tenen un grau assignat. */
export function mitjanaObjectiuGrup(festa, grupNom, objectiuId) {
  const activitats = festa.grups?.[grupNom]?.[objectiuId]?.activitats ?? []
  if (activitats.length === 0) return null
  // Als fulls de festa les activitats vénen pre-omplertes amb "No assolit":
  // les que no s'han valorat compten 0, no s'ignoren.
  const suma = activitats.reduce((total, a) => {
    const n = Number(a.grau)
    return total + (a.grau === '' || a.grau === null || a.grau === undefined || Number.isNaN(n) ? 0 : n)
  }, 0)
  return suma / activitats.length
}

/** Quantes activitats queden per valorar dins d'un objectiu d'un grup. */
export function pendentsObjectiuGrup(festa, grupNom, objectiuId) {
  const activitats = festa.grups?.[grupNom]?.[objectiuId]?.activitats ?? []
  return {
    total: activitats.length,
    valorats: activitats.filter((a) => a.grau !== '' && a.grau !== null && a.grau !== undefined).length,
  }
}

/** Mitjana ponderada de tots els objectius d'un grup (fent servir el pes
 *  de cada objectiu). */
export function mitjanaGrup(festa, grupNom) {
  const parts = festa.objectius
    .map((o) => ({ valor: mitjanaObjectiuGrup(festa, grupNom, o.id), pes: Number(o.pes) || 0 }))
    .filter((p) => p.valor !== null)
  if (parts.length === 0) return null
  const pesTotal = parts.reduce((a, p) => a + p.pes, 0)
  if (pesTotal === 0) return parts.reduce((a, p) => a + p.valor, 0) / parts.length
  return parts.reduce((a, p) => a + p.valor * p.pes, 0) / pesTotal
}

/** Mitjana general de la festa: mitjana dels cicles (Infantil+CI+CM+CS)
 *  ponderada amb "pesCicles", i l'Equip Directiu ponderat amb
 *  "pesEquipDirectiu" — igual que als fulls originals ("Cicles: 80% /
 *  Equip directiu: 20%"). */
export function mitjanaGeneralFesta(festa) {
  const cicles = ['Educació Infantil', 'Cicle Inicial', 'Cicle Mitjà', 'Cicle Superior']
  const valorsCicles = cicles.map((g) => mitjanaGrup(festa, g)).filter((v) => v !== null)
  const mitjanaCicles = valorsCicles.length > 0 ? valorsCicles.reduce((a, b) => a + b, 0) / valorsCicles.length : null
  const mitjanaDirectiu = mitjanaGrup(festa, 'Equip Directiu')

  const parts = []
  if (mitjanaCicles !== null) parts.push({ valor: mitjanaCicles, pes: Number(festa.pesCicles) || 0 })
  if (mitjanaDirectiu !== null) parts.push({ valor: mitjanaDirectiu, pes: Number(festa.pesEquipDirectiu) || 0 })
  if (parts.length === 0) return null
  const pesTotal = parts.reduce((a, p) => a + p.pes, 0)
  if (pesTotal === 0) return parts.reduce((a, p) => a + p.valor, 0) / parts.length
  return parts.reduce((a, p) => a + p.valor * p.pes, 0) / pesTotal
}

// Model detallat de valoració de festes, fidel a les plantilles reals del
// centre.
//
// Com és de debò un full de festa
// -------------------------------
// Cada festa es desglossa per grup: els quatre cicles, l'Equip Directiu i
// l'Equip de coordinació. I **cada grup té els seus propis objectius**, que
// no són els mateixos ni en text ni en nombre: els cicles comparteixen els
// de la festa, però l'Equip Directiu en té de seus (valorar l'organització
// de l'exposició, els aspectes tècnics...). Per això els objectius pengen
// del grup i no de la festa.
//
// Dins de cada objectiu hi ha les activitats/indicadors, cadascuna amb el
// seu grau d'assoliment en una escala de sis nivells.
//
// Els pesos entre grups surten escrits als criteris del full
// ("Cicles: 80% · Equip de coordnació: 0% · Equip directiu: 20%") i són
// editables: l'Equip de coordinació avui no avalua, però podria fer-ho.

export const TIPUS_GRUP = { CICLE: 'cicle', DIRECTIU: 'directiu', COORDINACIO: 'coordinacio' }

export const GRUPS_PER_DEFECTE = [
  { nom: 'Educació Infantil', tipus: TIPUS_GRUP.CICLE },
  { nom: 'Cicle Inicial', tipus: TIPUS_GRUP.CICLE },
  { nom: 'Cicle Mitjà', tipus: TIPUS_GRUP.CICLE },
  { nom: 'Cicle Superior', tipus: TIPUS_GRUP.CICLE },
  { nom: 'Equip Directiu', tipus: TIPUS_GRUP.DIRECTIU },
  { nom: 'Equip de coordinació', tipus: TIPUS_GRUP.COORDINACIO },
]

/** Els noms, per reconèixer els fulls d'una plantilla. Al full del centre
 *  l'Equip de coordinació surt com a "Comissió de Festes". */
export const GRUPS = GRUPS_PER_DEFECTE.map((g) => g.nom)
export const NOMS_ALTERNATIUS = { 'Comissió de Festes': 'Equip de coordinació' }

export const PESOS_PER_DEFECTE = {
  [TIPUS_GRUP.CICLE]: 80,
  [TIPUS_GRUP.COORDINACIO]: 0,
  [TIPUS_GRUP.DIRECTIU]: 20,
}

// Escala de 6 nivells, CONFIRMADA amb el full de la Castanyada, on cada
// nivell surt al costat del seu percentatge (Alt 100%, Bo 80%,
// Satisfactori 60%, Poc satisfactori 40%, Baix 20%, No assolit 0%).
export const NIVELLS_GRAU = [
  { id: 'no_assolit', label: 'No assolit', valor: 0 },
  { id: 'baix', label: 'Baix', valor: 20 },
  { id: 'poc_satisfactori', label: 'Poc satisfactori', valor: 40 },
  { id: 'satisfactori', label: 'Satisfactori', valor: 60 },
  { id: 'bo', label: 'Bo', valor: 80 },
  { id: 'alt', label: 'Alt', valor: 100 },
]

/** El text del full ("Bo") passat a percentatge. */
export function grauDeText(text) {
  const net = (text ?? '').toString().trim().toLowerCase()
  if (!net) return ''
  const nivell = NIVELLS_GRAU.find((n) => n.label.toLowerCase() === net)
  return nivell ? nivell.valor : ''
}

export function activitatBuida() {
  return { id: crypto.randomUUID(), text: '', grau: '' }
}

export function objectiuFestaBuit(pes = 0) {
  return { id: crypto.randomUUID(), text: '', pes, activitats: [], comentaris: '' }
}

export function grupBuit(nom, tipus, objectius = []) {
  return { id: crypto.randomUUID(), nom, tipus, objectius }
}

/** Els tres objectius que porten els fulls de festa per defecte, amb els
 *  pesos escrits als criteris ("Objectiu 1: 30% · 2: 30% · 3: 40%"). */
export function objectiusPerDefecte() {
  return [objectiuFestaBuit(30), objectiuFestaBuit(30), objectiuFestaBuit(40)]
}

export function festaBuida(festaLabel) {
  return {
    activitat: festaLabel,
    data: '',
    pesos: { ...PESOS_PER_DEFECTE },
    grups: GRUPS_PER_DEFECTE.map((g) => grupBuit(g.nom, g.tipus, objectiusPerDefecte())),
  }
}

/**
 * Deixa qualsevol festa amb la forma d'ara.
 *
 * Les festes desades amb el model vell portaven els objectius a la festa i
 * un mapa de grups a part; aquí es reparteixen perquè cada grup tingui els
 * seus. Així el que ja s'hagi valorat no es perd.
 */
export function normalitzaFesta(festa) {
  if (!festa) return null
  if (Array.isArray(festa.grups)) {
    return {
      ...festa,
      pesos: { ...PESOS_PER_DEFECTE, ...(festa.pesos ?? {}) },
      grups: festa.grups.map((g) => ({
        ...g,
        objectius: (g.objectius ?? []).map((o) => ({
          comentaris: '', activitats: [], ...o,
        })),
      })),
    }
  }

  const objectiusFesta = festa.objectius ?? []
  const grups = GRUPS_PER_DEFECTE.map((def) => {
    const vell = festa.grups?.[def.nom] ?? {}
    return grupBuit(def.nom, def.tipus, objectiusFesta.map((o) => ({
      id: o.id,
      text: o.text,
      pes: o.pes,
      activitats: vell[o.id]?.activitats ?? [],
      comentaris: vell[o.id]?.comentaris ?? '',
    })))
  })

  return {
    activitat: festa.activitat ?? '',
    data: festa.data ?? '',
    pesos: {
      [TIPUS_GRUP.CICLE]: Number(festa.pesCicles ?? PESOS_PER_DEFECTE[TIPUS_GRUP.CICLE]),
      [TIPUS_GRUP.COORDINACIO]: PESOS_PER_DEFECTE[TIPUS_GRUP.COORDINACIO],
      [TIPUS_GRUP.DIRECTIU]: Number(festa.pesEquipDirectiu ?? PESOS_PER_DEFECTE[TIPUS_GRUP.DIRECTIU]),
    },
    grups,
  }
}

export function grupDe(festa, grupNom) {
  return (festa?.grups ?? []).find((g) => g.nom === grupNom) ?? null
}

/** Mitjana d'un objectiu: mitjana de les seves activitats. Als fulls les
 *  activitats vénen pre-omplertes amb "No assolit", o sigui que les que no
 *  s'han valorat compten 0, no s'ignoren. */
export function mitjanaObjectiu(objectiu) {
  const activitats = objectiu?.activitats ?? []
  if (activitats.length === 0) return null
  const suma = activitats.reduce((total, a) => {
    const n = Number(a.grau)
    return total + (a.grau === '' || a.grau === null || a.grau === undefined || Number.isNaN(n) ? 0 : n)
  }, 0)
  return suma / activitats.length
}

export function mitjanaObjectiuGrup(festa, grupNom, objectiuId) {
  const grup = grupDe(festa, grupNom)
  return mitjanaObjectiu((grup?.objectius ?? []).find((o) => o.id === objectiuId))
}

/** Quantes activitats queden per valorar dins d'un objectiu d'un grup. */
export function pendentsObjectiuGrup(festa, grupNom, objectiuId) {
  const grup = grupDe(festa, grupNom)
  const objectiu = (grup?.objectius ?? []).find((o) => o.id === objectiuId)
  const activitats = objectiu?.activitats ?? []
  return {
    total: activitats.length,
    valorats: activitats.filter((a) => a.grau !== '' && a.grau !== null && a.grau !== undefined).length,
  }
}

/** Mitjana ponderada dels objectius d'un grup, amb el pes de cada objectiu. */
export function mitjanaGrup(festa, grupNom) {
  const grup = grupDe(festa, grupNom)
  const parts = (grup?.objectius ?? [])
    .map((o) => ({ valor: mitjanaObjectiu(o), pes: Number(o.pes) || 0 }))
    .filter((p) => p.valor !== null)
  if (parts.length === 0) return null
  const pesTotal = parts.reduce((a, p) => a + p.pes, 0)
  if (pesTotal === 0) return parts.reduce((a, p) => a + p.valor, 0) / parts.length
  return parts.reduce((a, p) => a + p.valor * p.pes, 0) / pesTotal
}

/**
 * Mitjana general de la festa.
 *
 * Els cicles fan **mitjana** entre ells i el resultat entra amb el pes dels
 * cicles; l'Equip Directiu i l'Equip de coordinació entren amb el seu.
 * Un grup amb pes 0 no mou el resultat, que és el cas de la coordinació
 * mentre no avaluï.
 */
export function mitjanaGeneralFesta(festa) {
  const parts = []
  for (const tipus of [TIPUS_GRUP.CICLE, TIPUS_GRUP.DIRECTIU, TIPUS_GRUP.COORDINACIO]) {
    const valors = (festa?.grups ?? [])
      .filter((g) => g.tipus === tipus)
      .map((g) => mitjanaGrup(festa, g.nom))
      .filter((v) => v !== null)
    if (valors.length === 0) continue
    parts.push({
      valor: valors.reduce((a, b) => a + b, 0) / valors.length,
      pes: Number(festa?.pesos?.[tipus]) || 0,
    })
  }
  if (parts.length === 0) return null
  const pesTotal = parts.reduce((a, p) => a + p.pes, 0)
  if (pesTotal === 0) return parts.reduce((a, p) => a + p.valor, 0) / parts.length
  return parts.reduce((a, p) => a + p.valor * p.pes, 0) / pesTotal
}

// Reconeix quina mena de plantilla és un Excel i n'extreu el contingut,
// per poder-ne importar unes quantes de cop sense haver de dir de cada una
// on va.
//
// Com es distingeixen
// -------------------
// **Cicle contra comissió contra festa** es veu mirant els noms dels fulls:
//
//   Resum + "Objectiu 1", "Objectiu 2"…            → comissió o equip
//   Resum + "Educació Infantil", "Cicle Inicial"…  → festa
//   un sol full, sense Resum ni fulls d'objectiu   → cicle
//
// **Comissió contra comissió mixta NO es pot saber del document**: les dues
// plantilles són idèntiques. L'única cosa que les separa és el nom, comparat
// amb la llista de mixtes que hi ha configurada al Quadre de comandament.
// Per això qui importa sempre pot corregir el tipus abans d'aplicar res: una
// mixta que encara no sigui a la llista arribaria aquí com a comissió normal.
//
// Aquí no s'escriu res enlloc: només es llegeix i es diu què s'ha trobat.
// Desar-ho és feina de qui crida aquestes funcions.

import {
  interpretaResum, interpretaFullObjectiu, interpretaResumCicle,
} from './comissioTemplateParser'
import {
  interpretaFullGrupFesta, interpretaPesosFesta, interpretaPesosObjectius,
  interpretaCapcaleraFesta,
} from './festesPlantillaParser'
import { CICLES, objectiuBuit, actuacioBuida } from './valoracions'
import {
  GRUPS, GRUPS_PER_DEFECTE, NOMS_ALTERNATIUS, PESOS_PER_DEFECTE, grupBuit,
} from './festesDetall'

const ES_RESUM = /resum/i
const ES_OBJECTIU = /^objectiu\s*\d+$/i

export const TIPUS = [
  { id: 'cicle', label: 'Cicle' },
  { id: 'comissio', label: 'Comissió o equip' },
  { id: 'mixta', label: 'Comissió mixta' },
  { id: 'festa', label: 'Festa' },
]

/** Què és, mirant només els noms dels fulls. Encara no distingeix una
 *  comissió d'una mixta: això depèn del nom, no del document. */
export function classificaFulls(nomsDeFulls = []) {
  const noms = nomsDeFulls.map((n) => (n ?? '').trim()).filter(Boolean)
  const teResum = noms.some((n) => ES_RESUM.test(n))
  const teObjectius = noms.some((n) => ES_OBJECTIU.test(n))
  const nomsDeGrup = [...GRUPS, ...Object.keys(NOMS_ALTERNATIUS)]
  const teGrups = noms.some((n) => nomsDeGrup.some((g) => g.toLowerCase() === n.toLowerCase()))

  if (teResum && teObjectius) return 'comissio'
  if (teResum && teGrups) return 'festa'
  if (!teResum && !teObjectius) {
    // Les plantilles de cicle són d'un sol full. El nom del full varia:
    // a vegades és "Valoració", a vegades el nom del cicle mateix.
    if (noms.length === 1 || noms.some((n) => /valoraci/i.test(n))) return 'cicle'
  }
  return 'desconegut'
}

/** Afina el tipus amb el nom que s'ha llegit del full: els cicles i les
 *  comissions mixtes es reconeixen perquè el nom és a la seva llista. */
export function tipusAmbNom(tipus, nom, { cicles = CICLES, mixtes = [] } = {}) {
  if (tipus === 'festa' || tipus === 'desconegut') return tipus
  const net = (nom ?? '').trim().toLowerCase()
  if (!net) return tipus
  if (cicles.some((c) => c.toLowerCase() === net)) return 'cicle'
  if (mixtes.some((m) => m.toLowerCase() === net)) return 'mixta'
  return tipus === 'cicle' ? 'cicle' : 'comissio'
}

/**
 * Llegeix un llibre d'Excel ja obert i en treu el tipus, el nom i el
 * contingut, llest per desar.
 *
 * L'`XLSX` es passa de fora perquè la llibreria es carrega sota demanda
 * (`carregaLlibreries.js`) i aquest fitxer es pugui comprovar sense ella.
 *
 * @returns {{tipus: string, nom: string, resum: string, dades: Object|null}}
 */
export function analitzaLlibre(XLSX, workbook, { mixtes = [] } = {}) {
  const fulls = workbook.SheetNames ?? []
  const files = (nomFull) => XLSX.utils.sheet_to_json(workbook.Sheets[nomFull], { header: 1, raw: false })
  const busca = (prova) => fulls.find((n) => prova.test(n.trim()))

  const estructura = classificaFulls(fulls)

  if (estructura === 'festa') {
    const filesResum = files(busca(ES_RESUM) ?? fulls[0])
    const { activitat, data } = interpretaCapcaleraFesta(filesResum)
    const pesosGrup = interpretaPesosFesta(filesResum)
    const pesosObjectiu = interpretaPesosObjectius(filesResum)

    // Cada full que sigui d'un grup es llegeix sencer: els seus objectius,
    // les seves activitats i el grau que hi hagi marcat.
    const llegits = {}
    for (const nomFull of fulls) {
      const llegit = interpretaFullGrupFesta(files(nomFull))
      if (llegit && llegit.objectius.length > 0 && GRUPS.includes(llegit.nom)) {
        llegits[llegit.nom] = llegit
      }
    }

    if (!activitat || Object.keys(llegits).length === 0) {
      return { tipus: 'desconegut', nom: '', resum: "Sembla una festa, però no s'hi troben els fulls dels grups.", dades: null }
    }

    let totalActivitats = 0
    let totalValorades = 0
    const grups = GRUPS_PER_DEFECTE.map((def) => {
      const llegit = llegits[def.nom]
      const objectius = (llegit?.objectius ?? []).map((o, oi) => {
        totalActivitats += o.activitats.length
        totalValorades += o.activitats.filter((a) => a.grau !== '').length
        return {
          id: crypto.randomUUID(),
          text: o.text,
          // Els pesos només surten escrits per als tres objectius de la
          // festa; si un grup en té més (l'Equip Directiu, per exemple),
          // els que sobren queden a 0 i es reparteixen a mà.
          pes: pesosObjectiu[oi + 1] ?? 0,
          activitats: o.activitats.map((a) => ({ id: crypto.randomUUID(), text: a.text, grau: a.grau })),
          comentaris: oi === 0 ? (llegit?.comentaris ?? '') : '',
        }
      })
      return grupBuit(def.nom, def.tipus, objectius)
    })

    const festa = {
      activitat,
      data,
      pesos: { ...PESOS_PER_DEFECTE, ...pesosGrup },
      grups,
    }

    return {
      tipus: 'festa',
      nom: activitat,
      resum: `${Object.keys(llegits).length} grups · ${totalActivitats} activitats · ${totalValorades} ja valorades`,
      dades: { festa },
    }
  }

  if (estructura === 'comissio') {
    const { nom, responsable, membres, objectius: objectiusResum } = interpretaResum(files(busca(ES_RESUM) ?? fulls[0]))
    if (!nom || objectiusResum.length === 0) {
      return { tipus: 'desconegut', nom: '', resum: 'Sembla una comissió, però no s\'hi troba el nom o els objectius.', dades: null }
    }

    const objectius = objectiusResum.map(({ num, text }) => {
      const o = objectiuBuit()
      o.text = text
      const nomFullObjectiu = fulls.find((n) => new RegExp(`^objectiu\\s*${num}$`, 'i').test(n.trim()))
      if (nomFullObjectiu) {
        o.actuacions = interpretaFullObjectiu(files(nomFullObjectiu)).map(({ text: t, indicador }) => {
          const a = actuacioBuida()
          a.text = t
          a.indicador = indicador
          return a
        })
      }
      return o
    })

    const numActuacions = objectius.reduce((a, o) => a + o.actuacions.length, 0)
    return {
      tipus: tipusAmbNom('comissio', nom, { mixtes }),
      nom,
      resum: `${objectius.length} objectius · ${numActuacions} actuacions`,
      dades: { nom, responsable, membres, objectius, metodologies: '' },
    }
  }

  if (estructura === 'cicle') {
    const nomFull = busca(/valoraci/i) ?? fulls[0]
    const { nom, responsable, membres, objectius: textos, metodologies } = interpretaResumCicle(files(nomFull))
    const nomCicle = CICLES.find((c) => c.toLowerCase() === (nom ?? '').toLowerCase()) ?? nom
    if (!nomCicle || textos.length === 0) {
      return { tipus: 'desconegut', nom: '', resum: 'Sembla un cicle, però no s\'hi troba el nom o els objectius.', dades: null }
    }

    const objectius = textos.map((text) => {
      const o = objectiuBuit()
      o.text = text
      return o
    })
    return {
      tipus: tipusAmbNom('cicle', nomCicle, { mixtes }),
      nom: nomCicle,
      resum: `${objectius.length} objectius`,
      dades: { nom: nomCicle, responsable, membres, objectius, metodologies },
    }
  }

  return {
    tipus: 'desconegut',
    nom: '',
    resum: 'No s\'ha reconegut: hauria de tenir un full "Resum" amb fulls "Objectiu N" o de grup, o ser una plantilla de cicle d\'un sol full.',
    dades: null,
  }
}

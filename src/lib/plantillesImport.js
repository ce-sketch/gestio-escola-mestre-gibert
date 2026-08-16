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
  interpretaResumFesta, interpretaFullGrupFesta,
} from './comissioTemplateParser'
import { CICLES, objectiuBuit, actuacioBuida } from './valoracions'
import { GRUPS, festaBuida, objectiuFestaBuit, activitatBuida } from './festesDetall'

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
  const teGrups = noms.some((n) => GRUPS.some((g) => g.toLowerCase() === n.toLowerCase()))

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
    const resumFesta = interpretaResumFesta(files(busca(ES_RESUM) ?? fulls[0]))
    if (!resumFesta.activitat || resumFesta.objectius.length === 0) {
      return { tipus: 'desconegut', nom: '', resum: 'Sembla una festa, però no s\'hi troben els objectius.', dades: null }
    }

    const festa = festaBuida(resumFesta.activitat)
    festa.data = resumFesta.data
    festa.pesCicles = resumFesta.pesCicles
    festa.pesEquipDirectiu = resumFesta.pesEquipDirectiu
    festa.objectius = resumFesta.objectius.map(({ num, text, pes }) => {
      const o = objectiuFestaBuit(pes)
      o.text = text
      o._num = num // temporal, per emparellar amb els fulls de grup
      return o
    })

    const grups = {}
    let totalActivitats = 0
    for (const g of GRUPS) {
      grups[g] = {}
      const nomFullGrup = fulls.find((n) => n.trim().toLowerCase() === g.toLowerCase())
      const perObjectiu = nomFullGrup ? interpretaFullGrupFesta(files(nomFullGrup), resumFesta.objectius) : {}
      for (const o of festa.objectius) {
        const textos = perObjectiu[o._num] ?? []
        totalActivitats += textos.length
        grups[g][o.id] = {
          activitats: textos.map(({ text }) => { const a = activitatBuida(); a.text = text; return a }),
          comentaris: '',
        }
      }
    }
    festa.grups = grups
    festa.objectius.forEach((o) => { delete o._num })

    return {
      tipus: 'festa',
      nom: resumFesta.activitat,
      resum: `${festa.objectius.length} objectius · ${totalActivitats} activitats`,
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

// Exportació i restauració de les dades en cru.
//
// El backup de sempre genera CSV, que van molt bé per llegir i per obrir
// amb l'Excel, però **no serveixen per tornar a entrar les dades**: perden
// els identificadors dels documents, els tipus i les dates. Per poder
// restaurar de debò, el .zip porta també una carpeta `dades/` amb un JSON
// per col·lecció, tal com són a Firestore.
//
// ⚠️ Què es pot restaurar i què no
// --------------------------------
// Les regles de Firestore prohibeixen modificar i esborrar registres
// d'`assistencia` i `avaluacio` — és a posta: l'historial d'un centre no
// s'ha de poder sobreescriure. Això vol dir que la restauració
// **afegeix el que falta però no toca el que ja hi ha** en aquestes dues.
// A la resta (configuració, valoracions, PGAC…) sí que sobreescriu.
//
// No és una limitació que convingui saltar-se: és la que impedeix que un
// restore mal fet s'endugui per davant les notes d'un curs sencer.

import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

/** Les col·leccions que entren al backup, i com es tracten en restaurar. */
export const COL·LECCIONS = [
  { id: 'alumnes', nom: 'Alumnes', sobreescriu: true },
  { id: 'assistencia', nom: 'Assistència', sobreescriu: false },
  { id: 'avaluacio', nom: 'Avaluació', sobreescriu: false },
  { id: 'calendari', nom: 'Calendari', sobreescriu: true },
  { id: 'pgac', nom: 'PGAC', sobreescriu: true },
  { id: 'valoracions', nom: 'Valoracions', sobreescriu: true },
  { id: 'valoracionsConfig', nom: 'Configuració de valoracions', sobreescriu: true },
  { id: 'festesDetall', nom: 'Festes', sobreescriu: true },
  { id: 'activitatsComplementariesDetall', nom: 'Activitats complementàries', sobreescriu: true },
  { id: 'aprenentatgeCooperatiu', nom: 'Aprenentatge cooperatiu', sobreescriu: true },
  { id: 'economia', nom: 'Economia', sobreescriu: true },
  { id: 'documentacio', nom: 'Documentació', sobreescriu: true },
  { id: 'configuracio', nom: 'Configuració', sobreescriu: true },
]

/** Els Timestamp de Firestore no són JSON: es desen com a text ISO. */
function aJson(valor) {
  if (valor === null || valor === undefined) return valor
  if (typeof valor?.toDate === 'function') {
    return { __data: valor.toDate().toISOString() }
  }
  if (Array.isArray(valor)) return valor.map(aJson)
  if (typeof valor === 'object') {
    const sortida = {}
    for (const [k, v] of Object.entries(valor)) sortida[k] = aJson(v)
    return sortida
  }
  return valor
}

/** El camí de tornada: el text ISO torna a ser una data. */
function deJson(valor) {
  if (valor === null || valor === undefined) return valor
  if (typeof valor === 'object' && typeof valor.__data === 'string') {
    return new Date(valor.__data)
  }
  if (Array.isArray(valor)) return valor.map(deJson)
  if (typeof valor === 'object') {
    const sortida = {}
    for (const [k, v] of Object.entries(valor)) sortida[k] = deJson(v)
    return sortida
  }
  return valor
}

/**
 * Llegeix totes les col·leccions i les retorna llestes per desar al .zip.
 * @returns {Promise<{dades: Object, comptadors: Object}>}
 */
export async function exportaDadesCrues() {
  const dades = {}
  const comptadors = {}
  for (const col of COL·LECCIONS) {
    try {
      const snap = await getDocs(collection(db, col.id))
      dades[col.id] = snap.docs.map((d) => ({ id: d.id, ...aJson(d.data()) }))
      comptadors[col.id] = snap.docs.length
    } catch {
      // Una col·lecció que encara no existeix no és cap error.
      dades[col.id] = []
      comptadors[col.id] = 0
    }
  }
  return { dades, comptadors }
}

/**
 * Mira què hi ha dins d'un backup, sense tocar res.
 * @param {Object} dades  el contingut de dades/*.json
 */
export function inspeccionaBackup(dades) {
  return COL·LECCIONS.map((col) => ({
    ...col,
    documents: Array.isArray(dades?.[col.id]) ? dades[col.id].length : 0,
  })).filter((c) => c.documents > 0)
}

/**
 * Torna a entrar les dades d'un backup.
 *
 * @param {Object} dades
 * @param {Object} opcions
 * @param {string[]} opcions.nomes      només aquestes col·leccions
 * @param {Function} opcions.onProgres  (nom, fets, total)
 * @returns {Promise<{escrits: Object, omesos: Object, errors: Array}>}
 */
export async function restauraDades(dades, { nomes = null, onProgres } = {}) {
  const escrits = {}
  const omesos = {}
  const errors = []

  for (const col of COL·LECCIONS) {
    if (nomes && !nomes.includes(col.id)) continue
    const documents = Array.isArray(dades?.[col.id]) ? dades[col.id] : []
    if (documents.length === 0) continue

    escrits[col.id] = 0
    omesos[col.id] = 0

    // Les col·leccions que no es poden sobreescriure: només s'hi afegeix
    // el que no hi és. Es mira abans per no fer peticions condemnades.
    let jaExisteixen = new Set()
    if (!col.sobreescriu) {
      try {
        const snap = await getDocs(collection(db, col.id))
        jaExisteixen = new Set(snap.docs.map((d) => d.id))
      } catch {
        jaExisteixen = new Set()
      }
    }

    const aEscriure = documents.filter((d) => {
      if (!d?.id) return false
      if (!col.sobreescriu && jaExisteixen.has(d.id)) {
        omesos[col.id]++
        return false
      }
      return true
    })

    for (let i = 0; i < aEscriure.length; i += 400) {
      const lot = writeBatch(db)
      for (const d of aEscriure.slice(i, i + 400)) {
        const { id, ...camps } = d
        lot.set(doc(db, col.id, id), deJson(camps))
      }
      try {
        await lot.commit()
        escrits[col.id] += Math.min(400, aEscriure.length - i)
      } catch (err) {
        errors.push(`${col.nom}: ${err.message}`)
        break
      }
      onProgres?.(col.nom, Math.min(i + 400, aEscriure.length), aEscriure.length)
    }
  }

  return { escrits, omesos, errors }
}

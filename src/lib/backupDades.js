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
  { id: 'sic', nom: 'SIC (indicadors de centre)', sobreescriu: true },
  // Els cursos d'abans de l'app: si es perdessin, caldria tornar a
  // importar els fulls antics un per un.
  { id: 'historicNotaArea', nom: 'Històric de notes per àrea', sobreescriu: true },
  // L'històric de TEE i VL/CL. Té un botó propi a Backup que el baixa en
  // el format que espera "Importa l'històric", però també ha de ser al
  // .zip general: és l'única cosa que NO es pot reconstruir des de l'app
  // (ve de l'Eina d'avaluació), i si un dia calgués restaurar-ho tot,
  // sense això es perdria.
  { id: 'historicProves', nom: 'Històric de proves (TEE i VL/CL)', sobreescriu: true },
  // Les "versions amb nom" de la llista d'alumnes. Són instantànies que
  // algú ha desat expressament abans de fer un canvi gros: si es
  // perdessin, es perdria justament la xarxa de seguretat.
  { id: 'versions', nom: 'Versions desades', sobreescriu: false },
  // Quines classes passen cada prova. Si es perdés, els resums i la
  // matriu tornarien a marcar en vermell coses que no s'han de fer.
  { id: 'provesActives', nom: 'Proves que es passen', sobreescriu: true },
  { id: 'valoracions', nom: 'Valoracions', sobreescriu: true },
  { id: 'valoracionsConfig', nom: 'Configuració de valoracions', sobreescriu: true },
  { id: 'festesDetall', nom: 'Festes', sobreescriu: true },
  { id: 'activitatsComplementariesDetall', nom: 'Activitats complementàries', sobreescriu: true },
  { id: 'aprenentatgeCooperatiu', nom: 'Aprenentatge cooperatiu', sobreescriu: true },
  { id: 'matematiques', nom: 'Matemàtiques', sobreescriu: true },
  { id: 'lectoescripturaEI', nom: 'Lectoescriptura EI', sobreescriu: true },
  { id: 'economia', nom: 'Economia', sobreescriu: true },
  { id: 'documentacio', nom: 'Documentació', sobreescriu: true },
  // L'històric d'altes i baixes de SIEI/EE fetes a mà des d'Atenció a la
  // diversitat. No es pot reconstruir (no ve de cap full extern) — si es
  // perdés, es perdria constància de qui i quan va donar d'alta o de
  // baixa cada alumne.
  { id: 'diversitatHistoric', nom: 'Històric SIEI/EE', sobreescriu: false },
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

// ── Quan toca fer-ne una ───────────────────────────────────────────────

/**
 * Dies a partir dels quals es considera que la còpia s'ha quedat antiga.
 *
 * Trenta dies vol dir "un cop al mes com a mínim". No és una còpia
 * diària: d'això se n'ha d'encarregar la còpia programada de Firestore,
 * que no depèn que ningú entri a l'app. Aquesta és la que treu les dades
 * de Google en fitxers que es poden obrir, i per a això té sentit fer-la
 * als moments que compten (final de trimestre, abans d'un canvi gros).
 */
export const DIES_AVIS_BACKUP = 30

/**
 * Quants dies fa de l'última còpia, i si ja toca fer-ne una altra.
 *
 * Es comparteix entre el mòdul Backup i la pantalla d'Inici perquè els
 * dos diguin el mateix: si cadascun portés el seu llindar, un podria
 * avisar i l'altre no.
 *
 * @param {Date|null} ultimBackup
 */
export function estatBackup(ultimBackup, ara = new Date()) {
  if (!ultimBackup) return { dies: null, antic: true, maiFet: true }
  const dies = Math.floor((ara.getTime() - ultimBackup.getTime()) / (1000 * 60 * 60 * 24))
  return { dies, antic: dies > DIES_AVIS_BACKUP, maiFet: false }
}

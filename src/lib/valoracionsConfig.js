// Configuració de quines comissions/equips i festes estan actives cada
// curs escolar — controlada només per l'administrador des del "Quadre de
// comandament". Els docents, des de "Documentació", només veuen com a
// opció el que està marcat com a actiu aquí.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { NOMS_SUGGERITS, FESTES } from './valoracions'

function idConfig(cursEscolarId) {
  return cursEscolarId
}

/** Retorna la configuració d'aquest curs — si encara no s'ha desat mai,
 *  tot surt actiu per defecte (els suggeriments habituals + totes les
 *  festes), perquè no calgui configurar res abans de poder-ho fer servir. */
export async function carregaConfigValoracions(cursEscolarId) {
  const snap = await getDoc(doc(db, 'valoracionsConfig', idConfig(cursEscolarId)))
  if (snap.exists()) {
    const dades = snap.data()
    return {
      comissions: dades.comissions ?? NOMS_SUGGERITS.map((nom) => ({ nom, activa: true })),
      // Les festes desades poden ser-ne de noves, que no surten a la
      // llista fixa: per això cada una porta la seva etiqueta.
      festes: (dades.festes ?? FESTES.map((f) => ({ id: f.id, activa: true })))
        .map((f) => ({ ...f, label: f.label ?? FESTES.find((x) => x.id === f.id)?.label ?? f.id })),
    }
  }
  return {
    comissions: NOMS_SUGGERITS.map((nom) => ({ nom, activa: true })),
    festes: FESTES.map((f) => ({ id: f.id, label: f.label, activa: true })),
  }
}

export async function desaConfigValoracions(cursEscolarId, config) {
  await setDoc(doc(db, 'valoracionsConfig', idConfig(cursEscolarId)), {
    ...config,
    actualitzatEl: serverTimestamp(),
    actualitzatPer: auth.currentUser?.email ?? null,
  })
}

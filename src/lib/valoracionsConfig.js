// Configuració de quines comissions/equips, comissions mixtes i festes
// estan actives cada curs escolar — controlada només per l'administrador
// des del "Quadre de comandament". Els docents, des de "Documentació",
// només veuen com a opció el que està marcat com a actiu aquí.
//
// Aquí només hi ha l'anada i tornada a Firestore: quina forma té la
// configuració i què se'n desprèn viu a `valoracions.js`, que es pot
// comprovar.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { normalitzaConfigValoracions } from './valoracions'

function idConfig(cursEscolarId) {
  return cursEscolarId
}

/** Retorna la configuració d'aquest curs — si encara no s'ha desat mai,
 *  tot surt actiu per defecte (els suggeriments habituals, les quatre
 *  comissions mixtes i totes les festes), perquè no calgui configurar res
 *  abans de poder-ho fer servir. */
export async function carregaConfigValoracions(cursEscolarId) {
  const snap = await getDoc(doc(db, 'valoracionsConfig', idConfig(cursEscolarId)))
  return normalitzaConfigValoracions(snap.exists() ? snap.data() : null)
}

export async function desaConfigValoracions(cursEscolarId, config) {
  await setDoc(doc(db, 'valoracionsConfig', idConfig(cursEscolarId)), {
    ...config,
    actualitzatEl: serverTimestamp(),
    actualitzatPer: auth.currentUser?.email ?? null,
  })
}

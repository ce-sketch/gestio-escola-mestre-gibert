// Desat/recuperació de "versions amb nom" — de moment només instantanegen
// la llista d'alumnes (és l'únic que es pot restaurar de debò de manera
// segura; assistència i avaluació només queden com a .zip descarregable
// des del mòdul Backup, sense restore automàtic).

import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { cursEscolarActual } from './cursEscolar'

export async function carregaVersions(n = 10) {
  try {
    const snap = await getDocs(query(collection(db, 'versions'), orderBy('creatEl', 'desc'), limit(n)))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    return []
  }
}

export async function desaVersio(nom) {
  const alumnesSnap = await getDocs(collection(db, 'alumnes'))
  const alumnes = alumnesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  await setDoc(doc(collection(db, 'versions')), {
    nom: nom?.trim() || `Còpia del ${new Date().toLocaleDateString('ca-ES')}`,
    cursEscolar: cursEscolarActual(),
    creatEl: serverTimestamp(),
    creatPer: auth.currentUser?.email ?? null,
    comptadors: { alumnes: alumnes.length },
    alumnesSnapshot: JSON.stringify(alumnes),
  })
  return alumnes.length
}

export async function restauraVersio(versio) {
  const alumnesNous = JSON.parse(versio.alumnesSnapshot)

  const actualSnap = await getDocs(collection(db, 'alumnes'))
  for (let i = 0; i < actualSnap.docs.length; i += 500) {
    const batch = writeBatch(db)
    for (const d of actualSnap.docs.slice(i, i + 500)) batch.delete(doc(db, 'alumnes', d.id))
    await batch.commit()
  }

  for (let i = 0; i < alumnesNous.length; i += 500) {
    const batch = writeBatch(db)
    for (const a of alumnesNous.slice(i, i + 500)) {
      const { id, ...dades } = a
      batch.set(doc(db, 'alumnes', id), dades)
    }
    await batch.commit()
  }

  return alumnesNous.length
}

// Carrega les dades que fan servir totes les pantalles de resum de "Notes
// per àrea" (Resum per àrea i Àrees no superades): la llista d'alumnes i
// tots els registres de notes desats.
//
// Cada pantalla la crida per separat — no és una consulta compartida en
// temps real — perquè cadascuna viu al seu propi fitxer i pot obrir-se
// sense haver passat abans per les altres.

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../firebase'

export function useNotesAreaDades() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    let viu = true
    async function carrega() {
      try {
        const [snapAlumnes, snapNotes] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          // Filtrem només per 'tipus' aquí (sense combinar més camps en la
          // consulta) per no necessitar crear cap índex compost nou a
          // Firestore. Amb el volum d'alumnes del centre, filtrar la resta
          // (curs escolar, trimestre, classe...) al navegador va prou bé.
          getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area'))),
        ])
        if (!viu) return
        setAlumnesTots(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
        setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        if (viu) setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        if (viu) setCarregant(false)
      }
    }
    carrega()
    return () => { viu = false }
  }, [])

  return { alumnesTots, registres, carregant, missatge }
}

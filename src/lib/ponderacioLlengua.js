import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { grauPrimaria } from './rubricaLectura'

// Ponderació de la qualificació de l'àmbit lingüístic (català i castellà),
// extreta del quadre informatiu que porta cada pestanya de classe del full
// "Nota mitjana d'àrea" del centre (secció "Ponderació qualificació de
// l'àmbit lingüístic"). Canvia per nivell:
//   - 1r: tres períodes diferents, un per trimestre
//   - 2n: dos períodes — el 1r trimestre sol, i 2n+3r junts
//   - 3r a 6è: un sol període per a tot el curs (les tres avaluacions es
//     ponderen igual)
//
// Els percentatges es guarden tal com surten al full (text, no número):
// "Comprensió lectora" no és mai un sol percentatge net, sinó una
// combinació ("30% (CL)+10% lect."), i convertir-ho a número ara mateix
// no aportaria res — la pantalla només l'ha de mostrar, no calcular-la
// encara (pendent de lligar-ho amb TEE/CL/VL).
//
// Aquests valors de sota són només el PUNT DE PARTIDA (`PONDERACIO_DEFECTE`):
// l'administrador els pot editar des de la pantalla, i el que hi hagi
// desat a Firestore (`configuracio/ponderacioLlengua`) mana per sobre.
// Si mai no s'hi ha desat res, es fan servir aquests de defecte — així
// no calia configurar res abans de poder-los veure.
export const PONDERACIO_DEFECTE = {
  '1r': {
    periodes: [
      { id: '1r trimestre', comunicacioOral: '40%', expressioEscrita: '20%', comprensioLectora: '30%' },
      { id: '2n trimestre', comunicacioOral: '30%', expressioEscrita: '30%', comprensioLectora: '30%' },
      { id: '3r trimestre', comunicacioOral: '30%', expressioEscrita: '30%', comprensioLectora: '30% (CL) + 10% lect.' },
    ],
  },
  '2n': {
    periodes: [
      { id: '1r trimestre', comunicacioOral: '30%', expressioEscrita: '30%', comprensioLectora: '30% (CL) + 10% lect.' },
      { id: '2n i 3r trimestre', comunicacioOral: '20%', expressioEscrita: '40%', comprensioLectora: '30% (CL) + 10% lect.' },
    ],
  },
  // 3r a 6è: mateixos percentatges tots quatre nivells, un sol període.
  '3r-6e': {
    periodes: [
      { id: 'Tot el curs', comunicacioOral: '20%', expressioEscrita: '40%', comprensioLectora: '30% (CL) + 10% lect.' },
    ],
  },
}

/** "1r A" → '1r'/'2n'/'3r-6e', o null si no en té (Infantil, o un nom de
 *  classe no reconegut). */
export function grupNivell(curs) {
  const grau = grauPrimaria(curs)
  if (grau === 1) return '1r'
  if (grau === 2) return '2n'
  if (grau >= 3 && grau <= 6) return '3r-6e'
  return null
}

/**
 * La taula de ponderació que toca a una classe, segons el seu nivell.
 * Torna `null` per a Infantil o per a un nom de classe no reconegut.
 *
 * @param {string} curs
 * @param {object} [config] el que torna `carregaPonderacioLlengua()` —
 *   si no se li passa res, fa servir sempre els valors de defecte.
 */
export function taulaPonderacioLlengua(curs, config = PONDERACIO_DEFECTE) {
  const grup = grupNivell(curs)
  if (!grup) return null
  return config?.[grup] ?? PONDERACIO_DEFECTE[grup]
}

/** Carrega la configuració desada a Firestore — si encara no s'hi ha
 *  desat res, torna els valors de defecte tal qual, perquè la pantalla
 *  ja els pugui mostrar (i l'administrador editar-los) sense haver
 *  d'inicialitzar res abans. */
export async function carregaPonderacioLlengua() {
  const snap = await getDoc(doc(db, 'configuracio', 'ponderacioLlengua'))
  if (!snap.exists()) return PONDERACIO_DEFECTE
  const dades = snap.data()
  // Per si mai es desa una configuració parcial (només un nivell tocat):
  // els altres nivells segueixen sent els de defecte, no desapareixen.
  return { ...PONDERACIO_DEFECTE, ...dades }
}

export async function desaPonderacioLlengua(config) {
  await setDoc(doc(db, 'configuracio', 'ponderacioLlengua'), {
    '1r': config['1r'],
    '2n': config['2n'],
    '3r-6e': config['3r-6e'],
    actualitzatEl: serverTimestamp(),
    actualitzatPer: auth.currentUser?.email ?? null,
  })
}

import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

const ABSENT_STATES = new Set(['absent_justificat', 'absent_injustificat'])
const RETARD_STATES = new Set(['retard_justificat', 'retard_injustificat'])
const INJUSTIFICAT_STATES = new Set(['absent_injustificat', 'retard_injustificat'])

/**
 * Descarrega tots els registres d'assistència d'una classe i els filtra pel
 * rang de dates indicat. Es demana per classe (no per data) perquè una
 * consulta amb dues igualtats (curs + data) requeriria un índex compost a
 * Firestore que no volem obligar a crear manualment.
 */
export async function carregaRegistresPeriode(curs, dataInici, dataFi) {
  const q = query(collection(db, 'assistencia'), where('curs', '==', curs))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.data >= dataInici && r.data <= dataFi)
}

/** Es queda només amb el registre més recent per cada alumne+data+torn
 *  (una correcció posterior sempre substitueix la marca anterior). */
function redueixVigents(registres) {
  const mapa = new Map()
  for (const r of registres) {
    const clau = `${r.alumneId}-${r.data}-${r.torn}`
    const existent = mapa.get(clau)
    if (!existent || (r.creatEl?.seconds ?? 0) > (existent.creatEl?.seconds ?? 0)) {
      mapa.set(clau, r)
    }
  }
  return [...mapa.values()]
}

/**
 * Calcula, per cada alumne d'una classe, els índexs d'absentisme i
 * puntualitat d'un període (normalment un trimestre).
 */
export function calculaIndexos(alumnesClasse, registresPeriode, diesLectius) {
  const vigents = redueixVigents(registresPeriode)
  const totalSessions = diesLectius * 2 // matí + tarda

  return alumnesClasse.map((alumne) => {
    const delAlumne = vigents.filter((r) => r.alumneId === alumne.id)
    const absencies = delAlumne.filter((r) => ABSENT_STATES.has(r.estat))
    const absenciesInjust = absencies.filter((r) => INJUSTIFICAT_STATES.has(r.estat))
    const retards = delAlumne.filter((r) => RETARD_STATES.has(r.estat))
    const retardsInjust = retards.filter((r) => INJUSTIFICAT_STATES.has(r.estat))

    const indexAbsentisme = totalSessions > 0 ? (absencies.length / totalSessions) * 100 : 0
    const indexInjustificat = totalSessions > 0 ? (absenciesInjust.length / totalSessions) * 100 : 0

    return {
      alumne,
      absencies: absencies.length,
      absenciesInjust: absenciesInjust.length,
      retards: retards.length,
      retardsInjust: retardsInjust.length,
      indexAbsentisme,
      indexInjustificat,
    }
  })
}

/** Nivell d'alerta segons l'índex NO JUSTIFICAT (és el que compta de cara als llindars). */
export function nivellAlerta(indexInjustificat) {
  if (indexInjustificat >= 25) return 'greu'
  if (indexInjustificat >= 10) return 'atencio'
  return null
}

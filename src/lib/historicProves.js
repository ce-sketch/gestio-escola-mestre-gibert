// Històric de resultats de les proves internes (TEE i VL/CL).
//
// ON VIUEN LES DADES: A FIRESTORE, NO AQUÍ
// -----------------------------------------
// Aquest fitxer només té l'estructura i els càlculs. Els registres viuen a
// la col·lecció `historicProves` de Firestore, protegida per una regla que
// només deixa llegir l'administrador.
//
// El motiu és important: **tot el que s'escriu dins de l'app arriba al
// navegador de qualsevol que hi entri**. Si les xifres fossin en aquest
// fitxer, amagar la pestanya del menú no serviria de res — qualsevol
// docent amb coneixements les trobaria mirant el codi de la pàgina. Per
// això s'han tret d'aquí, encara que fos més còmode tenir-les a mà.
//
// D'ON SURTEN
// -----------
// De les pestanyes "Resultats TEE" i "Resultats VLCL" de l'Eina
// d'avaluació PGAC del centre, llegides del full tal com hi són. NO s'han
// recalculat ni arrodonit: són el registre històric del centre. Si un any
// surt rar (el 19/20 de pandèmia, per exemple), és que al full també.
//
// Rellegit el 20 d'agost del 2026, després que la direcció corregís al
// full el total de VL del 1r trimestre 24/25 i les fórmules de percentatge
// del 1r trimestre 23/24. Comprovat que els 132 percentatges de VL/CL i
// els 36 del TEE quadren amb els seus recomptes.
//
// Els percentatges NO es desen: es calculen a partir dels recomptes, que
// és l'única xifra que no es pot recuperar si es perd.
//
// COM CREIX
// ---------
// El curs en marxa NO s'afegeix a mà: el mòdul "Històric" el calcula sol a
// partir del que hi ha a Firestore i l'enganxa al final de la sèrie.

/** Els quatre nivells de l'escala comuna, en l'ordre del full. */
export const NIVELLS_HISTORIC = [
  { id: 'na', label: 'No Assoliment', curt: 'NA' },
  { id: 'asat', label: 'Assoliment Satisfactòri', curt: 'AS' },
  { id: 'anot', label: 'Assoliment Notable', curt: 'AN' },
  { id: 'aexc', label: 'Assoliment Excel·lent', curt: 'AE' },
]



// ── Càlculs ─────────────────────────────────────────────────────────────

/** Percentatges d'un registre, calculats a partir dels recomptes. */
export function percentatges(registre, total = registre?.total) {
  const suma = NIVELLS_HISTORIC.reduce((t, n) => t + (Number(registre?.[n.id]) || 0), 0)
  // Si el total apuntat no hi és o no quadra, es fa servir la suma dels
  // recomptes, que és l'única xifra que no es contradiu a si mateixa.
  const base = Number(total) || suma
  if (!base) return Object.fromEntries(NIVELLS_HISTORIC.map((n) => [n.id, null]))
  return Object.fromEntries(
    NIVELLS_HISTORIC.map((n) => [n.id, registre?.[n.id] === null || registre?.[n.id] === undefined
      ? null
      : Math.round((Number(registre[n.id]) / base) * 1000) / 10])
  )
}

/**
 * Files de l'històric on els recomptes no sumen el total que hi ha
 * apuntat. Són incoherències que ja venen del full original: aquí no es
 * corregeixen (seria inventar-se el passat), però es fan visibles perquè
 * es puguin revisar contra el document del centre.
 */
export function avisosHistoric({ tee = [], vlcl = [] } = {}) {
  const avisos = []
  const revisa = (etiqueta, registre) => {
    const suma = NIVELLS_HISTORIC.reduce((t, n) => t + (Number(registre[n.id]) || 0), 0)
    const total = Number(registre.total)
    if (total && suma && Math.abs(suma - total) > 0.5) {
      avisos.push(`${etiqueta}: els recomptes sumen ${suma} però el total apuntat és ${total}.`)
    }
  }
  for (const r of tee) revisa(`TEE ${r.curs} ${r.trimestre} trim.`, r)
  for (const r of vlcl) {
    revisa(`VL ${r.curs} ${r.trimestre} trim.`, r.vl)
    revisa(`CL ${r.curs} ${r.trimestre} trim.`, r.cl)
  }
  return avisos
}

/** Ordena per curs, del més recent al més antic ("25/26" abans que "17/18"). */
export function ordenaPerCurs(files) {
  const any = (c) => {
    const n = Number(String(c).split('/')[0])
    return Number.isNaN(n) ? -1 : (n < 50 ? n + 2000 : n + 1900)
  }
  return [...files].sort((a, b) => any(b.curs) - any(a.curs))
}

/** "2026-27" → "26/27", que és com s'anomenen els cursos a l'històric. */
export function cursCurtDe(cursEscolarId) {
  const m = String(cursEscolarId ?? '').match(/^(\d{2})(\d{2})-(\d{2})$/)
  return m ? `${m[2]}/${m[3]}` : String(cursEscolarId ?? '')
}

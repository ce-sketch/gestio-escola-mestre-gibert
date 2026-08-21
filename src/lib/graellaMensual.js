// Construeix la graella mensual d'assistència d'una classe: una fila per
// alumne, una columna per cada dia lectiu del mes, amb dues subcolumnes
// (matí i tarda) — el mateix format del full de càlcul que feien servir
// les tutores abans.
//
// Criteri important: una casella sense cap marca en un dia lectiu ja
// passat es considera PRESENT (és el que ja es fa a la pràctica: només
// es marca qui falta). Per això la graella només destaca les absències i
// els retards; la resta queda en blanc. Els dies que encara no han
// arribat es deixen a part, per no comptar com a present un dia futur.

export const MESOS_CURS = [
  { num: 9, label: 'Setembre' }, { num: 10, label: 'Octubre' }, { num: 11, label: 'Novembre' },
  { num: 12, label: 'Desembre' }, { num: 1, label: 'Gener' }, { num: 2, label: 'Febrer' },
  { num: 3, label: 'Març' }, { num: 4, label: 'Abril' }, { num: 5, label: 'Maig' }, { num: 6, label: 'Juny' },
]

const NOMS_DIA = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']

/** L'any natural que correspon a un mes dins d'un curs escolar:
 *  de setembre a desembre és el primer any; de gener a juny, el segon. */
export function anyDelMes(mesNum, cursEscolarId) {
  const anyInici = Number(cursEscolarId.split('-')[0])
  return mesNum >= 9 ? anyInici : anyInici + 1
}

/** Els dies lectius (dilluns-divendres, fora dels dies no lectius del
 *  calendari) d'un mes concret. Cada dia porta la data ISO, el número de
 *  dia i el nom del dia de la setmana. */
export function diesLectiusDelMes(mesNum, any, diesNoLectius = []) {
  const noLectius = new Set((diesNoLectius ?? []).map((d) => d.data))
  const dies = []
  const cursor = new Date(Date.UTC(any, mesNum - 1, 1))
  while (cursor.getUTCMonth() === mesNum - 1) {
    const iso = cursor.toISOString().slice(0, 10)
    const diaSetmana = cursor.getUTCDay()
    if (diaSetmana !== 0 && diaSetmana !== 6 && !noLectius.has(iso)) {
      dies.push({ data: iso, dia: cursor.getUTCDate(), nomDia: NOMS_DIA[diaSetmana] })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dies
}

/**
 * De tots els registres d'un alumne+data+torn, el vigent és el més
 * recent — igual que al mòdul de passar llista, on cada correcció
 * s'afegeix com un registre nou en comptes de sobreescriure l'anterior.
 */
export function registreVigent(registres) {
  if (!registres || registres.length === 0) return null
  return [...registres].sort((a, b) => (b.creatEl?.seconds ?? 0) - (a.creatEl?.seconds ?? 0))[0]
}

/**
 * Indexa una llista plana de registres d'assistència per "data|alumneId|torn",
 * quedant-se només amb el vigent de cada combinació.
 */
export function indexaRegistres(registres) {
  const perClau = new Map()
  for (const r of registres) {
    const clau = `${r.data}|${r.alumneId}|${r.torn}`
    if (!perClau.has(clau)) perClau.set(clau, [])
    perClau.get(clau).push(r)
  }
  const index = new Map()
  for (const [clau, llista] of perClau) index.set(clau, registreVigent(llista))
  return index
}

/**
 * L'estat que s'ha de mostrar en una casella. Retorna:
 *  - l'estat marcat, si n'hi ha cap de desat
 *  - 'present' si el dia ja ha passat i no hi ha marca (criteri del centre)
 *  - null si el dia encara no ha arribat (casella futura, no es pinta)
 */
export function estatCasella(index, data, alumneId, torn, avuiIso) {
  const registre = index.get(`${data}|${alumneId}|${torn}`)
  if (registre && registre.estat && registre.estat !== 'sense_marcar') return registre.estat
  if (data <= avuiIso) return 'present'
  return null
}

/** Compta les absències i retards d'un alumne en un conjunt de dies. */
export function resumAlumne(index, dies, alumneId, avuiIso) {
  let absentJustificat = 0
  let absentInjustificat = 0
  let retardJustificat = 0
  let retardInjustificat = 0
  for (const { data } of dies) {
    for (const torn of ['mati', 'tarda']) {
      const estat = estatCasella(index, data, alumneId, torn, avuiIso)
      if (estat === 'absent_justificat') absentJustificat += 1
      else if (estat === 'absent_injustificat') absentInjustificat += 1
      else if (estat === 'retard_justificat') retardJustificat += 1
      else if (estat === 'retard_injustificat') retardInjustificat += 1
    }
  }
  return {
    absentJustificat, absentInjustificat, retardJustificat, retardInjustificat,
    totalAbsencies: absentJustificat + absentInjustificat,
    totalRetards: retardJustificat + retardInjustificat,
  }
}

/** Retorna true si la data (Date, en UTC) cau en cap de setmana. */
function esCapDeSetmana(date) {
  const dia = date.getUTCDay()
  return dia === 0 || dia === 6
}

/** Compta els dies lectius (dilluns-divendres) entre dues dates, ambdues incloses,
 *  excloent les dates que apareguin a la llista de dies no lectius.
 *  Treballa sempre en UTC (mai barrejat amb hora local) per evitar que el fus
 *  horari de Barcelona desplaci les dates un dia enrere o endavant. */
export function comptaDiesLectius(dataInici, dataFi, diesNoLectius = []) {
  if (!dataInici || !dataFi) return 0
  const noLectiusSet = new Set(diesNoLectius.map((d) => d.data))
  let comptador = 0
  const cursor = new Date(`${dataInici}T00:00:00Z`)
  const fi = new Date(`${dataFi}T00:00:00Z`)

  while (cursor <= fi) {
    const isoData = cursor.toISOString().slice(0, 10)
    if (!esCapDeSetmana(cursor) && !noLectiusSet.has(isoData)) {
      comptador += 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return comptador
}

/** Determina a quin trimestre cau una data donada, segons la configuració del calendari. */
export function trimestreDe(dataIso, trimestres) {
  return trimestres.find((t) => dataIso >= t.inici && dataIso <= t.fi) ?? null
}

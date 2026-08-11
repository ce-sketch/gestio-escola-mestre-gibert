// Llegeix la llista real d'activitats d'un nivell (full "I3", "1r", "5è"...)
// del mateix document consolidat "Activitats_Complementaries_..._I3_a_6e"
// que ja es fa servir a Economia — columnes: Nº, Activitat, Descripció,
// Data, Horari, Lloc, Transport, Preu (€).

const NIVELLS_PER_CICLE = {
  'Educació Infantil': ['I3', 'I4', 'I5'],
  'Cicle Inicial': ['1r', '2n'],
  'Cicle Mitjà': ['3r', '4t'],
  'Cicle Superior': ['5è', '6è'],
}

function textCella(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}

/** Interpreta les files (array d'arrays, ja llegides amb sheet_to_json) del
 *  full d'UN nivell concret, i en retorna la llista d'activitats trobades. */
export function interpretaActivitatsNivell(files, nivell) {
  const activitats = []
  for (const fila of files) {
    const num = textCella(fila[0])
    const nom = textCella(fila[1])
    if (!num || !/^\d+$/.test(num) || !nom) continue
    activitats.push({
      nom,
      nivell,
      descripcio: textCella(fila[2]),
      data: textCella(fila[3]),
      horari: textCella(fila[4]),
      lloc: textCella(fila[5]),
      transport: textCella(fila[6]),
      preu: textCella(fila[7]),
    })
  }
  return activitats
}

/** Donat un workbook sencer (llegit amb la llibreria xlsx) i un cicle
 *  (Educació Infantil, Cicle Inicial, Cicle Mitjà, Cicle Superior), llegeix
 *  tots els fulls de nivell que li pertanyen i retorna la llista combinada
 *  d'activitats (amb el nivell de cadascuna). */
export function activitatsDelCicle(workbook, XLSX, cicle) {
  const nivells = NIVELLS_PER_CICLE[cicle] ?? []
  const totes = []
  for (const nivell of nivells) {
    const nomFull = workbook.SheetNames.find((n) => n.trim() === nivell || n.trim().toUpperCase() === nivell.toUpperCase())
    if (!nomFull) continue
    const files = XLSX.utils.sheet_to_json(workbook.Sheets[nomFull], { header: 1, raw: false })
    totes.push(...interpretaActivitatsNivell(files, nivell))
  }
  return totes
}

/**
 * Interpreta les files ja llegides (via la llibreria xlsx, sheet_to_json
 * amb header:1) del full "Resum" del document consolidat "Activitats
 * Complementàries". Retorna una llista de { curs, total, numActivitats }.
 */
export function parseResumSortides(files) {
  const resultats = []
  for (const fila of files) {
    const etiqueta = fila[0]?.toString().trim()
    if (!etiqueta) continue
    const curs = cursDe(etiqueta)
    if (!curs) continue
    const numActivitats = Number(fila[1])
    const totalText = fila[2]?.toString().replace(/[^\d.,]/g, '').replace(',', '.')
    const total = Number(totalText)
    if (!Number.isFinite(total)) continue
    resultats.push({ curs, total, numActivitats: Number.isFinite(numActivitats) ? numActivitats : null })
  }
  return resultats
}

/** Donada l'etiqueta d'una fila del full "Resum" (p. ex. "P3 (I3)", "1r de
 *  Primària"), en dedueix el codi de curs que fem servir a l'app. */
function cursDe(etiqueta) {
  const parentesi = etiqueta.match(/\(([^)]+)\)/)
  if (parentesi) return parentesi[1].trim()
  const ordinal = etiqueta.match(/^(\d+[a-zçè]+)/i)
  if (ordinal) return ordinal[1].trim()
  return null
}

/**
 * Interpreta el text pla d'un document "ACTIVITATS COMPLEMENTÀRIES" (un per
 * curs: I3, I4, I5, 1r...6è) i n'extreu el curs i el total de les sortides.
 */
export function parseActivitatsComplementariesText(text, nomFitxer) {
  const CURSOS_POSSIBLES = ['I3', 'I4', 'I5', '1r', '2n', '3r', '4t', '5è', '6è']

  // El curs sol aparèixer a la primera línia ("I3 ACTIVITATS...", "1r
  // PRIMÀRIA-ACTIVITATS...") — si no el trobem al text, ho provem amb el
  // nom del fitxer pujat.
  let curs = null
  const inici = text.slice(0, 200)
  for (const c of CURSOS_POSSIBLES) {
    const regex = new RegExp(`(^|[^a-zA-Zà-ú0-9])${c}([^a-zA-Zà-ú0-9]|$)`, 'i')
    if (regex.test(inici) || (nomFitxer && regex.test(nomFitxer))) { curs = c; break }
  }

  // La fila de total: "TOTAL COST DE LES SORTIDES ... 23,00 €" (poden
  // haver-hi tabulacions o espais entre columnes buides pel mig).
  const mTotal = text.match(/TOTAL COST DE LES SORTIDES[\s\S]{0,40}?(\d+(?:[.,]\d+)?)\s*€/i)
  const total = mTotal ? Number(mTotal[1].replace(',', '.')) : null

  // Activitats individuals (línies amb un número de fila i un preu al final).
  const activitats = []
  const regexActivitat = /^\s*\d+[\t,]([^\t\n]+?)[\t,][\s\S]*?(\d+(?:[.,]\d+)?)\s*€\s*$/gm
  let m
  while ((m = regexActivitat.exec(text)) !== null) {
    const nomActivitat = m[1].trim()
    const preu = Number(m[2].replace(',', '.'))
    if (nomActivitat && Number.isFinite(preu) && preu > 0) activitats.push({ nom: nomActivitat, preu })
  }

  return { curs, total, activitats }
}

/**
 * Interpreta el text pla del "Recull informatiu de les famílies" i n'extreu
 * qualsevol import en euros que hi trobi, junt amb el text que el precedeix
 * (per identificar a quin concepte correspon). No s'apliquen automàticament
 * — es mostren perquè el mestre triï a quina fila/concepte va cada import,
 * ja que la redacció del document pot canviar d'un curs a l'altre i un
 * mapeig cec podria posar un import al lloc equivocat.
 */
export function parseOfficialQuotesText(text) {
  const trobats = []
  // Qualsevol número (amb punt o coma decimal) seguit de "€", amb una mica
  // de text abans com a context (fins a 70 caràcters, tallant a l'inici de
  // frase o salt de línia si n'hi ha un abans).
  const regex = /([^\n.]{0,70}?)(\d+(?:[.,]\d+)?)\s*€/g
  let m
  while ((m = regex.exec(text)) !== null) {
    const context = m[1].trim().replace(/\s+/g, ' ')
    const import_ = Number(m[2].replace(',', '.'))
    if (!Number.isFinite(import_) || import_ <= 0) continue
    trobats.push({ context: context || '(sense context)', import: import_ })
  }
  return trobats
}

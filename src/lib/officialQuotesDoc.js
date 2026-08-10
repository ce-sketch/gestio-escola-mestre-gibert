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

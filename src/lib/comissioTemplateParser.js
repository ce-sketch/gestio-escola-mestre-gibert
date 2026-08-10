// Interpreta un Excel exportat des d'una plantilla "Valoració [Comissió/
// Equip]" (com les que hi ha a les carpetes de plantilles del centre) i en
// construeix la mateixa estructura que fa servir el mòdul de Valoracions:
// nom, responsable, membres, i els objectius amb les seves actuacions —
// llegides del full "Resum" i dels fulls "Objectiu N" que hi hagi.
//
// Sempre es mostra el resultat abans d'aplicar-lo, perquè l'administrador
// el pugui revisar (la redacció exacta de cada plantilla pot variar una
// mica d'un curs a l'altre).

function textCella(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}

/** Versió que rep ja les files (array d'arrays) del full "Resum", perquè
 *  qui la crida decideix com llegir l'Excel (amb la llibreria xlsx). */
export function interpretaResum(filesResum) {
  let nom = ''
  let responsable = ''
  let membres = ''
  const objectius = [] // { num, text }

  for (const fila of filesResum) {
    const a = textCella(fila[0])
    const b = textCella(fila[1])
    if (/^departament\/comiss/i.test(a)) nom = b
    else if (/^responsable:?$/i.test(a)) responsable = b
    else if (/^membres:?$/i.test(a)) membres = b
    else {
      const m = a.match(/^objectiu\s*(\d+):$/i)
      if (m && b) objectius.push({ num: Number(m[1]), text: b })
    }
  }
  return { nom, responsable, membres, objectius }
}

/** Llegeix les actuacions del full "Objectiu N" corresponent — files amb
 *  columna A = text de l'actuació i columna B = indicador d'avaluació,
 *  ignorant la fila de capçalera i qualsevol fila sense text a la columna A
 *  (sovint hi ha valors solts de llistes desplegables a columnes més enllà). */
export function interpretaFullObjectiu(filesObjectiu) {
  const actuacions = []
  let dinsDeLaTaula = false
  for (const fila of filesObjectiu) {
    const a = textCella(fila[0])
    const b = textCella(fila[1])
    if (/^actuacions\/activitats$/i.test(a)) { dinsDeLaTaula = true; continue }
    if (!dinsDeLaTaula) continue
    if (!a) continue
    // Files que són en realitat capçaleres repetides o valors solts de
    // desplegables (No fet, Fet, Endreçades...) no tenen sentit com a
    // activitat — les descartem si són massa curtes i sense indicador.
    if (a.length < 4 && !b) continue
    actuacions.push({ text: a, indicador: b })
  }
  return actuacions
}

/**
 * Interpreta la plantilla més senzilla d'un CICLE (un sol full "Valoració",
 * sense fulls separats per objectiu): nom del cicle, responsable, membres,
 * i la llista d'objectius (les línies que comencen per "- ").
 */
export function interpretaResumCicle(filesValoracio) {
  let nom = ''
  let responsable = ''
  let membres = ''
  const objectius = []
  let metodologies = ''

  for (const fila of filesValoracio) {
    const a = textCella(fila[0])
    const b = textCella(fila[1])
    const mValoracio = a.match(/^Valoraci[oó]\s+(Cicle.+|Educaci[oó]\s+Infantil)$/i)
    if (mValoracio) { nom = mValoracio[1].trim(); continue }
    if (/^responsable:?$/i.test(a)) { responsable = b; continue }
    if (/^membres:?$/i.test(a)) { membres = b; continue }
    if (a.startsWith('-') && a.length > 3) { objectius.push(a.replace(/^-+\s*/, '').trim()); continue }
    if (/^Racons,/i.test(a) || /entrada relaxada/i.test(a)) { metodologies = a; continue }
  }
  return { nom, responsable, membres, objectius, metodologies }
}

/**
 * Interpreta el full "Resum" d'una plantilla de FESTA: nom de l'activitat,
 * data, els objectius (amb el seu pes %), i els pesos entre Cicles i Equip
 * Directiu — tot això a partir del text lliure de la columna "Criteris".
 */
export function interpretaResumFesta(filesResum) {
  let activitat = ''
  let data = ''
  const objectius = [] // { num, text, pes }
  let pesCicles = 80
  let pesEquipDirectiu = 20
  const pesosObjectiu = {}

  const totText = filesResum.map((f) => f.map(textCella).join(' ')).join(' ')
  ;[...totText.matchAll(/objectiu\s*(\d+)\s*:\s*(\d+)\s*%/gi)].forEach((m) => { pesosObjectiu[Number(m[1])] = Number(m[2]) })
  const mCicles = totText.match(/cicles\s*:\s*(\d+)\s*%/i)
  if (mCicles) pesCicles = Number(mCicles[1])
  const mDirectiu = totText.match(/equip\s+directiu\s*:\s*(\d+)\s*%/i)
  if (mDirectiu) pesEquipDirectiu = Number(mDirectiu[1])

  for (const fila of filesResum) {
    const a = textCella(fila[0])
    const b = textCella(fila[1])
    if (/^activitat:?$/i.test(a)) activitat = b
    else if (/^data:?$/i.test(a)) data = b
    else {
      const m = a.match(/^objectiu\s*(\d+):$/i)
      if (m && b) objectius.push({ num: Number(m[1]), text: b.replace(/^-+\s*/, '').trim(), pes: pesosObjectiu[Number(m[1])] ?? 0 })
    }
  }
  return { activitat, data, objectius, pesCicles, pesEquipDirectiu }
}

/**
 * Interpreta el full d'un GRUP concret (Educació Infantil, Cicle Inicial...)
 * dins d'una plantilla de festa: per cada objectiu (identificat perquè la
 * fila comença pel mateix text que al Resum, o per "-"), la llista
 * d'activitats/indicadors que hi ha a sota, fins al següent objectiu o fins
 * a la fila "Comentaris".
 */
export function interpretaFullGrupFesta(filesGrup, objectiusResum) {
  const perObjectiu = {} // { num: [ {text} ] }
  let objectiuActual = null

  for (const fila of filesGrup) {
    const a = textCella(fila[0])
    if (!a) continue
    if (/^comentaris/i.test(a)) { objectiuActual = null; continue }

    // És una capçalera d'objectiu si coincideix (parcialment) amb un dels
    // textos d'objectiu del Resum, o si comença per "-" i és prou llarga.
    const coincident = objectiusResum.find((o) => a.replace(/^-+\s*/, '').trim().startsWith(o.text.slice(0, 25)))
    if (coincident) {
      objectiuActual = coincident.num
      if (!perObjectiu[objectiuActual]) perObjectiu[objectiuActual] = []
      continue
    }
    if (objectiuActual === null) continue
    if (/^grau d.assoliment/i.test(a)) continue
    if (a.length < 4) continue // valors solts de desplegables (Alt, Bo, Fet...)
    perObjectiu[objectiuActual].push({ text: a })
  }
  return perObjectiu
}

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

/** El primer valor que hi ha a la dreta d'una cel·la. Els fulls del centre
 *  tenen les etiquetes i els valors en cel·les combinades, i entre l'una i
 *  l'altre hi queden cel·les buides. */
function valorAlCostat(fila, idx) {
  for (let i = idx + 1; i < (fila?.length ?? 0); i++) {
    const v = textCella(fila[i])
    if (v) return v
  }
  return ''
}

/**
 * Versió que rep ja les files (array d'arrays) del full "Resum", perquè qui
 * la crida decideix com llegir l'Excel (amb la llibreria xlsx).
 *
 * Les etiquetes es busquen a **qualsevol columna**, no a la primera: els
 * fulls del centre no comencen a la columna A —el Resum d'una comissió té
 * les etiquetes a la B i els valors a la D— i les columnes canvien d'un
 * document a l'altre.
 */
export function interpretaResum(filesResum) {
  let nom = ''
  let responsable = ''
  let membres = ''
  const objectius = [] // { num, text }

  for (const fila of filesResum) {
    const cel·les = (fila ?? []).map(textCella)
    for (let i = 0; i < cel·les.length; i++) {
      const a = cel·les[i]
      if (!a) continue

      if (/^departament\s*\/\s*comiss/i.test(a)) {
        if (!nom) nom = valorAlCostat(fila, i)
        break
      }
      if (/^responsable:?$/i.test(a)) {
        if (!responsable) responsable = valorAlCostat(fila, i)
        break
      }
      if (/^membres:?$/i.test(a)) {
        if (!membres) membres = valorAlCostat(fila, i)
        break
      }
      const m = a.match(/^objectiu\s*(\d+):$/i)
      if (m) {
        const text = valorAlCostat(fila, i)
        if (text) objectius.push({ num: Number(m[1]), text })
        break
      }
    }
  }
  return { nom, responsable, membres, objectius }
}

/**
 * Llegeix les actuacions del full "Objectiu N".
 *
 * Les columnes es localitzen per la capçalera de la taula
 * ("Actuacions/Activitats" i "Indicador d'avaluació"), mai per posició. A
 * la dreta del full hi ha els valors solts de les llistes desplegables
 * (Fet, No fet, Endreçades, 0, 1, 2…), que queden fora perquè només es
 * llegeixen les dues columnes de la capçalera.
 */
export function interpretaFullObjectiu(filesObjectiu) {
  const actuacions = []
  let colText = null
  let colIndicador = null

  for (const fila of filesObjectiu) {
    const cel·les = (fila ?? []).map(textCella)

    if (colText === null) {
      const i = cel·les.findIndex((c) => /^actuacions\s*\/\s*activitats$/i.test(c))
      if (i >= 0) {
        colText = i
        const j = cel·les.findIndex((c, k) => k > i && /^indicador/i.test(c))
        colIndicador = j >= 0 ? j : null
      }
      continue
    }

    const text = cel·les[colText] ?? ''
    if (!text) continue
    // El peu del full: la valoració de febrer i les instruccions per a qui
    // l'omple. A partir d'aquí ja no hi ha actuacions.
    if (/^valoraci|^-?\s*recorda que si copies/i.test(text)) break

    const indicador = colIndicador !== null ? (cel·les[colIndicador] ?? '') : valorAlCostat(fila, colText)
    if (text.length < 4 && !indicador) continue
    actuacions.push({ text, indicador })
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

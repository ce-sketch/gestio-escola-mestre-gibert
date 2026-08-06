const MESOS = {
  gener: 1, febrer: 2, març: 3, abril: 4, maig: 5, juny: 6,
  juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12,
}

// Un mes en català després de "de " (una o més vegades, per tolerar
// repeticions com "de  de març") o bé amb apòstrof elidit ("d'octubre").
const MES = `(?:(?:de\\s+)+|d['’])([a-zçà-ú]+)`

function pad(n) {
  return String(n).padStart(2, '0')
}

/** Donat un mes (1-12) i els dos anys del curs (p. ex. 2026 i 2027),
 *  decideix a quin any pertany (set-des → primer any, gen-jul → segon any). */
function anyProbable(mes, anyInici, anyFi) {
  return mes >= 8 ? anyInici : anyFi
}

function isoData(dia, mes, any) {
  return `${any}-${pad(mes)}-${pad(dia)}`
}

/**
 * Descarrega el text pla d'un Google Doc públic (compartit amb "Qualsevol
 * amb l'enllaç" en mode lectura).
 */
export async function fetchDocText(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `No s'ha pogut llegir el document (codi ${res.status}). Comprova que està compartit ` +
      `com "Qualsevol persona amb l'enllaç" pot veure.`
    )
  }
  const text = await res.text()
  if (text.trim().startsWith('<')) {
    throw new Error('El document no sembla accessible públicament. Revisa la compartició.')
  }
  return text
}

/**
 * Interpreta el text del document "HORARI I CALENDARI ESCOLAR" i n'extreu
 * les dates rellevants. Adaptat al format concret d'aquest document — si
 * canvia molt la redacció d'un curs a l'altre, pot caldre ajustar-ho.
 */
export function parseOfficialCalendarText(text, cursId) {
  const anyInici = Number(cursId.split('-')[0])
  const anyFi = anyInici + 1

  const avisos = []
  const diesNoLectius = []
  let inici = ''
  let fi = ''

  // --- Inici de classes ---
  const mInici = text.match(new RegExp(`Inici classes:?\\**\\s*[a-zçà-ú]*\\s+(\\d{1,2})\\s+${MES}`, 'i'))
  if (mInici) {
    const dia = Number(mInici[1])
    const mes = MESOS[mInici[2].toLowerCase()]
    if (mes) inici = isoData(dia, mes, anyProbable(mes, anyInici, anyFi))
  } else {
    avisos.push('No he trobat la data d\'inici de classes.')
  }

  // --- Últim dia de classe ---
  const mFi = text.match(new RegExp(`[UÚ]ltim dia classe:?\\**\\s*(\\d{1,2})\\s+${MES}\\s+${MES.replace('([a-zçà-ú]+)', '(\\d{4})')}`, 'i'))
  if (mFi) {
    fi = isoData(Number(mFi[1]), MESOS[mFi[2].toLowerCase()], Number(mFi[3]))
  } else {
    avisos.push('No he trobat la data de final de curs.')
  }

  // --- Dies festius ---
  const blocFestius = text.match(/Dies festius[^:]*:([\s\S]*?)(?=\n\s*\*\*Dies de lliure|\n\s*Dies de lliure|$)/i)
  extreuLlistaDates(blocFestius?.[1], diesNoLectius, 'Festiu')
  if (!blocFestius) avisos.push('No he trobat el bloc de dies festius.')

  // --- Dies de lliure disposició ---
  const blocLliure = text.match(/Dies de lliure disposici[oó][^:]*:([\s\S]*?)(?=\n\s*\*\*Nadal|\n\s*Nadal:|$)/i)
  extreuLlistaDates(blocLliure?.[1], diesNoLectius, 'Lliure disposició')
  if (!blocLliure) avisos.push('No he trobat el bloc de dies de lliure disposició.')

  // --- Nadal (rang de dates) ---
  const mNadal = text.match(new RegExp(`Nadal:?\\**\\s*del\\s+(\\d{1,2})\\s+${MES}\\s+al\\s+(\\d{1,2})\\s+${MES}`, 'i'))
  if (mNadal) {
    const mesInici = MESOS[mNadal[2].toLowerCase()]
    const mesFi = MESOS[mNadal[4].toLowerCase()]
    afegeixRang(
      diesNoLectius,
      Number(mNadal[1]), mesInici, anyProbable(mesInici, anyInici, anyFi),
      Number(mNadal[3]), mesFi, anyProbable(mesFi, anyInici, anyFi),
      'Vacances de Nadal'
    )
  } else {
    avisos.push('No he trobat el rang de vacances de Nadal.')
  }

  // --- Setmana Santa (rang de dates, normalment un sol mes) ---
  const mSetmanaSanta = text.match(new RegExp(`Setmana Santa:?\\**\\s*del\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+${MES}`, 'i'))
  if (mSetmanaSanta) {
    const mes = MESOS[mSetmanaSanta[3].toLowerCase()]
    const any = anyProbable(mes, anyInici, anyFi)
    afegeixRang(diesNoLectius, Number(mSetmanaSanta[1]), mes, any, Number(mSetmanaSanta[2]), mes, any, 'Setmana Santa')
  } else {
    avisos.push('No he trobat el rang de Setmana Santa.')
  }

  diesNoLectius.sort((a, b) => a.data.localeCompare(b.data))

  // --- Validació: comprova que l'any de cada data quadri amb el mes,
  // segons a quin costat del curs hauria de caure (per exemple, un mes de
  // maig hauria de portar l'any de final de curs, no el d'inici). Si no
  // quadra (per exemple un any mal escrit al document original), es marca
  // clarament perquè es revisi abans de desar, sense eliminar la data.
  for (const d of diesNoLectius) {
    const any = Number(d.data.slice(0, 4))
    const mes = Number(d.data.slice(5, 7))
    const anyEsperat = anyProbable(mes, anyInici, anyFi)
    if (any !== anyEsperat) {
      d.motiu = `⚠ ${d.motiu} (any sospitós: esperava ${anyEsperat} — revisa-ho)`
      avisos.push(`La data ${d.data} té un any que no quadra amb el curs ${cursId}; comprova-la al document original.`)
    }
  }

  return { inici, fi, diesNoLectius, avisos }
}

/** Extreu totes les dates "D de MES de ANY (motiu)" d'un fragment de text. */
function extreuLlistaDates(fragment, llistaDesti, motiuPerDefecte) {
  if (!fragment) return
  const regex = new RegExp(`(\\d{1,2})\\s+${MES}\\s+${MES.replace('([a-zçà-ú]+)', '(\\d{4})')}\\s*(?:\\(([^)]+)\\))?`, 'gi')
  let m
  while ((m = regex.exec(fragment)) !== null) {
    const mes = MESOS[m[2].toLowerCase()]
    if (!mes) continue
    llistaDesti.push({
      data: isoData(Number(m[1]), mes, Number(m[3])),
      motiu: m[4]?.trim() || motiuPerDefecte,
    })
  }
}

/** Afegeix cada dia feiner d'un rang (inclusiu) a la llista de dies no lectius. */
function afegeixRang(llista, diaIni, mesIni, anyIni, diaFi, mesFi, anyFi, motiu) {
  const cursor = new Date(anyIni, mesIni - 1, diaIni)
  const fi = new Date(anyFi, mesFi - 1, diaFi)
  while (cursor <= fi) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) {
      // Format local (any-mes-dia), sense passar per toISOString/UTC, que
      // desplaçava la data un dia enrere amb el fus horari de Barcelona.
      llista.push({ data: isoData(cursor.getDate(), cursor.getMonth() + 1, cursor.getFullYear()), motiu })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
}

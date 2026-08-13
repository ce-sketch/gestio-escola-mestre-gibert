// Lector de plantilles PGAC.
//
// Llegeix un Excel amb l'estructura de l'"Eina d'avaluació PGAC" (els fulls
// "Objectiu 1", "Objectiu 2"…) i en treu els objectius, operatius,
// indicadors, pesos i escales, per no haver de teclejar-ho cada curs.
//
// No es basa en números de fila fixos —canvien d'un curs a l'altre— sinó en
// àncores de text que el document manté estables:
//   · "% de pes de cada estratègia"  → taula de pesos dels operatius
//   · "Operatiu N.M- …"              → inici d'un bloc d'operatiu
//   · "Indicadors d'avaluació"       → inici de la llista d'indicadors
//   · "Valor Global"                 → columna del pes de cada indicador
//
// Com que cap lectura automàtica és infal·lible, retorna també una llista
// d'avisos perquè es pugui ensenyar tot abans de desar res.

import {
  carregaExcelJS, text, neteja as netejaText, numero,
  aPercentatge, escalaDeText as escalaDelText, identificaEscala,
} from './excelLectura'


const CODI_OPERATIU = /^Operatiu\s*(\d+\.\d+)\s*[-–—]?\s*(.*)$/i

/**
 * @param {ArrayBuffer} buffer - el fitxer .xlsx pujat
 * @returns {Promise<{objectius: Array, avisos: string[]}>}
 */
export async function llegeixPlantillaPgac(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const avisos = []
  const objectius = []

  const fulls = wb.worksheets.filter((ws) => /^Objectiu\s*\d+$/i.test(ws.name.trim()))
  if (fulls.length === 0) {
    throw new Error("No hi ha cap full que es digui 'Objectiu 1', 'Objectiu 2'… Comprova que és l'Excel de l'Eina d'avaluació PGAC.")
  }

  for (const ws of fulls) {
    const objectiu = llegeixObjectiu(ws, avisos)
    if (objectiu) objectius.push(objectiu)
  }

  return { objectius, avisos }
}

function llegeixObjectiu(ws, avisos) {
  const nom = ws.name.trim()
  const maxFila = Math.min(ws.rowCount, 400)
  const cel = (f, c) => text(ws.getCell(`${c}${f}`))

  // ── Títol i estratègia ────────────────────────────────────────────────
  let titol = nom
  let descripcio = ''
  let estrategiaTitol = ''
  let estrategiaText = ''

  for (let f = 1; f <= 30; f++) {
    const b = netejaText(cel(f, 'B'))
    if (!b) continue
    if (!descripcio && /^Objectiu(\s+estratègic)?\s*\d/i.test(b) && b.length > 25) {
      const tall = b.search(/\.\s+[A-ZÀÈÉÍÒÓÚÑ]/)
      titol = netejaText(tall > 0 ? b.slice(0, tall) : b.slice(0, 60)).replace(/[:.\s]+$/, '')
      descripcio = tall > 0 ? b.slice(tall + 1).trim() : b
    }
    if (!estrategiaText && /^Estratègia\s*\d/i.test(b) && b.length > 30) {
      const tall = b.indexOf(':')
      estrategiaTitol = tall > 0 ? b.slice(0, tall).trim() : `Estratègia ${nom.replace(/\D/g, '')}`
      estrategiaText = tall > 0 ? b.slice(tall + 1).trim() : b
    }
  }

  // ── Taula de pesos dels operatius ─────────────────────────────────────
  const pesos = {}
  let filaPesos = null
  for (let f = 1; f <= maxFila; f++) {
    for (const c of ['B', 'I', 'K']) {
      if (/% de pes de cada estratègia/i.test(cel(f, c))) { filaPesos = f; break }
    }
    if (filaPesos) break
  }

  if (filaPesos) {
    const filaEtiquetes = filaPesos + 1
    const filaValors = filaPesos + 2
    const row = ws.getRow(filaEtiquetes)
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const m = netejaText(text(cell)).match(CODI_OPERATIU)
      if (!m) return
      const pes = aPercentatge(numero(ws.getRow(filaValors).getCell(col)))
      if (pes !== null) pesos[m[1]] = pes
    })
  } else {
    avisos.push(`${nom}: no he trobat la taula "% de pes de cada estratègia". Els pesos dels operatius es reparteixen a parts iguals i els hauràs de revisar.`)
  }

  // ── Blocs d'operatius ─────────────────────────────────────────────────
  const operatius = []
  const filesTaulaPesos = filaPesos ? [filaPesos, filaPesos + 1, filaPesos + 2] : []

  for (let f = 1; f <= maxFila; f++) {
    if (filesTaulaPesos.includes(f)) continue
    const m = netejaText(cel(f, 'B')).match(CODI_OPERATIU)
    if (!m) continue
    // La taula de pesos repeteix "Operatiu N.M-" sense text: si ja el tenim
    // amb text, no el dupliquem.
    const jaHiEs = operatius.find((op) => op.codi === m[1])
    if (jaHiEs) {
      if (!jaHiEs.text && m[2]) jaHiEs.text = m[2]
      continue
    }
    operatius.push({
      id: crypto.randomUUID(),
      codi: m[1],
      titol: `Operatiu ${m[1]}`,
      text: m[2] ?? '',
      pes: pesos[m[1]] ?? null,
      filaInici: f,
      indicadors: [],
    })
  }

  // Els fulls arrosseguen blocs d'operatius de cursos anteriors. Si un
  // operatiu no surt a la taula de pesos, no forma part d'aquest objectiu.
  if (filaPesos) {
    for (const op of operatius.filter((o) => pesos[o.codi] === undefined)) {
      avisos.push(`${nom}: he descartat el bloc "Operatiu ${op.codi}" perquè no surt a la taula de pesos — sembla una resta d'un curs anterior.`)
    }
  }

  if (operatius.length === 0) {
    avisos.push(`${nom}: no hi he trobat cap operatiu.`)
    return null
  }

  // ── Indicadors de cada operatiu ───────────────────────────────────────
  operatius.forEach((op, idx) => {
    const fi = idx + 1 < operatius.length ? operatius[idx + 1].filaInici : maxFila + 1
    op.indicadors = llegeixIndicadors(ws, op.filaInici, fi)
    if (op.pes === null) op.descartat = true
    if (op.indicadors.length === 0 && op.text) {
      avisos.push(`${nom}, Operatiu ${op.codi}: no hi he trobat cap indicador.`)
    }
  })

  // ── Competències bàsiques (el 65/35) ──────────────────────────────────
  const competencies = { actiu: false, pes: 35, escala: 'indicadors6', opcions: null, gener: '', juny: '', text: '' }
  for (let f = 1; f <= maxFila; f++) {
    const b = netejaText(cel(f, 'B'))
    const m = b.match(/\(Valor\s*(\d+(?:[.,]\d+)?)\s*%\)/i)
    if (!m) continue
    if (/competències bàsiques/i.test(b)) {
      competencies.actiu = true
      competencies.pes = Number(m[1].replace(',', '.'))
      competencies.text = b
    }
  }

  const definitius = operatius.filter((op) => !op.descartat)
  definitius.forEach((op) => { delete op.filaInici; delete op.codi; delete op.descartat })

  return {
    id: crypto.randomUUID(),
    titol,
    descripcio,
    estrategiaTitol: estrategiaTitol || `Estratègia ${nom.replace(/\D/g, '')}`,
    estrategiaText,
    competencies,
    operatius: definitius,
  }
}

function llegeixIndicadors(ws, desde, fins) {
  const cel = (f, c) => text(ws.getCell(`${c}${f}`))
  const indicadors = []

  // Busquem la capçalera de la llista: la fila que té "Valor Global"
  let filaCap = null
  let colPes = null
  let colValor = null
  for (let f = desde; f < fins; f++) {
    const row = ws.getRow(f)
    let trobat = false
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const t = netejaText(text(cell)).toLowerCase()
      if (t === 'valor global') { colPes = col; trobat = true }
      if (t === 'valor') colValor = col
    })
    if (trobat) { filaCap = f; break }
  }
  if (!filaCap) return indicadors

  for (let f = filaCap + 1; f < fins; f++) {
    const row = ws.getRow(f)
    const pesCell = colPes ? row.getCell(colPes) : null
    const pesVal = pesCell?.value
    // La fila del SUM tanca la llista
    if (typeof pesVal === 'object' && pesVal !== null && pesVal.formula) break

    const titolInd = netejaText(cel(f, 'B'))
    if (!titolInd) continue
    if (CODI_OPERATIU.test(titolInd)) break
    if (/^Indicadors? d'avaluació$/i.test(titolInd)) continue

    // La columna F sol tenir la fórmula de l'escala; si no, és dins del
    // criteri (E). No es barregen mai: donarien una escala inventada.
    const opcionsLlegides = escalaDelText(cel(f, 'F')) ?? escalaDelText(cel(f, 'E'))
    const { escala, opcions } = identificaEscala(opcionsLlegides)

    if (indicadors.some((i) => i.text === titolInd)) continue
    indicadors.push({
      id: crypto.randomUUID(),
      text: titolInd,
      criteri: netejaText(cel(f, 'E')),
      gener: '',
      juny: '',
      escala,
      opcions,
      valor: aPercentatge(colValor ? numero(row.getCell(colValor)) : null) ?? 100,
      pesGlobal: aPercentatge(numero(pesCell)),
    })
  }

  return indicadors
}

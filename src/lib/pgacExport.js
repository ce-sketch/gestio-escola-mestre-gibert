// Descàrrega del PGAC (els 3 Objectius Estratègics) en Excel i PDF, amb el
// mateix estil que `valoracionsExport.js`: una banda blava de capçalera,
// una pestanya/pàgina per objectiu, i cascada Objectiu → Operatiu →
// Indicador tal com surt a la pantalla.
//
// Els números que hi surten són els mateixos que calcula `pgac.js`
// (`resultatOperatiu`, `resultatObjectiu`): sumes ponderades, no mitjanes,
// amb els indicadors sense valorar comptant com a 0.

import { carregaExcelJS } from './carregaLlibreries'
import { resultatOperatiu, resultatObjectiu } from './pgac'
import { opcioDe } from './escales'
import { afegeixCapcalera, ajustaColumnes, estilCapcaleraTaula, VORES_TAULA, NOM_ESCOLA } from './excelCapcalera'

// La línia de columna (vertical) es marca més que la de fila.
const TOTES_VORES = VORES_TAULA

/** Capçalera d'una taula: rep la FILA sencera, no una cel·la. */
function estilCapçalera(fila) {
  return estilCapcaleraTaula(fila, fila.cellCount)
}

function pct(v) {
  return v === null || v === undefined ? '' : `${Math.round(v * 100) / 100}%`
}

function nomFullSegur(nom) {
  return nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Full'
}

/** El valor de gener/juny d'un indicador, en text: el nivell si l'escala
 *  en té (p. ex. "Fet"), o el número tal qual si és lliure. */
function valorIndicador(indicador, camp) {
  const v = indicador[camp]
  if (v === '' || v === null || v === undefined) return ''
  const opcio = opcioDe(indicador.escala, Number(v))
  return opcio ? `${opcio.label} (${pct(opcio.valor)})` : v
}

export async function exportaPgacExcel(objectius, cursEscolarId) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = NOM_ESCOLA
  wb.created = new Date()

  for (const [oi, o] of objectius.entries()) {
    const ws = wb.addWorksheet(nomFullSegur(`Objectiu ${oi + 1}`))
    afegeixCapcalera(ws, { titol: o.titol, cursEscolarId, columnes: 6 })

    ws.addRow([o.estrategiaTitol ?? '', o.estrategiaText ?? ''])
    ws.addRow([])

    const capRes = ws.addRow(['', '', '', '', 'Gener', 'Juny'])
    estilCapçalera(capRes)
    const rGener = resultatObjectiu(o, 'gener')
    const rJuny = resultatObjectiu(o, 'juny')
    ws.addRow(['RESULTAT DE L\u2019OBJECTIU', '', '', '', pct(rGener.valor), pct(rJuny.valor)]).eachCell((c) => { c.border = TOTES_VORES; c.font = { bold: true } })
    ws.addRow([])

    for (const op of o.operatius) {
      if (!op.titol && (op.indicadors ?? []).length === 0) continue
      const rOpGener = resultatOperatiu(op, 'gener')
      const rOpJuny = resultatOperatiu(op, 'juny')
      const filaOp = ws.addRow([op.titol, op.text, '', `Pes: ${op.pes ?? 0}%`, pct(rOpGener.valor), pct(rOpJuny.valor)])
      filaOp.eachCell((c) => { c.font = { bold: true }; c.border = TOTES_VORES })

      const capInd = ws.addRow(['', 'Indicador', '', 'Pes', 'Gener', 'Juny'])
      capInd.eachCell((c) => { c.font = { italic: true, color: { argb: 'FF666666' } } })
      for (const ind of op.indicadors ?? []) {
        ws.addRow(['', ind.text, '', ind.pesGlobal ?? '', valorIndicador(ind, 'gener'), valorIndicador(ind, 'juny')])
          .eachCell((c) => { c.border = TOTES_VORES })
      }
      ws.addRow([])
    }

    if (o.competencies?.actiu) {
      ws.addRow(['Competències bàsiques', o.competencies.text ?? '', '', `Pes: ${o.competencies.pes}%`, o.competencies.gener || '', o.competencies.juny || ''])
        .eachCell((c) => { c.border = TOTES_VORES })
    }

    ajustaColumnes(ws, [16, 60, 4, 14, 12, 12])
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `PGAC-${cursEscolarId}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function exportaPgacPDF(objectius, cursEscolarId) {
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  const blocs = objectius.map((o) => {
    const rGener = resultatObjectiu(o, 'gener')
    const rJuny = resultatObjectiu(o, 'juny')

    const operatiusHtml = o.operatius.filter((op) => op.titol || (op.indicadors ?? []).length > 0).map((op) => {
      const rOpGener = resultatOperatiu(op, 'gener')
      const rOpJuny = resultatOperatiu(op, 'juny')
      const indicadorsHtml = (op.indicadors ?? []).length > 0
        ? `<table class="sub">
            <thead><tr><th>Indicador</th><th>Pes</th><th>Gener</th><th>Juny</th></tr></thead>
            <tbody>${op.indicadors.map((ind) => `<tr><td>${ind.text || ''}</td><td>${ind.pesGlobal ?? ''}</td><td>${valorIndicador(ind, 'gener') || '—'}</td><td>${valorIndicador(ind, 'juny') || '—'}</td></tr>`).join('')}</tbody>
          </table>`
        : ''
      return `<div class="operatiu">
        <p><strong>${op.titol}</strong> (Pes: ${op.pes ?? 0}%) — Gener: ${pct(rOpGener.valor) || '—'} · Juny: ${pct(rOpJuny.valor) || '—'}</p>
        <p class="petit">${op.text || ''}</p>
        ${indicadorsHtml}
      </div>`
    }).join('')

    return `
      <div class="objectiu">
        <h2>${o.titol}</h2>
        <p class="petit">${o.descripcio || ''}</p>
        <p class="resultat">RESULTAT DE L\u2019OBJECTIU — Gener: ${pct(rGener.valor) || '—'} · Juny: ${pct(rJuny.valor) || '—'}</p>
        ${o.estrategiaTitol ? `<p class="petit"><strong>${o.estrategiaTitol}:</strong> ${o.estrategiaText || ''}</p>` : ''}
        ${operatiusHtml}
        ${o.competencies?.actiu ? `<p class="petit"><strong>Competències bàsiques</strong> (Pes: ${o.competencies.pes}%): ${o.competencies.text || ''} — Gener: ${o.competencies.gener || '—'} · Juny: ${o.competencies.juny || '—'}</p>` : ''}
      </div>
    `
  }).join('')

  finestra.document.write(`
    <html>
      <head>
        <title>PGAC ${cursEscolarId}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #1E3A5F; }
          .data { font-size: 12px; color: #666; margin-bottom: 20px; }
          .objectiu { break-before: page; padding-top: 12px; }
          .objectiu:first-of-type { break-before: avoid; }
          h2 { font-size: 15px; color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 4px; margin-top: 0; }
          .petit { font-size: 12px; margin: 4px 0; }
          .resultat { font-size: 13px; font-weight: bold; margin: 8px 0; }
          .operatiu { margin-top: 14px; font-size: 12px; }
          table.sub { border-collapse: collapse; width: 100%; font-size: 11px; margin: 6px 0 12px; }
          table.sub th, table.sub td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
          table.sub th { background: #f0f0f0; }
        </style>
      </head>
      <body>
        <h1>PGAC — Curs ${cursEscolarId}</h1>
        <p class="data">${NOM_ESCOLA} — generat el ${new Date().toLocaleDateString('ca-ES')}</p>
        ${blocs}
      </body>
    </html>
  `)
  finestra.document.close()
  setTimeout(() => finestra.print(), 350)
}

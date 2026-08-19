import { carregaExcelJS } from './carregaLlibreries'
import { FESTES, mitjanaObjectiu, mitjanaValoracio } from './valoracions'
import { mitjanaGeneralFesta, mitjanaGrup } from './festesDetall'
import { grauGlobal, grauCicle, CICLES_COOPERATIU } from './aprenentatgeCooperatiu'
import { grauSatisfaccioCicle, percentValorades, totalRepetirSi, mitjanaActivitat } from './activitatsComplementariesDetall'
import { afegeixCapcalera, ajustaColumnes } from './excelCapcalera'

const BLAU = 'FF1E3A5F'
const GRIS = 'FFF2F0EA'
const VORA = { style: 'thin', color: { argb: 'FFCCCCCC' } }
const TOTES_VORES = { top: VORA, left: VORA, bottom: VORA, right: VORA }

/**
 * Els noms de full d'Excel tenen dos límits durs: 31 caràcters i que no
 * n'hi hagi dos d'iguals dins del mateix llibre. Retallar a 31 sense més
 * ja n'hi havia prou per topar: dues valoracions que comencen igual
 * ("Comissió de Transformem els Patis" i alguna altra prou llarga) es
 * quedaven amb el mateix nom retallat i el llibre no es podia generar.
 *
 * `usats` es passa des de fora i es comparteix per a tot un mateix
 * export, perquè la comprovació valgui per al llibre sencer, no només
 * per full.
 */
function nomFullSegur(nom, sufix = '', usats = new Set()) {
  const base = (`${nom}${sufix}`.replace(/[:\\/?*[\]]/g, '') || 'Full').slice(0, 31)
  if (!usats.has(base)) {
    usats.add(base)
    return base
  }
  for (let i = 2; ; i++) {
    const marca = ` (${i})`
    const candidat = base.slice(0, 31 - marca.length) + marca
    if (!usats.has(candidat)) {
      usats.add(candidat)
      return candidat
    }
  }
}

function estilCapçalera(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU } }
  cell.border = TOTES_VORES
}

function pct(v) {
  return v === '' || v === null || v === undefined ? '' : `${v}%`
}

function arrodoneix(v) {
  return v === null || v === undefined ? '' : Math.round(v)
}


/**
 * Descarrega totes les valoracions (cicles, comissions i equips) d'un curs
 * escolar en un sol Excel, amb la mateixa estructura que els fulls
 * originals: els cicles (sense actuacions) surten en una única pestanya;
 * les comissions/equips (amb actuacions dins d'algun objectiu) surten amb
 * una pestanya "Resum" i una pestanya addicional per cada objectiu.
 */
export async function exportaValoracionsExcel(
  valoracions, cursEscolarId,
  { festesDetall = [], cooperatiu = null, activitats = [] } = {}
) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()
  const nomsUsats = new Set() // compartit per a tot el llibre, evita fulls amb el mateix nom

  for (const v of valoracions) {
    const teActuacions = (v.objectius ?? []).some((o) => o.actuacions?.length > 0)

    // --- Pestanya principal (Resum, o única si és un cicle sense actuacions) ---
    const ws = wb.addWorksheet(nomFullSegur(v.nom, teActuacions ? ' - Resum' : '', nomsUsats))
    afegeixCapcalera(ws, { titol: `Valoració ${v.nom}`, cursEscolarId, columnes: 3 })
    ws.addRow(['Departament/comissió/servei:', v.nom])
    if (v.responsable) ws.addRow(['Responsable:', v.responsable])
    if (v.membres) ws.addRow(['Membres:', v.membres])
    ws.addRow([])

    const capçalera = ws.addRow(['Objectiu', 'Gener', 'Juny'])
    capçalera.eachCell((cell) => estilCapçalera(cell))
    ;(v.objectius ?? []).forEach((o, i) => {
      const fila = ws.addRow([o.text, pct(mitjanaObjectiu(o, 'gener')), pct(mitjanaObjectiu(o, 'juny'))])
      fila.eachCell((cell) => {
        cell.border = TOTES_VORES
        cell.alignment = { wrapText: true, vertical: 'top' }
        if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF7' } }
      })
    })
    const filaResultat = ws.addRow(['Resultat PGAC', pct(mitjanaValoracio(v, 'gener')), pct(mitjanaValoracio(v, 'juny'))])
    filaResultat.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
      cell.border = TOTES_VORES
    })
    ws.addRow([])
    if (v.valoracioRevisio) ws.addRow(['Valoració/revisió:', v.valoracioRevisio])
    if (v.valoracioFinal) ws.addRow(['Valoració final:', v.valoracioFinal])
    if (v.metodologies) ws.addRow(['Metodologies utilitzades:', v.metodologies])
    if (v.propostesMillora) ws.addRow(['Propostes de millora:', v.propostesMillora])

    if (v.festes) {
      ws.addRow([])
      const capFestes = ws.addRow(['Festa', 'Valoració'])
      capFestes.eachCell((cell) => estilCapçalera(cell))
      FESTES.forEach((f) => {
        const fila = ws.addRow([f.label, pct(v.festes[f.id])])
        fila.eachCell((cell) => { cell.border = TOTES_VORES })
      })
    }

    ajustaColumnes(ws, [42, 12, 12])

    // --- Una pestanya per cada objectiu que tingui actuacions ---
    if (teActuacions) {
      v.objectius.forEach((o, oi) => {
        if (!o.actuacions || o.actuacions.length === 0) return
        const wsO = wb.addWorksheet(nomFullSegur(v.nom, ` - Obj.${oi + 1}`, nomsUsats))
        afegeixCapcalera(wsO, {
          titol: `${v.nom} — Objectiu ${oi + 1}: ${o.text}`,
          cursEscolarId,
          columnes: 4,
        })

        // Els objectius de recollida (per exemple el del SIC) porten tres
        // columnes més amb el text que s'hi ha enregistrat.
        const et = o.etiquetesDades ?? {}
        const capçaleres = o.recullDades
          ? ["Actuacions/Activitats", "Indicador d'avaluació",
             et.inici || 'Inici de curs', et.gener || 'Gener', et.juny || 'Juny',
             'Gener', 'Juny']
          : ["Actuacions/Activitats", "Indicador d'avaluació", 'Gener', 'Juny']
        const capO = wsO.addRow(capçaleres)
        capO.eachCell((cell) => estilCapçalera(cell))
        o.actuacions.forEach((a, ai) => {
          const fila = wsO.addRow(o.recullDades
            ? [a.text, a.indicador, a.dades?.inici ?? '', a.dades?.gener ?? '', a.dades?.juny ?? '', pct(a.gener), pct(a.juny)]
            : [a.text, a.indicador, pct(a.gener), pct(a.juny)])
          fila.eachCell((cell) => {
            cell.border = TOTES_VORES
            cell.alignment = { wrapText: true, vertical: 'top' }
            if (ai % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF7' } }
          })
        })
        const filaResultatO = wsO.addRow(o.recullDades
          ? ['Resultat', '', '', '', '', pct(mitjanaObjectiu(o, 'gener')), pct(mitjanaObjectiu(o, 'juny'))]
          : ['Resultat', '', pct(mitjanaObjectiu(o, 'gener')), pct(mitjanaObjectiu(o, 'juny'))])
        filaResultatO.eachCell((cell) => {
          cell.font = { bold: true }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
          cell.border = TOTES_VORES
        })

        ajustaColumnes(wsO, o.recullDades ? [34, 24, 26, 26, 26, 12, 12] : [38, 38, 12, 12])
      })
    }
  }

  // --- Festes: una pestanya amb un resum de totes i el desglossament de
  //     cada grup a sota, en comptes d'una pestanya per festa. ---
  if (festesDetall.length > 0) {
    const wsF = wb.addWorksheet(nomFullSegur('Festes', '', nomsUsats))
    afegeixCapcalera(wsF, { titol: 'Festes i celebracions', cursEscolarId, columnes: 2 })
    const capF = wsF.addRow(['Festa', 'Grau general'])
    capF.eachCell((c) => estilCapçalera(c))
    for (const f of festesDetall) {
      wsF.addRow([f.festa.activitat || f.id, pct(arrodoneix(mitjanaGeneralFesta(f.festa)))]).eachCell((c) => { c.border = TOTES_VORES })
    }
    wsF.addRow([])
    const capG = wsF.addRow(['Festa', 'Grup', 'Grau'])
    capG.eachCell((c) => estilCapçalera(c))
    for (const f of festesDetall) {
      for (const g of f.festa.grups) {
        wsF.addRow([f.festa.activitat || f.id, g.nom, pct(arrodoneix(mitjanaGrup(f.festa, g.nom)))]).eachCell((c) => { c.border = TOTES_VORES })
      }
    }
    ajustaColumnes(wsF, [30, 24, 12])
  }

  // --- Aprenentatge cooperatiu: un document per curs, amb el resultat
  //     global i el de cada cicle a gener i a juny. ---
  if (cooperatiu) {
    const wsC = wb.addWorksheet(nomFullSegur('Aprenentatge cooperatiu', '', nomsUsats))
    afegeixCapcalera(wsC, { titol: 'Aprenentatge cooperatiu', cursEscolarId, columnes: 3 })
    const capC = wsC.addRow(['', 'Gener', 'Juny'])
    capC.eachCell((c) => estilCapçalera(c))
    wsC.addRow(['Global', pct(arrodoneix(grauGlobal(cooperatiu, 'gener'))), pct(arrodoneix(grauGlobal(cooperatiu, 'juny')))]).eachCell((c) => { c.border = TOTES_VORES; c.font = { bold: true } })
    for (const cicle of CICLES_COOPERATIU) {
      wsC.addRow([cicle.nom, pct(arrodoneix(grauCicle(cooperatiu, cicle.id, 'gener'))), pct(arrodoneix(grauCicle(cooperatiu, cicle.id, 'juny')))]).eachCell((c) => { c.border = TOTES_VORES })
    }
    ajustaColumnes(wsC, [24, 12, 12])
  }

  // --- Activitats complementàries: un document per cicle. No tenen grau
  //     d'assoliment sinó grau de satisfacció (0-10), i per això les seves
  //     columnes no són les mateixes que les altres dues. ---
  if (activitats.length > 0) {
    const wsA = wb.addWorksheet(nomFullSegur('Activitats complementàries', '', nomsUsats))
    afegeixCapcalera(wsA, { titol: 'Activitats complementàries', cursEscolarId, columnes: 4 })
    const capA = wsA.addRow(['Cicle', 'Satisfacció', 'Valorades', 'Es repetirien'])
    capA.eachCell((c) => estilCapçalera(c))
    for (const a of activitats) {
      wsA.addRow([
        a.cicle,
        pct(arrodoneix(grauSatisfaccioCicle(a.activitats))),
        pct(arrodoneix(percentValorades(a.activitats))),
        `${totalRepetirSi(a.activitats)}/${a.activitats.length}`,
      ]).eachCell((c) => { c.border = TOTES_VORES })
    }
    ajustaColumnes(wsA, [22, 14, 14, 14])

    wsA.addRow([])
    const capDetall = wsA.addRow(['Cicle', 'Activitat', 'Nivell', 'Satisfacció'])
    capDetall.eachCell((c) => estilCapçalera(c))
    for (const a of activitats) {
      for (const act of a.activitats) {
        const m = mitjanaActivitat(act)
        wsA.addRow([a.cicle, act.nom || '(sense nom)', act.nivell, pct(m === null ? '' : arrodoneix(m * 10))]).eachCell((c) => { c.border = TOTES_VORES })
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Valoracions-PGAC-${cursEscolarId}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Alliberar l'adreça immediatament després del clic pot cancel·lar la
  // descàrrega en alguns navegadors: se li dona un moment.
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Descarrega totes les valoracions en PDF (obre una finestra formatada i
 * llança el diàleg d'impressió — triant "Desa com a PDF" com a impressora
 * s'obté un PDF real).
 */
export function exportaValoracionsPDF(
  valoracions, cursEscolarId,
  { festesDetall = [], cooperatiu = null, activitats = [] } = {}
) {
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  const blocs = valoracions.map((v) => {
    const objectiusHtml = (v.objectius ?? []).map((o, oi) => {
      const actuacionsHtml = (o.actuacions ?? []).length > 0
        ? `<table class="sub">
            <thead><tr><th>Actuacions/Activitats</th><th>Indicador d'avaluació</th><th>Gener</th><th>Juny</th></tr></thead>
            <tbody>${o.actuacions.map((a) => `<tr><td>${a.text || ''}</td><td>${a.indicador || ''}</td><td>${pct(a.gener)}</td><td>${pct(a.juny)}</td></tr>`).join('')}</tbody>
          </table>`
        : ''
      const g = mitjanaObjectiu(o, 'gener')
      const j = mitjanaObjectiu(o, 'juny')
      return `<div class="objectiu">
        <p><strong>${oi + 1}. ${o.text || '(sense text)'}</strong> — Gener: ${g !== null ? Math.round(g) + '%' : '—'} · Juny: ${j !== null ? Math.round(j) + '%' : '—'}</p>
        ${actuacionsHtml}
      </div>`
    }).join('')

    const festesHtml = v.festes
      ? `<p class="petit"><strong>Festes:</strong> ${FESTES.map((f) => `${f.label}: ${pct(v.festes[f.id]) || '—'}`).join(' · ')}</p>`
      : ''

    return `
      <div class="valoracio">
        <h2>${v.nom}</h2>
        ${v.responsable ? `<p class="petit"><strong>Responsable:</strong> ${v.responsable}</p>` : ''}
        ${v.membres ? `<p class="petit"><strong>Membres:</strong> ${v.membres}</p>` : ''}
        ${objectiusHtml}
        ${v.valoracioRevisio ? `<p class="petit"><strong>Valoració/revisió:</strong> ${v.valoracioRevisio}</p>` : ''}
        ${v.valoracioFinal ? `<p class="petit"><strong>Valoració final:</strong> ${v.valoracioFinal}</p>` : ''}
        ${v.propostesMillora ? `<p class="petit"><strong>Propostes de millora:</strong> ${v.propostesMillora}</p>` : ''}
        ${festesHtml}
      </div>
    `
  }).join('')

  const blocFestes = festesDetall.length > 0 ? `
    <div class="valoracio">
      <h2>Festes i celebracions</h2>
      <table class="sub">
        <thead><tr><th>Festa</th><th>Grau general</th></tr></thead>
        <tbody>${festesDetall.map((f) => `<tr><td>${f.festa.activitat || f.id}</td><td>${pct(arrodoneix(mitjanaGeneralFesta(f.festa))) || '—'}</td></tr>`).join('')}</tbody>
      </table>
      ${festesDetall.map((f) => `
        <p class="petit"><strong>${f.festa.activitat || f.id}</strong></p>
        <table class="sub">
          <thead><tr><th>Grup</th><th>Grau</th></tr></thead>
          <tbody>${f.festa.grups.map((g) => `<tr><td>${g.nom}</td><td>${pct(arrodoneix(mitjanaGrup(f.festa, g.nom))) || '—'}</td></tr>`).join('')}</tbody>
        </table>
      `).join('')}
    </div>
  ` : ''

  const blocCooperatiu = cooperatiu ? `
    <div class="valoracio">
      <h2>Aprenentatge cooperatiu</h2>
      <table class="sub">
        <thead><tr><th></th><th>Gener</th><th>Juny</th></tr></thead>
        <tbody>
          <tr><td><strong>Global</strong></td><td>${pct(arrodoneix(grauGlobal(cooperatiu, 'gener'))) || '—'}</td><td>${pct(arrodoneix(grauGlobal(cooperatiu, 'juny'))) || '—'}</td></tr>
          ${CICLES_COOPERATIU.map((c) => `<tr><td>${c.nom}</td><td>${pct(arrodoneix(grauCicle(cooperatiu, c.id, 'gener'))) || '—'}</td><td>${pct(arrodoneix(grauCicle(cooperatiu, c.id, 'juny'))) || '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : ''

  const blocActivitats = activitats.length > 0 ? `
    <div class="valoracio">
      <h2>Activitats complementàries</h2>
      <table class="sub">
        <thead><tr><th>Cicle</th><th>Satisfacció</th><th>Valorades</th><th>Es repetirien</th></tr></thead>
        <tbody>${activitats.map((a) => `<tr><td>${a.cicle}</td><td>${pct(arrodoneix(grauSatisfaccioCicle(a.activitats))) || '—'}</td><td>${pct(arrodoneix(percentValorades(a.activitats))) || '—'}</td><td>${totalRepetirSi(a.activitats)}/${a.activitats.length}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  ` : ''

  finestra.document.write(`
    <html>
      <head>
        <title>Valoracions PGAC ${cursEscolarId}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #1E3A5F; }
          .data { font-size: 12px; color: #666; margin-bottom: 20px; }
          .valoracio { break-before: page; padding-top: 12px; }
          .valoracio:first-of-type { break-before: avoid; }
          h2 { font-size: 15px; color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 4px; margin-top: 0; }
          .petit { font-size: 12px; margin: 4px 0; }
          .objectiu { margin-top: 12px; font-size: 12px; }
          table.sub { border-collapse: collapse; width: 100%; font-size: 11px; margin: 6px 0 12px; }
          table.sub th, table.sub td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
          table.sub th { background: #f0f0f0; }
        </style>
      </head>
      <body>
        <h1>Valoracions PGAC — Curs ${cursEscolarId}</h1>
        <p class="data">Escola Mestre Enric Gibert i Camins — generat el ${new Date().toLocaleDateString('ca-ES')}</p>
        ${blocs}
        ${blocFestes}${blocCooperatiu}${blocActivitats}
      </body>
    </html>
  `)
  finestra.document.close()
  setTimeout(() => finestra.print(), 350)
}

import { carregaExcelJS } from './carregaLlibreries'
import { FESTES, mitjanaObjectiu, mitjanaValoracio, agrupaValoracions } from './valoracions'
import { mitjanaGeneralFesta, mitjanaGrup } from './festesDetall'
import { grauGlobal, grauCicle, CICLES_COOPERATIU } from './aprenentatgeCooperatiu'
import { grauSatisfaccioCicle, percentValorades, totalRepetirSi, mitjanaActivitat } from './activitatsComplementariesDetall'
import { afegeixCapcalera, ajustaColumnes } from './excelCapcalera'

const BLAU = 'FF1E3A5F'
const BLAU_CSS = '#1E3A5F'
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

/** Full en horitzontal i ajustat a l'amplada del paper: les taules de
 *  valoracions solen tenir moltes columnes (Objectiu, Gener, Juny...) i en
 *  vertical queden tallades o minúscules en imprimir-les. */
function configuraPagina(ws) {
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } }
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
  { festesDetall = [], cooperatiu = null, activitats = [], config = null } = {}
) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()
  const nomsUsats = new Set() // compartit per a tot el llibre, evita fulls amb el mateix nom

  // Amb la configuració del curs, les pestanyes surten en el mateix ordre
  // que al Quadre de comandament (cicles en ordre pedagògic, després
  // comissions i mixtes per ordre alfabètic) en comptes de tot mesclat
  // per ordre alfabètic pla, que posava un cicle enmig de dues comissions.
  const valoracionsOrdenades = config
    ? agrupaValoracions(valoracions, config).flatMap((s) => s.valoracions)
    : valoracions

  for (const v of valoracionsOrdenades) {
    const teActuacions = (v.objectius ?? []).some((o) => o.actuacions?.length > 0)

    // --- Pestanya principal (Resum, o única si és un cicle sense actuacions) ---
    const ws = wb.addWorksheet(nomFullSegur(v.nom, teActuacions ? ' - Resum' : '', nomsUsats))
    configuraPagina(ws)
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
        configuraPagina(wsO)
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
    configuraPagina(wsF)
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
    configuraPagina(wsC)
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
    configuraPagina(wsA)
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
  { festesDetall = [], cooperatiu = null, activitats = [], config = null } = {}
) {
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  /** El bloc HTML d'una valoració (festes incloses, si en porta). Es fa
   *  servir tant si van agrupades per secció com si no. */
  function blocValoracio(v) {
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
  }

  // Amb la configuració del curs, es respecta el mateix ordre que al
  // Quadre de comandament — cicles en ordre pedagògic, després comissions
  // i mixtes alfabèticament — amb un títol de secció al davant de cada
  // bloc. Sense configuració (per exemple, en una prova), es queda amb
  // l'ordre que ja portava la llista.
  // El primer bloc de tots (secció o valoració) no ha de forçar salt de
  // pàgina — ja és a dalt de la primera. Es marca a part perquè la regla
  // de CSS que fa "cada valoració a la seva pàgina" no depengui de com
  // s'intercalen els <h1> de secció entremig (:first-of-type no serveix
  // aquí, perquè només mira el tipus d'etiqueta, no la classe).
  let primer = true
  function marcaPrimer(html) {
    if (!primer) return html
    primer = false
    return html.replace(/class="([^"]*)"/, 'class="$1 primer-bloc"')
  }

  const blocs = config
    ? agrupaValoracions(valoracions, config).map((seccio) => `
        ${marcaPrimer(`<h1 class="seccio">${seccio.titol}</h1>`)}
        ${seccio.valoracions.map((v) => marcaPrimer(blocValoracio(v))).join('')}
      `).join('')
    : valoracions.map((v) => marcaPrimer(blocValoracio(v))).join('')

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
        <title>Valoracions — Curs ${cursEscolarId}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 14mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Georgia', 'Times New Roman', serif; margin: 0; padding: 0 6mm; color: #1a1a1a; }
          .banda {
            background: ${BLAU_CSS}; color: #fff; font-weight: 700; font-size: 17px;
            text-align: center; padding: 10px; letter-spacing: 0.3px;
          }
          .subtitol {
            display: flex; justify-content: space-between; align-items: baseline;
            border-bottom: 2px solid ${BLAU_CSS}; padding: 8px 2px 10px; margin-bottom: 4px;
          }
          .subtitol .titol { font-size: 16px; font-weight: 700; color: ${BLAU_CSS}; }
          .subtitol .data { font-size: 11px; color: #666; }

          h1.seccio {
            font-size: 14px; font-weight: 700; color: #fff; background: ${BLAU_CSS};
            padding: 5px 10px; margin: 22px 0 12px; break-before: page;
          }
          h1.seccio.primer-bloc { break-before: avoid; margin-top: 10px; }

          .valoracio { break-before: page; padding-top: 4px; }
          .valoracio.primer-bloc { break-before: avoid; }

          h2 {
            font-size: 14px; color: #1a1a1a; border-bottom: 1px solid ${BLAU_CSS};
            padding-bottom: 5px; margin: 0 0 8px;
          }
          .petit { font-size: 12px; margin: 5px 0; line-height: 1.4; }
          .objectiu { margin-top: 14px; font-size: 12px; }
          .objectiu > p { margin: 0 0 4px; }

          table.sub { border-collapse: collapse; width: 100%; font-size: 11px; margin: 6px 0 14px; }
          table.sub th, table.sub td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; vertical-align: top; }
          table.sub th { background: #EDEFF2; color: #1a1a1a; font-weight: 700; }
          table.sub tbody tr:nth-child(even) { background: #FAFAFA; }

          @media print {
            h1.seccio, h2 { break-after: avoid; }
            table.sub { break-inside: auto; }
            table.sub tr { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="banda">Escola Mestre Enric Gibert i Camins</div>
        <div class="subtitol">
          <span class="titol">Valoracions — Curs ${cursEscolarId}</span>
          <span class="data">Generat el ${new Date().toLocaleDateString('ca-ES')}</span>
        </div>
        ${blocs}
        ${blocFestes}${blocCooperatiu}${blocActivitats}
      </body>
    </html>
  `)
  finestra.document.close()
  setTimeout(() => finestra.print(), 350)
}

import { carregaExcelJS } from './carregaLlibreries'
import { afegeixCapcalera, ajustaColumnes, amplaColumnes, estilCapcaleraTaula, VORES_TAULA, NOM_ESCOLA } from './excelCapcalera'

const GRIS_CLAR = 'FFF2F0EA'

/**
 * Descarrega un Excel (.xlsx) real, amb un full per cada taula, i estil:
 * capçalera en blau amb text blanc, vores fines a totes les cel·les,
 * files alternades, i columnes ajustades a l'amplada del contingut.
 *
 * S'hi passa un sol paquet de dades, no una llista solta de fulls:
 *
 *   { cursEscolarId: '2026-27', fulls: [{ nom: 'TEE', files: [[...], ...] }] }
 *
 * El curs escolar viatja amb les dades a posta. Les files ja vénen
 * filtrades pel mòdul i, un cop filtrades, ja no diuen de quin curs són:
 * si el curs no anés dins del paquet, la capçalera se l'hauria d'inventar i
 * un dia posaria el curs equivocat sense que ningú se n'adonés. Amb aquesta
 * forma, exportar sense curs directament no compila.
 */
function comprovaDades(dades, nomFuncio) {
  if (Array.isArray(dades)) {
    throw new Error(
      `${nomFuncio}: ara cal passar-hi { cursEscolarId, fulls }, no la llista de fulls a seques. ` +
      'Si veus aquest error és que ha quedat alguna crida de la manera antiga.'
    )
  }
  if (!dades?.cursEscolarId) {
    throw new Error(`${nomFuncio}: hi falta el curs escolar. Passa-hi { cursEscolarId, fulls }.`)
  }
  // `etiqueta` és el text que surt a la dreta de la capçalera. Per defecte
  // deia sempre "PGAC", també als Excel d'avaluació — que no tenen res a
  // veure amb el PGAC. Ara cada mòdul hi pot posar el seu.
  return { cursEscolarId: dades.cursEscolarId, fulls: dades.fulls ?? [], etiqueta: dades.etiqueta, subtitol: dades.subtitol }
}


export async function exportaExcel(nomFitxer, dades) {
  const ExcelJS = await carregaExcelJS()
  const { cursEscolarId, fulls, etiqueta } = comprovaDades(dades, 'exportaExcel')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()

  fulls.forEach(({ nom, files, grups }) => {
    const nomSegur = nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Full'
    const columnes = Math.max(1, ...files.map((f) => f.length))
    const teGrups = Boolean(grups?.length)
    const ws = wb.addWorksheet(nomSegur, {
      // La capçalera del centre ocupa 4 files. Quan hi ha grups de
      // columnes (una fila extra amb el nom de cada àrea), la capçalera de
      // la taula pròpiament dita passa a la 6a fila, no la 5a.
      views: [{ state: 'frozen', ySplit: teGrups ? 6 : 5 }],
    })
    afegeixCapcalera(ws, { titol: nom, cursEscolarId, columnes, ...(etiqueta ? { etiqueta } : {}) })

    const [capçalera, ...cosFiles] = files

    // --- Fila de grups: el nom de cada àrea a sobre de les seves columnes,
    // fusionades, perquè es distingeixin d'una ullada quan n'hi ha moltes
    // seguides (p. ex. "Català" a sobre de 1r/2n/3r/Final). ---
    //
    // Compte amb l'ordre: les DUES files s'han d'afegir abans de fusionar
    // res. Fusionar la columna d'índex (A5:A6) abans d'afegir la fila de
    // capçalera feia que Excel ja donés per existent la fila de sota, i
    // l'`addRow` següent queia una fila més avall — quedava una fila
    // buida enmig i el títol de la columna d'índex ("Classe") fora de la
    // cel·la fusionada.
    let filaGrups = null
    let nIndex = 0
    if (teGrups) {
      nIndex = capçalera.length - grups.reduce((a, g) => a + g.span, 0)
      filaGrups = ws.addRow([
        ...Array(nIndex).fill(''),
        ...grups.flatMap((g) => [g.label, ...Array(g.span - 1).fill('')]),
      ])
    }

    // --- Fila de capçalera pròpiament dita ---
    // wrapText: els títols llargs ("Assoliment Satisfactòri") es parteixen
    // en dues línies en comptes d'estirar tota la columna. L'amplada, més
    // avall, es calcula a partir de les dades perquè això tingui efecte.
    const filaCap = ws.addRow(capçalera)

    if (filaGrups) {
      // El títol de les columnes d'índex va a la fila de grups, que és la
      // que queda a dalt de la cel·la fusionada de dues files.
      for (let c = 1; c <= nIndex; c++) filaGrups.getCell(c).value = capçalera[c - 1]
      estilCapcaleraTaula(filaGrups, columnes, { alcada: 20 })
      estilCapcaleraTaula(filaCap, columnes)
      const rGrups = filaGrups.number
      const rCap = filaCap.number
      for (let c = 1; c <= nIndex; c++) ws.mergeCells(rGrups, c, rCap, c)
      let colActual = nIndex + 1
      for (const g of grups) {
        if (g.span > 1) ws.mergeCells(rGrups, colActual, rGrups, colActual + g.span - 1)
        colActual += g.span
      }
    } else {
      estilCapcaleraTaula(filaCap, columnes)
    }

    // --- Files de dades ---
    cosFiles.forEach((filaDades, i) => {
      const fila = ws.addRow(filaDades)
      const esTotal = typeof filaDades[0] === 'string' && filaDades[0].toUpperCase().includes('TOTAL')

      for (let c = 1; c <= columnes; c++) {
        const cell = fila.getCell(c)
        cell.border = VORES_TAULA
        cell.alignment = { vertical: 'middle', wrapText: false }

        if (esTotal) {
          cell.font = { bold: true }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLAR } }
        } else if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF7' } }
        }
      }
    })

    // Amplada de cada columna segons el contingut més llarg de la TAULA —
    // les files de la capçalera no compten, que si no el nom de l'escola
    // eixamplaria la primera columna ella sola.
    // Abans es feia amb el text més llarg de la columna INCLOENT la
    // capçalera, i un títol com "Assoliment Satisfactòri" estirava la
    // columna encara que a sota només hi hagués números. Ara es basa en les
    // DADES; del títol només es respecta la paraula més llarga (perquè no
    // es talli a mitges) i la meitat de la seva longitud, de manera que
    // quedi en dues línies.
    ajustaColumnes(ws, amplaColumnes(capçalera, cosFiles))

    // En horitzontal i ajustat a l'amplada del paper: les taules amb
    // moltes àrees tenen moltes columnes, i en vertical (o sense ajustar)
    // queden tallades en imprimir-les.
    ws.pageSetup = {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    }
  })

  const buffer = await wb.xlsx.writeBuffer()
  descarregaBlob(buffer, `${nomFitxer}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

function descarregaBlob(buffer, nomFitxer, mimeType) {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFitxer
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Obre una finestra amb totes les taules formatades i llança el diàleg
 * d'impressió del navegador — triant "Desa com a PDF" com a impressora
 * s'obté un PDF real, sense necessitat de cap llibreria addicional.
 * fulls: [{ nom: 'TEE', files: [[capçalera...], [fila...], ...] }]
 */
export function exportaPDF(titol, dades) {
  const { cursEscolarId, fulls, etiqueta, subtitol } = comprovaDades(dades, 'exportaPDF')
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  const escapa = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  /**
   * Mida de lletra i coixí segons quantes columnes **i quantes files** hi
   * ha. Abans només es mirava el nombre de columnes, i per això les
   * classes de 26-27 alumnes es partien en dues pàgines: hi cabien totes
   * les columnes, però no totes les files.
   *
   * En A4 apaïsat, amb els marges d'aquest document, hi ha ~176 mm d'alt
   * útil. Descomptant el títol de la taula i la fila de capçalera, queden
   * uns 600 px per a les files, i la classe més nombrosa en té 27 → cada
   * fila ha de fer 22 px o menys.
   */
  function estilTaula(nColumnes, nFiles) {
    // Límit per amplada (quantes columnes hi caben)
    let lletra = 10.5
    let coixiV = 6
    let coixiH = 8
    if (nColumnes > 14) { lletra = 9.5; coixiV = 5; coixiH = 6 }
    if (nColumnes > 20) { lletra = 8.5; coixiV = 4; coixiH = 4 }
    if (nColumnes > 28) { lletra = 7.5; coixiV = 3; coixiH = 3 }

    // Límit per alçada (quantes files hi caben). Es queda amb el més
    // estret dels dos, mai amb el més ample.
    if (nFiles > 20) { lletra = Math.min(lletra, 10); coixiV = Math.min(coixiV, 5) }
    if (nFiles > 24) { lletra = Math.min(lletra, 9.5); coixiV = Math.min(coixiV, 4) }
    if (nFiles > 28) { lletra = Math.min(lletra, 8.5); coixiV = Math.min(coixiV, 3) }
    if (nFiles > 34) { lletra = Math.min(lletra, 7.5); coixiV = Math.min(coixiV, 2) }

    return { lletra, coixi: `${coixiV}px ${coixiH}px` }
  }

  const taulesHtml = fulls.map(({ nom, files }, index) => {
    const [capçalera, ...cosFiles] = files
    const nColumnes = capçalera.length
    const { lletra, coixi } = estilTaula(nColumnes, cosFiles.length)

    // Les columnes de text (nom de l'alumne) van a l'esquerra; les de
    // dades, centrades — que és com es llegeix bé una graella de notes.
    const esColumnaText = capçalera.map((c, i) => i === 1 || /alumne|classe|nivell|àrea|area/i.test(String(c)))

    const capçaleraHtml = `<tr>${capçalera.map((c, i) => {
      const classe = [
        esColumnaText[i] ? 'text' : 'num',
        i === 0 ? 'primera' : '',
      ].filter(Boolean).join(' ')
      return `<th class="${classe}">${escapa(c)}</th>`
    }).join('')}</tr>`

    const cosHtml = cosFiles.map((fila) => {
      const esTotal = typeof fila[0] === 'string' && fila[0].toUpperCase().includes('TOTAL')
      const cel·les = fila.map((v, i) => {
        const classe = [
          esColumnaText[i] ? 'text' : 'num',
          i === 0 ? 'primera' : '',
        ].filter(Boolean).join(' ')
        return `<td class="${classe}">${escapa(v)}</td>`
      }).join('')
      return `<tr${esTotal ? ' class="total"' : ''}>${cel·les}</tr>`
    }).join('')

    return `
      <section class="bloc${index === 0 ? ' primer' : ''}">
        <h2>${escapa(nom)}</h2>
        <table style="font-size:${lletra}px; --coixi:${coixi}">
          <thead>${capçaleraHtml}</thead>
          <tbody>${cosHtml}</tbody>
        </table>
      </section>
    `
  }).join('')

  const dataAvui = new Date().toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  finestra.document.write(`
    <html>
      <head>
        <title>${escapa(titol)}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 12mm 12mm;
          }

          * { box-sizing: border-box; }

          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1C1C1C;
            margin: 0;
            font-variant-numeric: tabular-nums;
          }

          /* ---- Capçalera del document (només la 1a pàgina) ---- */
          .portada {
            border-bottom: 2.5px solid #1E3A5F;
            padding-bottom: 12px;
            margin-bottom: 22px;
          }
          .escola {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: #1E3A5F;
          }
          .titol {
            font-size: 21px;
            font-weight: 600;
            margin: 8px 0 0;
            letter-spacing: -0.2px;
          }
          .meta {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-top: 8px;
            font-size: 11px;
            color: #6B6B6B;
          }

          /* ---- Cada taula ---- */
          /* Una pàgina per taula. La portada es queda sola a la primera
             pàgina: així cada classe té la pàgina sencera per a ella i no
             en queda cap de partida per haver de compartir espai amb la
             capçalera del document. */
          .bloc { break-before: page; }

          h2 {
            font-size: 13px;
            font-weight: 600;
            color: #1E3A5F;
            margin: 0 0 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid #C9D2DE;
            break-after: avoid;
          }

          table {
            border-collapse: collapse;
            width: 100%;
            table-layout: auto;
          }

          th, td {
            padding: var(--coixi, 5px 7px);
            border-bottom: 1px solid #E2E5EA;
            /* Línia de columna: amb 12-14 àrees seguides, sense separador
               vertical l'ull salta de columna sense adonar-se'n. Es marca
               més que la de fila, que ja la fa l'alternança de colors. */
            border-right: 1px solid #C3CAD4;
          }
          th:first-child, td:first-child { border-left: 1px solid #C3CAD4; }

          table {
            border: 1px solid #A9B3C1;
          }

          thead th {
            background: #1E3A5F;
            color: #fff;
            font-weight: 600;
            font-size: 0.92em;
            border-bottom: none;
            /* Dins de la banda blava la línia de columna ha de ser clara,
               que una de grisa sobre blau marí no es veu. */
            border-right: 1px solid #6B7F9B;
            padding-top: 8px;
            padding-bottom: 8px;
          }
          thead th:first-child { border-left: 1px solid #6B7F9B; }
          thead th:last-child { border-right: 1px solid #1E3A5F; }
          thead th.num { text-align: center; }
          thead th.text { text-align: left; }
          thead th.primera { border-top-left-radius: 3px; }
          thead th:last-child { border-top-right-radius: 3px; }

          td.num { text-align: center; }
          td.text { text-align: left; }
          td.primera { color: #8A8A8A; font-size: 0.9em; }

          tbody tr:nth-child(even) { background: #F7F8FA; }
          tbody tr.total td {
            background: #EBEFF5;
            font-weight: 700;
            border-top: 1.5px solid #1E3A5F;
          }

          /* Que la capçalera es repeteixi a cada pàgina i que cap fila es
             parteixi per la meitat en imprimir. */
          thead { display: table-header-group; }
          tr { break-inside: avoid; }

          /* ---- Peu ---- */
          .peu {
            position: fixed;
            bottom: 6mm;
            left: 0;
            right: 0;
            font-size: 9px;
            color: #9A9A9A;
            display: flex;
            justify-content: space-between;
            padding: 0 2mm;
          }
        </style>
      </head>
      <body>
        <header class="portada">
          <div class="escola">${escapa(NOM_ESCOLA)}</div>
          <h1 class="titol">${escapa(titol)}</h1>
          <div class="meta">
            <span>${escapa(etiqueta ?? 'PGAC')} · Curs ${escapa(cursEscolarId)}</span>
            <span>${escapa(dataAvui)}</span>
          </div>
          ${subtitol ? `<p class="meta" style="margin-top:6px">${escapa(subtitol)}</p>` : ''}
        </header>

        ${taulesHtml}

        <div class="peu">
          <span>${escapa(NOM_ESCOLA)} · Curs ${escapa(cursEscolarId)}</span>
          <span>${escapa(titol)}</span>
        </div>
      </body>
    </html>
  `)
  finestra.document.close()
  // Petita espera perquè el navegador acabi de renderitzar abans d'imprimir.
  setTimeout(() => finestra.print(), 350)
}

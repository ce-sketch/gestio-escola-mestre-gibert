import { describe, it, expect } from 'vitest'

import { trimestreDeFull, cursEscolarDeFull, esPdf, grupsAreaDeCapcalera, areesFDeCapcalera, llegeixFinalsAlumnesPdf } from './historicNotaAreaParser'

describe('trimestreDeFull', () => {
  it('reconeix els noms de full del centre', () => {
    expect(trimestreDeFull('Resum 1r Trim.')).toBe('1r trimestre')
    expect(trimestreDeFull('Resum 2n trim.')).toBe('2n trimestre')
    expect(trimestreDeFull('Resum 3r trim.')).toBe('3r trimestre')
  })

  it('aguanta les variacions de majúscules i puntuació', () => {
    expect(trimestreDeFull('RESUM 1R TRIMESTRE')).toBe('1r trimestre')
    expect(trimestreDeFull('resum  2n  Trim')).toBe('2n trimestre')
  })

  it('descarta els fulls que no són de resum', () => {
    // Els fitxers porten un full per classe ("1A", "3rB"…) amb les notes
    // alumne per alumne: no s'han de llegir com si fossin resums.
    expect(trimestreDeFull('1A')).toBeNull()
    expect(trimestreDeFull('Criteris')).toBeNull()
    expect(trimestreDeFull('')).toBeNull()
  })

  it('descarta un full de resum sense trimestre reconegut', () => {
    expect(trimestreDeFull('Resum final')).toBeNull()
  })

  it('un full que es diu "Resum" a seques és la Final', () => {
    // A diferència de "Resum final" (test anterior): aquí no hi ha CAP
    // paraula més després de "Resum", que és exactament com el centre
    // anomena el full que ja porta la Final agregada.
    expect(trimestreDeFull('Resum')).toBe('Final (mitjana)')
    expect(trimestreDeFull('  resum  ')).toBe('Final (mitjana)')
  })
})

describe('cursEscolarDeFull', () => {
  it('llegeix el curs de la capçalera del full', () => {
    expect(cursEscolarDeFull([
      ['Escola Mestre Enric Gibert i Camins'],
      ['Curs: 2023-24'],
    ])).toBe('2023-24')
  })

  it('normalitza el curs escrit amb quatre xifres', () => {
    expect(cursEscolarDeFull([['Curs: 2023-2024']])).toBe('2023-24')
  })

  it('aguanta els espais al voltant del guionet', () => {
    expect(cursEscolarDeFull([['Curs 2022 - 23']])).toBe('2022-23')
  })

  it('només mira les primeres files: un any dins de les dades no és el curs', () => {
    const files = Array.from({ length: 20 }, () => [''])
    files[15] = ['Curs: 2019-20']
    expect(cursEscolarDeFull(files)).toBeNull()
  })

  it('torna null si no el troba, en comptes d\'endevinar-lo', () => {
    expect(cursEscolarDeFull([['Escola'], ['català']])).toBeNull()
    expect(cursEscolarDeFull([])).toBeNull()
  })
})

describe('llegeixResumNotaArea — un full real', () => {
  // `carregaExcelJS` és un simple `import('exceljs')`, sense res propi del
  // navegador: es pot exercitar de veritat, sense mock, generant l'Excel
  // amb la mateixa llibreria que fa servir el lector.
  async function fullDeProva() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Resum 1r Trim.')
    ws.addRow(['Curs: 2023-24'])
    // Blocs reals: català i, al costat, la "GF" d'Artística — el cas que
    // no es llegia fins ara.
    ws.addRow(['català', '', '', '', '', '', 'artística'])
    ws.addRow(['No Assoliment', 'Assoliment Satisfactòri', 'Assoliment Notable', 'Assoliment Excel·lent'])
    ws.addRow(['1A', 5, 6, 15, 1, 27, '1A', 2, 3, 20, 2, 27])
    const buf = await wb.xlsx.writeBuffer()
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  it('llegeix també la columna "artística", que abans quedava fora', async () => {
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { files } = await llegeixResumNotaArea(await fullDeProva())
    const art = files.find((f) => f.area === 'artistica')
    expect(art).toBeDefined()
    expect(art).toMatchObject({ classe: '1A', na: 2, as: 3, an: 20, ae: 2 })
  })

  it('el curs escolar es llegeix igual que abans', async () => {
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { cursEscolar } = await llegeixResumNotaArea(await fullDeProva())
    expect(cursEscolar).toBe('2023-24')
  })
})

describe('llegeixResumNotaArea — full "Resum" (Final ja agregada)', () => {
  async function fullAmbResumIAlumnes() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()

    const trim = wb.addWorksheet('Resum 1r Trim.')
    trim.addRow(['Curs: 2026-27'])
    trim.addRow(['català', '', '', '', '', '', 'castellà'])
    trim.addRow(['No Assoliment', 'Assoliment Satisfactòri', 'Assoliment Notable', 'Assoliment Excel·lent'])
    trim.addRow(['1A', 1, 1, 1, 1, 4, '1A', 1, 1, 1, 1, 4])

    // El full "Resum" a seques: la Final, ja agregada — amb un recompte
    // diferent del 1r trimestre perquè el test pugui distingir d'on ve
    // cadascun si per error es barregessin.
    const final = wb.addWorksheet('Resum')
    final.addRow(['Curs: 2026-27'])
    final.addRow(['català', '', '', '', '', '', 'castellà'])
    final.addRow(['No Assoliment', 'Assoliment Satisfactòri', 'Assoliment Notable', 'Assoliment Excel·lent'])
    final.addRow(['1A', 0, 2, 8, 12, 22, '1A', 0, 2, 8, 12, 22])

    // I, com al fitxer real 26-27, una pestanya per classe amb el
    // patró alumne per alumne — que NO s'hauria de fer servir per calcular
    // la Final, ja que el full "Resum" ja la porta.
    const alumnes = wb.addWorksheet('1A')
    alumnes.addRow(['Curs', 'Noms', 'català', '', '', 'F'])
    alumnes.addRow(['1A', 'Algú, Qui Sigui', 5, 5, 5, 5])

    const buf = await wb.xlsx.writeBuffer()
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  it('fa servir la Final del full "Resum", no la reconstrueix del full alumne per alumne', async () => {
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { files } = await llegeixResumNotaArea(await fullAmbResumIAlumnes())

    const finals = files.filter((f) => f.trimestre === 'Final (mitjana)' && f.area === 'catala')
    // Una sola fila per àrea i classe: si s'hagués calculat TAMBÉ del
    // full alumne per alumne, n'hi hauria dues i es duplicaria el
    // recompte.
    expect(finals).toHaveLength(1)
    expect(finals[0]).toMatchObject({ classe: '1A', na: 0, as: 2, an: 8, ae: 12, total: 22 })
  })

  it('el 1r trimestre es llegeix igual, sense interferència del full "Resum"', async () => {
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { files } = await llegeixResumNotaArea(await fullAmbResumIAlumnes())
    const trim1 = files.find((f) => f.trimestre === '1r trimestre' && f.area === 'catala')
    expect(trim1).toMatchObject({ classe: '1A', na: 1, as: 1, an: 1, ae: 1, total: 4 })
  })
})

describe('esPdf', () => {
  const ambCaps = (bytes) => new Uint8Array(bytes).buffer

  it('reconeix un PDF pels seus primers bytes', () => {
    // 0x25 0x50 0x44 0x46 = "%PDF"
    expect(esPdf(ambCaps([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true)
  })

  it('no confon un .xlsx amb un PDF', () => {
    // Un .xlsx és un ZIP: comença per "PK"
    expect(esPdf(ambCaps([0x50, 0x4b, 0x03, 0x04]))).toBe(false)
  })

  it('mira el contingut i no l\'extensió: del Drive el nom pot ser un altre', () => {
    expect(esPdf(ambCaps([0x25, 0x50, 0x44, 0x46]))).toBe(true)
  })

  it('no peta amb un fitxer buit o massa curt', () => {
    expect(esPdf(null)).toBe(false)
    expect(esPdf(new ArrayBuffer(0))).toBe(false)
    expect(esPdf(ambCaps([0x25]))).toBe(false)
  })
})

describe('el total com a comprovació', () => {
  // Al PDF, la fila de TOTALS d'un bloc pot quedar a la mateixa alçada
  // que la fila d'una classe d'un altre bloc; llavors els seus números
  // s'enganxen darrere d'un codi de classe que no és seu. Passa de debò
  // al curs 25-26, on els totals de Science cauen sobre la fila de 5A.
  async function fullAmb(files) {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Resum 1r Trim.')
    ws.addRow(['Curs: 2023-24'])
    ws.addRow(['català', '', '', '', '', '', 'castellà'])
    for (const f of files) ws.addRow(f)
    const buf = await wb.xlsx.writeBuffer()
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  it('accepta la fila quan el total quadra amb la suma', async () => {
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { files } = await llegeixResumNotaArea(await fullAmb([['1A', 5, 6, 15, 1, 27]]))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ classe: '1A', total: 27 })
  })

  it('descarta la fila quan el total no quadra: no és una classe', async () => {
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { files, avisos } = await llegeixResumNotaArea(await fullAmb([['5A', 0, 13, 56, 95, 45]]))
    expect(files).toHaveLength(0)
    expect(avisos.some((a) => /no quadrava/i.test(a))).toBe(true)
  })

  it('accepta la fila si el full no porta columna de total', async () => {
    // Hi ha fulls que no la tenen: exigir-la deixaria l'any sense dades.
    const { llegeixResumNotaArea } = await import('./historicNotaAreaParser')
    const { files } = await llegeixResumNotaArea(await fullAmb([['1A', 5, 6, 15, 1]]))
    expect(files).toHaveLength(1)
    expect(files[0].total).toBe(27) // recalculat de la suma
  })
})

describe('grupsAreaDeCapcalera', () => {
  // Al full de notes per alumne, cada àrea ocupa tres columnes (els
  // trimestres) i una quarta "F" amb la final.
  it('reconeix els grups de tres columnes iguals més una F', () => {
    const cap = ['Curs', '', 'Noms', 'català', 'català', 'català', 'F', 'castellà', 'castellà', 'castellà', 'F']
    expect(grupsAreaDeCapcalera(cap)).toEqual([
      { area: 'catala', colFinal: 6 },
      { area: 'castella', colFinal: 10 },
    ])
  })

  it('NO confon el bloc de recomptes de la dreta amb àrees', () => {
    // El mateix full porta, més a la dreta, columnes "CAT1t, CAT2t,
    // Cat3t, FINAL". Si es llegissin com una àrea, els recomptes es
    // duplicarien i la Final sortiria el doble de gran.
    const cap = ['CAT1t', 'CAT2t', 'Cat3t', 'FINAL', 'CAST1t', 'CAST2t', 'CAST3t', 'FINAL']
    expect(grupsAreaDeCapcalera(cap)).toEqual([])
  })

  it('arrossega les cel·les fusionades, que poden arribar buides', () => {
    // Segons com s'hagi desat el fitxer, d'un grup fusionat només ve
    // plena la primera cel·la.
    const cap = ['Curs', '', 'Noms', 'català', '', '', 'F']
    expect(grupsAreaDeCapcalera(cap)).toEqual([{ area: 'catala', colFinal: 6 }])
  })

  it('descarta les àrees que no reconeix', () => {
    const cap = ['inventada', 'inventada', 'inventada', 'F']
    expect(grupsAreaDeCapcalera(cap)).toEqual([])
  })

  it('conserva medi natural i medi social per separat', () => {
    // Als cursos antics eren dues àrees diferents.
    const cap = ['m. natural', 'm. natural', 'm. natural', 'F', 'm. social', 'm. social', 'm. social', 'F']
    expect(grupsAreaDeCapcalera(cap).map((g) => g.area)).toEqual(['medi_natural', 'medi_social'])
  })

  it('no peta amb una capçalera buida', () => {
    expect(grupsAreaDeCapcalera([])).toEqual([])
    expect(grupsAreaDeCapcalera(['', '', ''])).toEqual([])
  })
})


// ── llegeixFinalsAlumnesPdf ─────────────────────────────────────────────
//
// PAGINA_1A_REAL són les files EXACTES (posició X, text, número) tretes
// del PDF real "Nota mitjana d'àrea 25-26.pdf" del centre, pàgina de la
// classe 1A: capçalera + les 22 files d'alumne + les línies de peu de
// pàgina (criteris de promoció, ponderacions...) que no han de comptar
// com a files d'alumne. Servir dades reals aquí, en lloc de fabricar-ne
// unes de netes, és el que fa que aquest test detecti de debò si
// l'algorisme de columnes funciona amb el desordre real d'un PDF.

const PAGINA_1A_REAL = [
  [{ pos: 51.8, text: ",", num: null }, { pos: 578.4, text: "ARTÍSTICA", num: null }],
  [{ pos: 51.3, text: "Curs", num: null }, { pos: 134.0, text: "Noms", num: null }, { pos: 215.8, text: "català", num: null }, { pos: 254.9, text: "F", num: null }, { pos: 277.9, text: "castellà", num: null }, { pos: 319.2, text: "F", num: null }, { pos: 342.7, text: "anglès", num: null }, { pos: 382.2, text: "F", num: null }, { pos: 395.0, text: "matemàtiques", num: null }, { pos: 445.1, text: "F", num: null }, { pos: 471.3, text: "medi", num: null }, { pos: 508.1, text: "F", num: null }, { pos: 530.1, text: "plàstica", num: null }, { pos: 571.0, text: "F", num: null }, { pos: 594.0, text: "música", num: null }, { pos: 634.0, text: "F", num: null }, { pos: 652.8, text: "GF", num: null }, { pos: 677.6, text: "e.", num: null }, { pos: 684.3, text: "física", num: null }, { pos: 718.5, text: "F", num: null }, { pos: 742.4, text: "religió", num: null }, { pos: 780.1, text: "F", num: null }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "1", num: 1.0 }, { pos: 83.9, text: "Aguilar", num: null }, { pos: 104.2, text: "Portillo,", num: null }, { pos: 125.7, text: "Luis", num: null }, { pos: 205.7, text: "7,2", num: 7.2 }, { pos: 220.0, text: "7,0", num: 7.0 }, { pos: 234.2, text: "7,0", num: 7.0 }, { pos: 252.1, text: "7,1", num: 7.1 }, { pos: 270.0, text: "7,2", num: 7.2 }, { pos: 284.3, text: "7,0", num: 7.0 }, { pos: 298.5, text: "7,0", num: 7.0 }, { pos: 316.5, text: "7,1", num: 7.1 }, { pos: 334.4, text: "8,2", num: 8.2 }, { pos: 348.2, text: "6,7", num: 6.7 }, { pos: 362.0, text: "7,1", num: 7.1 }, { pos: 379.4, text: "7,3", num: 7.3 }, { pos: 397.3, text: "8,8", num: 8.8 }, { pos: 411.1, text: "8,7", num: 8.7 }, { pos: 424.9, text: "8,5", num: 8.5 }, { pos: 442.4, text: "8,7", num: 8.7 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "9,0", num: 9.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "9,0", num: 9.0 }, { pos: 658.3, text: "8,5", num: 8.5 }, { pos: 670.7, text: "8,7", num: 8.7 }, { pos: 684.5, text: "8,0", num: 8.0 }, { pos: 698.3, text: "9,4", num: 9.4 }, { pos: 715.8, text: "9,0", num: 9.0 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "2", num: 2.0 }, { pos: 83.9, text: "Aguilera", num: null }, { pos: 107.5, text: "Riofrio,", num: null }, { pos: 128.1, text: "Jose", num: null }, { pos: 142.3, text: "Ivan", num: null }, { pos: 205.7, text: "5,5", num: 5.5 }, { pos: 220.0, text: "5,2", num: 5.2 }, { pos: 234.2, text: "6,9", num: 6.9 }, { pos: 252.1, text: "5,9", num: 5.9 }, { pos: 270.0, text: "5,5", num: 5.5 }, { pos: 284.3, text: "6,7", num: 6.7 }, { pos: 298.5, text: "8,0", num: 8.0 }, { pos: 316.5, text: "7,0", num: 7.0 }, { pos: 334.4, text: "5,7", num: 5.7 }, { pos: 348.2, text: "8,7", num: 8.7 }, { pos: 362.0, text: "6,0", num: 6.0 }, { pos: 379.4, text: "6,8", num: 6.8 }, { pos: 397.3, text: "8,6", num: 8.6 }, { pos: 411.1, text: "8,7", num: 8.7 }, { pos: 424.9, text: "8,5", num: 8.5 }, { pos: 442.4, text: "8,6", num: 8.6 }, { pos: 461.6, text: "7,3", num: 7.3 }, { pos: 475.4, text: "7,3", num: 7.3 }, { pos: 489.2, text: "7,3", num: 7.3 }, { pos: 510.8, text: "7,3", num: 7.3 }, { pos: 523.2, text: "6,0", num: 6.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "7,0", num: 7.0 }, { pos: 586.2, text: "5,0", num: 5.0 }, { pos: 600.0, text: "7,0", num: 7.0 }, { pos: 613.8, text: "7,0", num: 7.0 }, { pos: 631.2, text: "6,3", num: 6.3 }, { pos: 658.3, text: "7,0", num: 7.0 }, { pos: 670.7, text: "4,0", num: 4.0 }, { pos: 684.5, text: "5,0", num: 5.0 }, { pos: 698.3, text: "5,0", num: 5.0 }, { pos: 715.8, text: "5,0", num: 5.0 }, { pos: 733.7, text: "7,0", num: 7.0 }, { pos: 747.5, text: "7,0", num: 7.0 }, { pos: 761.3, text: "8,0", num: 8.0 }, { pos: 777.8, text: "7,3", num: 7.3 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "3", num: 3.0 }, { pos: 83.9, text: "Andres", num: null }, { pos: 104.5, text: "Rubio,", num: null }, { pos: 123.4, text: "Luca", num: null }, { pos: 205.7, text: "6,0", num: 6.0 }, { pos: 220.0, text: "7,0", num: 7.0 }, { pos: 234.2, text: "5,4", num: 5.4 }, { pos: 252.1, text: "6,1", num: 6.1 }, { pos: 270.0, text: "6,0", num: 6.0 }, { pos: 284.3, text: "7,3", num: 7.3 }, { pos: 298.5, text: "6,6", num: 6.6 }, { pos: 316.5, text: "6,6", num: 6.6 }, { pos: 334.4, text: "7,1", num: 7.1 }, { pos: 348.2, text: "7,8", num: 7.8 }, { pos: 362.0, text: "7,4", num: 7.4 }, { pos: 379.4, text: "7,4", num: 7.4 }, { pos: 397.3, text: "5,3", num: 5.3 }, { pos: 411.1, text: "6,5", num: 6.5 }, { pos: 424.9, text: "7,5", num: 7.5 }, { pos: 442.4, text: "6,4", num: 6.4 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "7,7", num: 7.7 }, { pos: 586.2, text: "7,0", num: 7.0 }, { pos: 600.0, text: "7,0", num: 7.0 }, { pos: 613.8, text: "8,0", num: 8.0 }, { pos: 631.2, text: "7,3", num: 7.3 }, { pos: 658.3, text: "7,5", num: 7.5 }, { pos: 670.7, text: "7,8", num: 7.8 }, { pos: 684.5, text: "6,6", num: 6.6 }, { pos: 698.3, text: "7,0", num: 7.0 }, { pos: 715.8, text: "7,1", num: 7.1 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "4", num: 4.0 }, { pos: 83.9, text: "Azorín", num: null }, { pos: 102.9, text: "Gracia,", num: null }, { pos: 123.7, text: "Genís", num: null }, { pos: 205.7, text: "8,4", num: 8.4 }, { pos: 220.0, text: "8,5", num: 8.5 }, { pos: 234.2, text: "8,4", num: 8.4 }, { pos: 252.1, text: "8,4", num: 8.4 }, { pos: 270.0, text: "8,4", num: 8.4 }, { pos: 284.3, text: "8,5", num: 8.5 }, { pos: 298.5, text: "8,4", num: 8.4 }, { pos: 316.5, text: "8,4", num: 8.4 }, { pos: 334.4, text: "9,4", num: 9.4 }, { pos: 348.2, text: "8,4", num: 8.4 }, { pos: 362.0, text: "9,8", num: 9.8 }, { pos: 379.4, text: "9,2", num: 9.2 }, { pos: 397.3, text: "9,0", num: 9.0 }, { pos: 409.3, text: "10,0", num: 10.0 }, { pos: 424.9, text: "9,8", num: 9.8 }, { pos: 442.4, text: "9,6", num: 9.6 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "9,0", num: 9.0 }, { pos: 510.8, text: "8,3", num: 8.3 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 611.9, text: "10,0", num: 10.0 }, { pos: 631.2, text: "9,0", num: 9.0 }, { pos: 658.3, text: "8,5", num: 8.5 }, { pos: 670.7, text: "9,1", num: 9.1 }, { pos: 684.5, text: "9,0", num: 9.0 }, { pos: 698.3, text: "9,7", num: 9.7 }, { pos: 715.8, text: "9,2", num: 9.2 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "5", num: 5.0 }, { pos: 83.9, text: "Azzouz", num: null }, { pos: 105.2, text: "Gallego,", num: null }, { pos: 129.1, text: "Danial", num: null }, { pos: 205.7, text: "8,4", num: 8.4 }, { pos: 220.0, text: "8,4", num: 8.4 }, { pos: 234.2, text: "7,4", num: 7.4 }, { pos: 252.1, text: "8,1", num: 8.1 }, { pos: 270.0, text: "8,4", num: 8.4 }, { pos: 284.3, text: "8,4", num: 8.4 }, { pos: 298.5, text: "7,7", num: 7.7 }, { pos: 316.5, text: "8,2", num: 8.2 }, { pos: 334.4, text: "8,3", num: 8.3 }, { pos: 348.2, text: "7,4", num: 7.4 }, { pos: 362.0, text: "7,7", num: 7.7 }, { pos: 379.4, text: "7,8", num: 7.8 }, { pos: 397.3, text: "9,0", num: 9.0 }, { pos: 411.1, text: "9,2", num: 9.2 }, { pos: 424.9, text: "9,0", num: 9.0 }, { pos: 442.4, text: "9,1", num: 9.1 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "8,0", num: 8.0 }, { pos: 510.8, text: "8,0", num: 8.0 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "7,3", num: 7.3 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 611.9, text: "10,0", num: 10.0 }, { pos: 631.2, text: "9,0", num: 9.0 }, { pos: 658.3, text: "8,2", num: 8.2 }, { pos: 670.7, text: "7,8", num: 7.8 }, { pos: 684.5, text: "6,0", num: 6.0 }, { pos: 698.3, text: "7,6", num: 7.6 }, { pos: 715.8, text: "7,1", num: 7.1 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "6", num: 6.0 }, { pos: 83.9, text: "Calvo", num: null }, { pos: 100.9, text: "Sierra,", num: null }, { pos: 120.1, text: "Vera", num: null }, { pos: 205.7, text: "7,5", num: 7.5 }, { pos: 220.0, text: "7,6", num: 7.6 }, { pos: 234.2, text: "6,5", num: 6.5 }, { pos: 252.1, text: "7,2", num: 7.2 }, { pos: 270.0, text: "7,5", num: 7.5 }, { pos: 284.3, text: "7,3", num: 7.3 }, { pos: 298.5, text: "7,3", num: 7.3 }, { pos: 316.5, text: "7,4", num: 7.4 }, { pos: 334.4, text: "7,0", num: 7.0 }, { pos: 348.2, text: "7,7", num: 7.7 }, { pos: 362.0, text: "7,4", num: 7.4 }, { pos: 379.4, text: "7,4", num: 7.4 }, { pos: 397.3, text: "8,5", num: 8.5 }, { pos: 411.1, text: "7,8", num: 7.8 }, { pos: 424.9, text: "7,3", num: 7.3 }, { pos: 442.4, text: "7,9", num: 7.9 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "8,3", num: 8.3 }, { pos: 586.2, text: "7,5", num: 7.5 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "8,5", num: 8.5 }, { pos: 658.3, text: "8,4", num: 8.4 }, { pos: 670.7, text: "8,8", num: 8.8 }, { pos: 684.5, text: "8,6", num: 8.6 }, { pos: 698.3, text: "7,3", num: 7.3 }, { pos: 715.8, text: "8,2", num: 8.2 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "7", num: 7.0 }, { pos: 83.9, text: "Concolino", num: null }, { pos: 112.2, text: "López,", num: null }, { pos: 131.7, text: "Olivia", num: null }, { pos: 205.7, text: "5,3", num: 5.3 }, { pos: 220.0, text: "5,8", num: 5.8 }, { pos: 234.2, text: "5,9", num: 5.9 }, { pos: 252.1, text: "5,7", num: 5.7 }, { pos: 270.0, text: "5,3", num: 5.3 }, { pos: 284.3, text: "6,7", num: 6.7 }, { pos: 298.5, text: "7,1", num: 7.1 }, { pos: 316.5, text: "6,4", num: 6.4 }, { pos: 334.4, text: "7,4", num: 7.4 }, { pos: 348.2, text: "6,8", num: 6.8 }, { pos: 362.0, text: "7,9", num: 7.9 }, { pos: 379.4, text: "7,4", num: 7.4 }, { pos: 397.3, text: "5,0", num: 5.0 }, { pos: 411.1, text: "6,0", num: 6.0 }, { pos: 424.9, text: "6,2", num: 6.2 }, { pos: 442.4, text: "5,7", num: 5.7 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "7,0", num: 7.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "7,3", num: 7.3 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "7,5", num: 7.5 }, { pos: 613.8, text: "7,0", num: 7.0 }, { pos: 631.2, text: "7,5", num: 7.5 }, { pos: 658.3, text: "7,4", num: 7.4 }, { pos: 670.7, text: "7,6", num: 7.6 }, { pos: 684.5, text: "6,7", num: 6.7 }, { pos: 698.3, text: "7,0", num: 7.0 }, { pos: 715.8, text: "7,1", num: 7.1 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "8", num: 8.0 }, { pos: 83.9, text: "Domenech", num: null }, { pos: 114.5, text: "Villen,", num: null }, { pos: 132.3, text: "Quim", num: null }, { pos: 205.7, text: "7,1", num: 7.1 }, { pos: 220.0, text: "7,6", num: 7.6 }, { pos: 234.2, text: "7,0", num: 7.0 }, { pos: 252.1, text: "7,2", num: 7.2 }, { pos: 270.0, text: "7,1", num: 7.1 }, { pos: 284.3, text: "7,6", num: 7.6 }, { pos: 298.5, text: "7,1", num: 7.1 }, { pos: 316.5, text: "7,3", num: 7.3 }, { pos: 334.4, text: "8,4", num: 8.4 }, { pos: 348.2, text: "7,5", num: 7.5 }, { pos: 362.0, text: "6,8", num: 6.8 }, { pos: 379.4, text: "7,6", num: 7.6 }, { pos: 397.3, text: "9,0", num: 9.0 }, { pos: 411.1, text: "8,7", num: 8.7 }, { pos: 424.9, text: "8,8", num: 8.8 }, { pos: 442.4, text: "8,8", num: 8.8 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "8,0", num: 8.0 }, { pos: 510.8, text: "8,0", num: 8.0 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "7,3", num: 7.3 }, { pos: 586.2, text: "9,0", num: 9.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "9,0", num: 9.0 }, { pos: 658.3, text: "8,2", num: 8.2 }, { pos: 670.7, text: "5,6", num: 5.6 }, { pos: 684.5, text: "6,6", num: 6.6 }, { pos: 698.3, text: "7,7", num: 7.7 }, { pos: 715.8, text: "6,6", num: 6.6 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 72.5, text: "9", num: 9.0 }, { pos: 83.9, text: "Duran", num: null }, { pos: 101.9, text: "Gallego,", num: null }, { pos: 125.8, text: "Queralt", num: null }, { pos: 205.7, text: "8,1", num: 8.1 }, { pos: 220.0, text: "8,1", num: 8.1 }, { pos: 234.2, text: "7,6", num: 7.6 }, { pos: 252.1, text: "7,9", num: 7.9 }, { pos: 270.0, text: "8,1", num: 8.1 }, { pos: 284.3, text: "8,1", num: 8.1 }, { pos: 298.5, text: "7,6", num: 7.6 }, { pos: 316.5, text: "7,9", num: 7.9 }, { pos: 334.4, text: "9,4", num: 9.4 }, { pos: 348.2, text: "9,0", num: 9.0 }, { pos: 362.0, text: "8,5", num: 8.5 }, { pos: 379.4, text: "9,0", num: 9.0 }, { pos: 397.3, text: "8,4", num: 8.4 }, { pos: 411.1, text: "8,2", num: 8.2 }, { pos: 424.9, text: "9,0", num: 9.0 }, { pos: 442.4, text: "8,5", num: 8.5 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "8,0", num: 8.0 }, { pos: 510.8, text: "8,0", num: 8.0 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "9,0", num: 9.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "9,0", num: 9.0 }, { pos: 658.3, text: "8,5", num: 8.5 }, { pos: 670.7, text: "9,6", num: 9.6 }, { pos: 684.5, text: "8,6", num: 8.6 }, { pos: 698.3, text: "8,0", num: 8.0 }, { pos: 715.8, text: "9,0", num: 9.0 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "10", num: 10.0 }, { pos: 83.9, text: "Durro", num: null }, { pos: 100.5, text: "García,", num: null }, { pos: 121.4, text: "Aran", num: null }, { pos: 205.7, text: "9,0", num: 9.0 }, { pos: 220.0, text: "8,8", num: 8.8 }, { pos: 234.2, text: "9,4", num: 9.4 }, { pos: 252.1, text: "9,1", num: 9.1 }, { pos: 270.0, text: "9,0", num: 9.0 }, { pos: 284.3, text: "8,8", num: 8.8 }, { pos: 298.5, text: "9,1", num: 9.1 }, { pos: 316.5, text: "9,0", num: 9.0 }, { pos: 332.5, text: "10,010,0", num: null }, { pos: 362.0, text: "9,8", num: 9.8 }, { pos: 379.4, text: "9,9", num: 9.9 }, { pos: 397.3, text: "9,0", num: 9.0 }, { pos: 411.1, text: "9,7", num: 9.7 }, { pos: 424.9, text: "9,3", num: 9.3 }, { pos: 442.4, text: "9,3", num: 9.3 }, { pos: 461.6, text: "8,5", num: 8.5 }, { pos: 475.4, text: "8,510,0", num: null }, { pos: 510.8, text: "9,0", num: 9.0 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 535.2, text: "10,010,0", num: null }, { pos: 568.3, text: "9,3", num: 9.3 }, { pos: 586.2, text: "9,0", num: 9.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 611.9, text: "10,0", num: 10.0 }, { pos: 631.2, text: "9,3", num: 9.3 }, { pos: 658.3, text: "9,3", num: 9.3 }, { pos: 670.7, text: "6,7", num: 6.7 }, { pos: 684.5, text: "7,8", num: 7.8 }, { pos: 698.3, text: "7,7", num: 7.7 }, { pos: 715.8, text: "7,4", num: 7.4 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 71.1, text: "11", num: 11.0 }, { pos: 83.9, text: "Dyrenko", num: null }, { pos: 107.8, text: ",", num: null }, { pos: 111.1, text: "Marharyta", num: null }, { pos: 205.7, text: "3,0", num: 3.0 }, { pos: 220.0, text: "2,5", num: 2.5 }, { pos: 234.2, text: "1,0", num: 1.0 }, { pos: 252.1, text: "2,2", num: 2.2 }, { pos: 270.0, text: "3,0", num: 3.0 }, { pos: 284.3, text: "2,5", num: 2.5 }, { pos: 298.5, text: "0,4", num: 0.4 }, { pos: 316.5, text: "2,0", num: 2.0 }, { pos: 334.4, text: "4,8", num: 4.8 }, { pos: 348.2, text: "5,0", num: 5.0 }, { pos: 363.3, text: "3,5", num: 3.5 }, { pos: 379.4, text: "4,4", num: 4.4 }, { pos: 397.3, text: "3,0", num: 3.0 }, { pos: 411.1, text: "3,0", num: 3.0 }, { pos: 424.9, text: "0,0", num: 0.0 }, { pos: 442.4, text: "2,0", num: 2.0 }, { pos: 461.6, text: "6,3", num: 6.3 }, { pos: 475.4, text: "6,3", num: 6.3 }, { pos: 489.2, text: "7,0", num: 7.0 }, { pos: 510.8, text: "6,5", num: 6.5 }, { pos: 523.2, text: "6,0", num: 6.0 }, { pos: 537.0, text: "6,5", num: 6.5 }, { pos: 550.8, text: "7,2", num: 7.2 }, { pos: 568.3, text: "6,6", num: 6.6 }, { pos: 586.2, text: "6,0", num: 6.0 }, { pos: 600.0, text: "8,0", num: 8.0 }, { pos: 613.8, text: "5,0", num: 5.0 }, { pos: 631.2, text: "6,3", num: 6.3 }, { pos: 658.3, text: "6,5", num: 6.5 }, { pos: 670.7, text: "6,9", num: 6.9 }, { pos: 684.5, text: "6,6", num: 6.6 }, { pos: 698.3, text: "6,0", num: 6.0 }, { pos: 715.8, text: "6,5", num: 6.5 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "12", num: 12.0 }, { pos: 83.9, text: "Gómez", num: null }, { pos: 104.8, text: "Rico,", num: null }, { pos: 119.8, text: "Amélie", num: null }, { pos: 205.7, text: "5,5", num: 5.5 }, { pos: 220.0, text: "5,0", num: 5.0 }, { pos: 234.2, text: "4,0", num: 4.0 }, { pos: 252.1, text: "4,8", num: 4.8 }, { pos: 270.0, text: "5,5", num: 5.5 }, { pos: 284.3, text: "5,0", num: 5.0 }, { pos: 298.5, text: "4,0", num: 4.0 }, { pos: 316.5, text: "4,8", num: 4.8 }, { pos: 334.4, text: "5,5", num: 5.5 }, { pos: 348.2, text: "6,0", num: 6.0 }, { pos: 362.0, text: "6,0", num: 6.0 }, { pos: 379.4, text: "5,8", num: 5.8 }, { pos: 397.3, text: "5,0", num: 5.0 }, { pos: 411.1, text: "5,0", num: 5.0 }, { pos: 424.9, text: "4,0", num: 4.0 }, { pos: 442.4, text: "4,7", num: 4.7 }, { pos: 461.6, text: "5,0", num: 5.0 }, { pos: 475.4, text: "5,0", num: 5.0 }, { pos: 489.2, text: "5,0", num: 5.0 }, { pos: 510.8, text: "5,0", num: 5.0 }, { pos: 523.2, text: "6,0", num: 6.0 }, { pos: 537.0, text: "6,0", num: 6.0 }, { pos: 550.8, text: "6,0", num: 6.0 }, { pos: 568.3, text: "6,0", num: 6.0 }, { pos: 586.2, text: "6,0", num: 6.0 }, { pos: 600.0, text: "7,0", num: 7.0 }, { pos: 613.8, text: "5,0", num: 5.0 }, { pos: 631.2, text: "6,0", num: 6.0 }, { pos: 658.3, text: "6,0", num: 6.0 }, { pos: 670.7, text: "5,0", num: 5.0 }, { pos: 684.5, text: "6,0", num: 6.0 }, { pos: 698.3, text: "5,0", num: 5.0 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "13", num: 13.0 }, { pos: 83.9, text: "Gruas", num: null }, { pos: 101.9, text: "Madrona,", num: null }, { pos: 128.7, text: "Nico", num: null }, { pos: 205.7, text: "7,1", num: 7.1 }, { pos: 220.0, text: "8,1", num: 8.1 }, { pos: 234.2, text: "7,2", num: 7.2 }, { pos: 252.1, text: "7,5", num: 7.5 }, { pos: 270.0, text: "7,1", num: 7.1 }, { pos: 284.3, text: "8,1", num: 8.1 }, { pos: 298.5, text: "7,2", num: 7.2 }, { pos: 316.5, text: "7,5", num: 7.5 }, { pos: 334.4, text: "8,3", num: 8.3 }, { pos: 348.2, text: "8,2", num: 8.2 }, { pos: 362.0, text: "8,3", num: 8.3 }, { pos: 379.4, text: "8,3", num: 8.3 }, { pos: 397.3, text: "8,4", num: 8.4 }, { pos: 411.1, text: "8,7", num: 8.7 }, { pos: 424.9, text: "8,0", num: 8.0 }, { pos: 442.4, text: "8,4", num: 8.4 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "7,7", num: 7.7 }, { pos: 586.2, text: "7,0", num: 7.0 }, { pos: 600.0, text: "8,0", num: 8.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "8,0", num: 8.0 }, { pos: 658.3, text: "7,8", num: 7.8 }, { pos: 670.7, text: "6,9", num: 6.9 }, { pos: 684.5, text: "7,0", num: 7.0 }, { pos: 698.3, text: "7,5", num: 7.5 }, { pos: 715.8, text: "7,1", num: 7.1 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "14", num: 14.0 }, { pos: 83.9, text: "Ivakhova", num: null }, { pos: 109.5, text: "Mamedova,", num: null }, { pos: 142.4, text: "Milana", num: null }, { pos: 205.7, text: "4,0", num: 4.0 }, { pos: 220.0, text: "3,9", num: 3.9 }, { pos: 234.2, text: "3,4", num: 3.4 }, { pos: 252.1, text: "3,8", num: 3.8 }, { pos: 270.0, text: "4,0", num: 4.0 }, { pos: 284.3, text: "3,4", num: 3.4 }, { pos: 298.5, text: "5,2", num: 5.2 }, { pos: 316.5, text: "4,2", num: 4.2 }, { pos: 334.4, text: "5,8", num: 5.8 }, { pos: 348.2, text: "4,8", num: 4.8 }, { pos: 362.0, text: "5,5", num: 5.5 }, { pos: 379.4, text: "5,4", num: 5.4 }, { pos: 397.3, text: "4,0", num: 4.0 }, { pos: 411.1, text: "4,7", num: 4.7 }, { pos: 424.9, text: "3,5", num: 3.5 }, { pos: 442.4, text: "4,1", num: 4.1 }, { pos: 461.6, text: "6,3", num: 6.3 }, { pos: 475.4, text: "6,3", num: 6.3 }, { pos: 489.2, text: "7,0", num: 7.0 }, { pos: 510.8, text: "6,5", num: 6.5 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "6,0", num: 6.0 }, { pos: 568.3, text: "7,3", num: 7.3 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "7,0", num: 7.0 }, { pos: 613.8, text: "6,0", num: 6.0 }, { pos: 631.2, text: "7,0", num: 7.0 }, { pos: 658.3, text: "7,2", num: 7.2 }, { pos: 670.7, text: "8,3", num: 8.3 }, { pos: 684.5, text: "6,7", num: 6.7 }, { pos: 698.3, text: "6,7", num: 6.7 }, { pos: 715.8, text: "7,2", num: 7.2 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "15", num: 15.0 }, { pos: 83.9, text: "Llorens", num: null }, { pos: 105.2, text: "López,", num: null }, { pos: 124.8, text: "Emma", num: null }, { pos: 205.7, text: "9,0", num: 9.0 }, { pos: 220.0, text: "8,7", num: 8.7 }, { pos: 234.2, text: "8,7", num: 8.7 }, { pos: 252.1, text: "9,0", num: 9.0 }, { pos: 270.0, text: "9,0", num: 9.0 }, { pos: 284.3, text: "8,7", num: 8.7 }, { pos: 298.5, text: "8,7", num: 8.7 }, { pos: 316.5, text: "9,0", num: 9.0 }, { pos: 334.4, text: "8,8", num: 8.8 }, { pos: 348.2, text: "9,5", num: 9.5 }, { pos: 362.0, text: "9,1", num: 9.1 }, { pos: 379.4, text: "9,1", num: 9.1 }, { pos: 397.3, text: "7,8", num: 7.8 }, { pos: 411.1, text: "9,0", num: 9.0 }, { pos: 424.9, text: "8,5", num: 8.5 }, { pos: 442.4, text: "8,4", num: 8.4 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "8,0", num: 8.0 }, { pos: 510.8, text: "8,0", num: 8.0 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "9,0", num: 9.0 }, { pos: 568.3, text: "8,7", num: 8.7 }, { pos: 586.2, text: "9,0", num: 9.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "9,0", num: 9.0 }, { pos: 658.3, text: "9,0", num: 9.0 }, { pos: 670.7, text: "8,6", num: 8.6 }, { pos: 684.5, text: "7,6", num: 7.6 }, { pos: 698.3, text: "9,4", num: 9.4 }, { pos: 715.8, text: "8,5", num: 8.5 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "16", num: 16.0 }, { pos: 83.9, text: "Matos", num: null }, { pos: 101.9, text: "Paredes,", num: null }, { pos: 127.4, text: "Daphne", num: null }, { pos: 205.7, text: "5,5", num: 5.5 }, { pos: 220.0, text: "4,6", num: 4.6 }, { pos: 234.2, text: "3,7", num: 3.7 }, { pos: 252.1, text: "4,6", num: 4.6 }, { pos: 270.0, text: "5,5", num: 5.5 }, { pos: 284.3, text: "4,0", num: 4.0 }, { pos: 298.5, text: "5,0", num: 5.0 }, { pos: 316.5, text: "4,8", num: 4.8 }, { pos: 334.4, text: "4,5", num: 4.5 }, { pos: 348.2, text: "4,8", num: 4.8 }, { pos: 362.0, text: "4,3", num: 4.3 }, { pos: 379.4, text: "4,5", num: 4.5 }, { pos: 397.3, text: "5,0", num: 5.0 }, { pos: 411.1, text: "4,5", num: 4.5 }, { pos: 424.9, text: "4,3", num: 4.3 }, { pos: 442.4, text: "4,6", num: 4.6 }, { pos: 461.6, text: "7,3", num: 7.3 }, { pos: 475.4, text: "7,3", num: 7.3 }, { pos: 489.2, text: "7,3", num: 7.3 }, { pos: 510.8, text: "7,3", num: 7.3 }, { pos: 523.2, text: "6,0", num: 6.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "6,7", num: 6.7 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "5,0", num: 5.0 }, { pos: 631.2, text: "7,3", num: 7.3 }, { pos: 658.3, text: "7,0", num: 7.0 }, { pos: 670.7, text: "6,3", num: 6.3 }, { pos: 684.5, text: "6,0", num: 6.0 }, { pos: 698.3, text: "6,2", num: 6.2 }, { pos: 715.8, text: "6,1", num: 6.1 }, { pos: 733.7, text: "9,0", num: 9.0 }, { pos: 747.5, text: "9,0", num: 9.0 }, { pos: 761.3, text: "9,0", num: 9.0 }, { pos: 777.8, text: "9,0", num: 9.0 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "17", num: 17.0 }, { pos: 83.9, text: "Paredes", num: null }, { pos: 107.8, text: "Martin,", num: null }, { pos: 127.4, text: "Aitana", num: null }, { pos: 205.7, text: "7,9", num: 7.9 }, { pos: 220.0, text: "7,4", num: 7.4 }, { pos: 234.2, text: "7,9", num: 7.9 }, { pos: 252.1, text: "7,7", num: 7.7 }, { pos: 270.0, text: "7,9", num: 7.9 }, { pos: 284.3, text: "7,7", num: 7.7 }, { pos: 298.5, text: "7,9", num: 7.9 }, { pos: 316.5, text: "7,8", num: 7.8 }, { pos: 334.4, text: "7,5", num: 7.5 }, { pos: 348.2, text: "8,5", num: 8.5 }, { pos: 362.0, text: "8,8", num: 8.8 }, { pos: 379.4, text: "8,3", num: 8.3 }, { pos: 397.3, text: "6,3", num: 6.3 }, { pos: 411.1, text: "7,2", num: 7.2 }, { pos: 424.9, text: "7,4", num: 7.4 }, { pos: 442.4, text: "7,0", num: 7.0 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "8,0", num: 8.0 }, { pos: 510.8, text: "8,0", num: 8.0 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "8,7", num: 8.7 }, { pos: 658.3, text: "8,3", num: 8.3 }, { pos: 670.7, text: "7,4", num: 7.4 }, { pos: 684.5, text: "9,2", num: 9.2 }, { pos: 698.3, text: "7,6", num: 7.6 }, { pos: 715.8, text: "8,1", num: 8.1 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "18", num: 18.0 }, { pos: 83.9, text: "Perez", num: null }, { pos: 101.2, text: "Vera,", num: null }, { pos: 116.8, text: "Kilian", num: null }, { pos: 205.7, text: "6,1", num: 6.1 }, { pos: 220.0, text: "7,7", num: 7.7 }, { pos: 234.2, text: "6,6", num: 6.6 }, { pos: 252.1, text: "6,8", num: 6.8 }, { pos: 270.0, text: "6,1", num: 6.1 }, { pos: 284.3, text: "7,7", num: 7.7 }, { pos: 298.5, text: "7,5", num: 7.5 }, { pos: 316.5, text: "7,1", num: 7.1 }, { pos: 334.4, text: "9,3", num: 9.3 }, { pos: 348.2, text: "9,5", num: 9.5 }, { pos: 362.0, text: "8,1", num: 8.1 }, { pos: 379.4, text: "9,0", num: 9.0 }, { pos: 397.3, text: "7,0", num: 7.0 }, { pos: 411.1, text: "9,2", num: 9.2 }, { pos: 424.9, text: "7,8", num: 7.8 }, { pos: 442.4, text: "8,0", num: 8.0 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "9,0", num: 9.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 550.8, text: "7,0", num: 7.0 }, { pos: 568.3, text: "7,7", num: 7.7 }, { pos: 586.2, text: "7,0", num: 7.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "8,3", num: 8.3 }, { pos: 658.3, text: "8,0", num: 8.0 }, { pos: 670.7, text: "9,0", num: 9.0 }, { pos: 684.5, text: "9,0", num: 9.0 }, { pos: 698.3, text: "9,4", num: 9.4 }, { pos: 715.8, text: "9,1", num: 9.1 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "19", num: 19.0 }, { pos: 83.9, text: "Quesada", num: null }, { pos: 109.8, text: "Carrillo,", num: null }, { pos: 132.1, text: "Clara", num: null }, { pos: 205.7, text: "7,8", num: 7.8 }, { pos: 220.0, text: "8,1", num: 8.1 }, { pos: 234.2, text: "8,1", num: 8.1 }, { pos: 252.1, text: "8,0", num: 8.0 }, { pos: 270.0, text: "7,8", num: 7.8 }, { pos: 284.3, text: "7,8", num: 7.8 }, { pos: 298.5, text: "7,8", num: 7.8 }, { pos: 316.5, text: "7,8", num: 7.8 }, { pos: 334.4, text: "8,6", num: 8.6 }, { pos: 348.2, text: "9,3", num: 9.3 }, { pos: 362.0, text: "8,3", num: 8.3 }, { pos: 379.4, text: "8,7", num: 8.7 }, { pos: 397.3, text: "7,5", num: 7.5 }, { pos: 411.1, text: "8,5", num: 8.5 }, { pos: 424.9, text: "8,5", num: 8.5 }, { pos: 442.4, text: "8,2", num: 8.2 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "9,0", num: 9.0 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,5", num: 9.5 }, { pos: 631.2, text: "9,2", num: 9.2 }, { pos: 658.3, text: "8,6", num: 8.6 }, { pos: 670.7, text: "9,1", num: 9.1 }, { pos: 684.5, text: "9,0", num: 9.0 }, { pos: 698.3, text: "7,3", num: 7.3 }, { pos: 715.8, text: "8,5", num: 8.5 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "20", num: 20.0 }, { pos: 83.9, text: "Renedo", num: null }, { pos: 106.5, text: "Martí,", num: null }, { pos: 123.4, text: "Pol", num: null }, { pos: 205.7, text: "7,5", num: 7.5 }, { pos: 220.0, text: "7,6", num: 7.6 }, { pos: 234.2, text: "7,6", num: 7.6 }, { pos: 252.1, text: "7,6", num: 7.6 }, { pos: 270.0, text: "7,5", num: 7.5 }, { pos: 284.3, text: "7,6", num: 7.6 }, { pos: 298.5, text: "7,6", num: 7.6 }, { pos: 316.5, text: "7,6", num: 7.6 }, { pos: 334.4, text: "8,4", num: 8.4 }, { pos: 348.2, text: "9,2", num: 9.2 }, { pos: 362.0, text: "8,2", num: 8.2 }, { pos: 379.4, text: "8,6", num: 8.6 }, { pos: 397.3, text: "8,0", num: 8.0 }, { pos: 411.1, text: "8,5", num: 8.5 }, { pos: 424.9, text: "8,8", num: 8.8 }, { pos: 442.4, text: "8,4", num: 8.4 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "7,0", num: 7.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "9,0", num: 9.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "9,5", num: 9.5 }, { pos: 600.0, text: "9,0", num: 9.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "9,2", num: 9.2 }, { pos: 658.3, text: "8,6", num: 8.6 }, { pos: 670.7, text: "8,7", num: 8.7 }, { pos: 684.5, text: "7,8", num: 7.8 }, { pos: 698.3, text: "9,1", num: 9.1 }, { pos: 715.8, text: "8,5", num: 8.5 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "21", num: 21.0 }, { pos: 83.9, text: "Sánchez", num: null }, { pos: 108.8, text: "Marfil,", num: null }, { pos: 126.7, text: "Lucía", num: null }, { pos: 205.7, text: "7,9", num: 7.9 }, { pos: 220.0, text: "7,6", num: 7.6 }, { pos: 234.2, text: "7,0", num: 7.0 }, { pos: 252.1, text: "7,5", num: 7.5 }, { pos: 270.0, text: "7,9", num: 7.9 }, { pos: 284.3, text: "7,2", num: 7.2 }, { pos: 298.5, text: "7,7", num: 7.7 }, { pos: 316.5, text: "7,6", num: 7.6 }, { pos: 334.4, text: "8,6", num: 8.6 }, { pos: 348.2, text: "7,8", num: 7.8 }, { pos: 362.0, text: "7,1", num: 7.1 }, { pos: 379.4, text: "7,8", num: 7.8 }, { pos: 397.3, text: "6,3", num: 6.3 }, { pos: 411.1, text: "7,2", num: 7.2 }, { pos: 424.9, text: "6,5", num: 6.5 }, { pos: 442.4, text: "6,7", num: 6.7 }, { pos: 461.6, text: "8,0", num: 8.0 }, { pos: 475.4, text: "8,0", num: 8.0 }, { pos: 489.2, text: "8,0", num: 8.0 }, { pos: 510.8, text: "8,0", num: 8.0 }, { pos: 523.2, text: "7,0", num: 7.0 }, { pos: 537.0, text: "7,0", num: 7.0 }, { pos: 549.0, text: "10,0", num: 10.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "7,5", num: 7.5 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "8,2", num: 8.2 }, { pos: 658.3, text: "8,1", num: 8.1 }, { pos: 670.7, text: "8,1", num: 8.1 }, { pos: 684.5, text: "8,0", num: 8.0 }, { pos: 698.3, text: "6,3", num: 6.3 }, { pos: 715.8, text: "7,5", num: 7.5 }],
  [{ pos: 51.8, text: "1A", num: null }, { pos: 70.6, text: "22", num: 22.0 }, { pos: 83.9, text: "Seda", num: null }, { pos: 99.5, text: "Heredia,", num: null }, { pos: 123.8, text: "Mariona", num: null }, { pos: 205.7, text: "7,5", num: 7.5 }, { pos: 220.0, text: "7,0", num: 7.0 }, { pos: 234.2, text: "6,7", num: 6.7 }, { pos: 252.1, text: "7,1", num: 7.1 }, { pos: 270.0, text: "7,5", num: 7.5 }, { pos: 284.3, text: "7,0", num: 7.0 }, { pos: 298.5, text: "6,5", num: 6.5 }, { pos: 316.5, text: "7,0", num: 7.0 }, { pos: 334.4, text: "8,4", num: 8.4 }, { pos: 348.2, text: "8,4", num: 8.4 }, { pos: 362.0, text: "8,1", num: 8.1 }, { pos: 379.4, text: "8,3", num: 8.3 }, { pos: 397.3, text: "7,0", num: 7.0 }, { pos: 411.1, text: "7,2", num: 7.2 }, { pos: 424.9, text: "8,0", num: 8.0 }, { pos: 442.4, text: "7,4", num: 7.4 }, { pos: 461.6, text: "7,8", num: 7.8 }, { pos: 475.4, text: "7,8", num: 7.8 }, { pos: 489.2, text: "7,8", num: 7.8 }, { pos: 510.8, text: "7,8", num: 7.8 }, { pos: 523.2, text: "8,0", num: 8.0 }, { pos: 537.0, text: "8,0", num: 8.0 }, { pos: 550.8, text: "8,0", num: 8.0 }, { pos: 568.3, text: "8,0", num: 8.0 }, { pos: 586.2, text: "8,0", num: 8.0 }, { pos: 600.0, text: "8,0", num: 8.0 }, { pos: 613.8, text: "9,0", num: 9.0 }, { pos: 631.2, text: "8,3", num: 8.3 }, { pos: 658.3, text: "8,2", num: 8.2 }, { pos: 670.7, text: "9,4", num: 9.4 }, { pos: 684.5, text: "7,4", num: 7.4 }, { pos: 698.3, text: "7,6", num: 7.6 }, { pos: 715.8, text: "8,1", num: 8.1 }],
  [{ pos: 247.5, text: "Marqueu", num: null }, { pos: 274.1, text: "amb", num: null }, { pos: 288.0, text: "color", num: null }, { pos: 304.2, text: "verd", num: null }, { pos: 318.5, text: "les", num: null }, { pos: 328.5, text: "notes", num: null }, { pos: 346.0, text: "de", num: null }, { pos: 354.6, text: "les", num: null }, { pos: 364.6, text: "àrees", num: null }, { pos: 381.9, text: "amb", num: null }, { pos: 395.8, text: "PI", num: null }, { pos: 473.2, text: "Les", num: null }, { pos: 485.1, text: "caselles", num: null }, { pos: 510.0, text: "sense", num: null }, { pos: 528.6, text: "nota", num: null }, { pos: 542.8, text: "és", num: null }, { pos: 551.1, text: "un", num: null }, { pos: 560.1, text: "no", num: null }, { pos: 569.0, text: "avaluat", num: null }, { pos: 599.1, text: "Marqueu", num: null }, { pos: 625.6, text: "en", num: null }, { pos: 634.2, text: "vermell", num: null }, { pos: 656.8, text: "les", num: null }, { pos: 666.7, text: "notes", num: null }, { pos: 684.3, text: "per", num: null }, { pos: 695.2, text: "sota", num: null }, { pos: 709.2, text: "de", num: null }, { pos: 717.8, text: "5", num: 5.0 }, { pos: 736.0, text: "2", num: 2.0 }, { pos: 749.8, text: "2", num: 2.0 }, { pos: 763.6, text: "2", num: 2.0 }, { pos: 780.1, text: "2", num: 2.0 }],
  [{ pos: 204.8, text: "Criteris", num: null }, { pos: 225.4, text: "de", num: null }, { pos: 233.7, text: "promoció", num: null }, { pos: 259.9, text: "de", num: null }, { pos: 268.2, text: "curs", num: null }],
  [{ pos: 437.8, text: "ATENCIÓ!!!!!", num: null }],
  [{ pos: 204.8, text: "Indicadors", num: null }, { pos: 234.0, text: "d'avaluació", num: null }, { pos: 265.3, text: "llengua", num: null }],
  [{ pos: 437.8, text: "Tothom", num: null }, { pos: 474.7, text: "ha", num: null }, { pos: 488.5, text: "de", num: null }, { pos: 502.3, text: "tenir", num: null }, { pos: 525.6, text: "nota", num: null }, { pos: 548.4, text: "numèrica,", num: null }, { pos: 596.2, text: "també", num: null }, { pos: 627.0, text: "els", num: null }, { pos: 642.9, text: "PI", num: null }],
  [{ pos: 204.8, text: "Ponderació", num: null }, { pos: 236.7, text: "qualificació", num: null }, { pos: 267.9, text: "de", num: null }, { pos: 276.2, text: "l'àmbit", num: null }, { pos: 294.9, text: "lingüístic:", num: null }, { pos: 321.4, text: "català", num: null }, { pos: 339.0, text: "i", num: null }, { pos: 342.0, text: "castellà", num: null }],
  [{ pos: 269.1, text: "1r", num: null }, { pos: 276.1, text: "trim.", num: null }, { pos: 333.5, text: "2on", num: null }, { pos: 345.1, text: "trim", num: null }, { pos: 361.0, text: "3r", num: null }, { pos: 368.0, text: "trim.", num: null }],
  [{ pos: 204.8, text: "Comunicació", num: null }, { pos: 241.0, text: "oral", num: null }, { pos: 282.4, text: "40%", num: null }, { pos: 333.5, text: "30%", num: null }, { pos: 361.0, text: "30%", num: null }],
  [{ pos: 204.8, text: "Expressió", num: null }, { pos: 232.7, text: "escrita", num: null }, { pos: 282.4, text: "20%", num: null }, { pos: 333.5, text: "30%", num: null }, { pos: 361.0, text: "30%", num: null }],
  [{ pos: 204.8, text: "Comprensió", num: null }, { pos: 238.7, text: "lectora", num: null }, { pos: 282.4, text: "30%", num: null }, { pos: 333.5, text: "30%", num: null }, { pos: 361.0, text: "30%", num: null }, { pos: 374.6, text: "(CL)+10%", num: null }, { pos: 403.3, text: "lect.", num: null }],
]

describe('llegeixFinalsAlumnesPdf', () => {
  it('llega la Final de les 9 àrees de la pàgina real de 1A', () => {
    const { files, avisos } = llegeixFinalsAlumnesPdf([PAGINA_1A_REAL])
    expect(avisos).toEqual([])

    const arees = files.map((f) => f.area).sort()
    expect(arees).toEqual([
      'catala', 'castella', 'angles', 'matematiques', 'medi', 'plastica', 'musica', 'efisica', 'religio',
    ].sort())

    for (const f of files) {
      expect(f.classe).toBe('1A')
      expect(f.trimestre).toBe('Final (mitjana)')
      // El total ha de quadrar amb la suma dels quatre recomptes —
      // igual que el "total com a comprovació" dels resums per trimestre.
      expect(f.na + f.as + f.an + f.ae).toBe(f.total)
    }
  })

  it('els 22 alumnes de la classe compten a la majoria d\'àrees, però no a religió', () => {
    const { files } = llegeixFinalsAlumnesPdf([PAGINA_1A_REAL])
    const totalDe = (area) => files.find((f) => f.area === area)?.total ?? 0

    expect(totalDe('catala')).toBe(22)
    expect(totalDe('castella')).toBe(22)
    expect(totalDe('angles')).toBe(22)
    expect(totalDe('matematiques')).toBe(22)
    expect(totalDe('medi')).toBe(22)
    expect(totalDe('plastica')).toBe(22)
    expect(totalDe('musica')).toBe(22)
    // Un alumne no té nota d'e. física en aquesta pàgina real.
    expect(totalDe('efisica')).toBe(21)
    // A 1r la majoria fa "valors" en lloc de "religió" — només 2 en
    // tenen nota aquí. No s'inventa la resta.
    expect(totalDe('religio')).toBe(2)
  })

  it('no confon el "GF" (global d\'Artística) amb cap àrea pròpia', () => {
    const { files } = llegeixFinalsAlumnesPdf([PAGINA_1A_REAL])
    expect(files.some((f) => f.area === 'artistica')).toBe(false)
    expect(files.some((f) => f.area === 'gf')).toBe(false)
  })

  it('acumula per separat quan hi ha diverses pàgines (una per classe)', () => {
    // La mateixa pàgina real, "convertida" en la classe 1B canviant
    // només el codi de classe de cada fila — així es pot comprovar que
    // dues pàgines no es barregen sense haver de capturar-ne una altra.
    const PAGINA_1B_REAL = PAGINA_1A_REAL.map((fila) => fila.map((cel) => (
      cel.text === '1A' ? { ...cel, text: '1B' } : cel
    )))
    const { files } = llegeixFinalsAlumnesPdf([PAGINA_1A_REAL, PAGINA_1B_REAL])
    const classes = new Set(files.map((f) => f.classe))
    expect(classes).toEqual(new Set(['1A', '1B']))
    expect(files.filter((f) => f.area === 'catala' && f.classe === '1A')[0].total).toBe(22)
    expect(files.filter((f) => f.area === 'catala' && f.classe === '1B')[0].total).toBe(22)
  })

  it('avisa i no peta si no troba cap pàgina "alumne per alumne"', () => {
    const { files, avisos } = llegeixFinalsAlumnesPdf([])
    expect(files).toEqual([])
    expect(avisos[0]).toMatch(/no s'ha pogut calcular/)
  })
})

describe('areesFDeCapcalera', () => {
  it('aparella cada àrea amb la seva columna F per posició', () => {
    const capcalera = PAGINA_1A_REAL[1] // la fila de capçalera real
    const arees = areesFDeCapcalera(capcalera)
    expect(arees.map((a) => a.area)).toEqual([
      'catala', 'castella', 'angles', 'matematiques', 'medi',
      'plastica', 'musica', 'efisica', 'religio',
    ])
  })

  it('ajunta un nom d\'àrea de dues paraules partit en dos trossos ("e." + "física")', () => {
    const fila = [
      { pos: 0, text: 'e.', num: null },
      { pos: 10, text: 'física', num: null },
      { pos: 40, text: 'F', num: null },
    ]
    expect(areesFDeCapcalera(fila)).toEqual([{ area: 'efisica', pos: 40 }])
  })

  it('descarta una àrea pendent si no li segueix cap "F"', () => {
    const fila = [
      { pos: 0, text: 'català', num: null },
      { pos: 20, text: 'GF', num: null }, // interromp: la "català" es queda sense F
      { pos: 40, text: 'F', num: null }, // aquesta F no és de ningú
    ]
    expect(areesFDeCapcalera(fila)).toEqual([])
  })
})

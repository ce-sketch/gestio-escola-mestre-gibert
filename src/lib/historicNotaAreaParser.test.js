import { describe, it, expect } from 'vitest'

import { trimestreDeFull, cursEscolarDeFull } from './historicNotaAreaParser'

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

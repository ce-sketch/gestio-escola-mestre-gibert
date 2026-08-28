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

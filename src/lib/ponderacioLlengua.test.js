import { describe, it, expect } from 'vitest'

import { taulaPonderacioLlengua, PONDERACIO_DEFECTE } from './ponderacioLlengua'

describe('taulaPonderacioLlengua', () => {
  it('1r té tres períodes diferents', () => {
    const t = taulaPonderacioLlengua('1r A')
    expect(t.periodes).toHaveLength(3)
    expect(t.periodes[0]).toMatchObject({ id: '1r trimestre', comunicacioOral: '40%', expressioEscrita: '20%', comprensioLectora: '30%' })
    expect(t.periodes[2].comprensioLectora).toBe('30% (CL) + 10% lect.')
  })

  it('2n té dos períodes: 1r trimestre sol, 2n+3r junts', () => {
    const t = taulaPonderacioLlengua('2n B')
    expect(t.periodes).toHaveLength(2)
    expect(t.periodes[0].id).toBe('1r trimestre')
    expect(t.periodes[1].id).toBe('2n i 3r trimestre')
    expect(t.periodes[1]).toMatchObject({ comunicacioOral: '20%', expressioEscrita: '40%' })
  })

  it('de 3r a 6è és un sol període, igual als quatre nivells', () => {
    for (const curs of ['3r A', '4t B', '5è A', '6è C']) {
      const t = taulaPonderacioLlengua(curs)
      expect(t.periodes).toHaveLength(1)
      expect(t.periodes[0]).toMatchObject({ comunicacioOral: '20%', expressioEscrita: '40%', comprensioLectora: '30% (CL) + 10% lect.' })
    }
  })

  it('torna null per a Infantil', () => {
    expect(taulaPonderacioLlengua('P3 A')).toBeNull()
    expect(taulaPonderacioLlengua('I5 B')).toBeNull()
  })

  it('torna null per a un nom de classe no reconegut', () => {
    expect(taulaPonderacioLlengua('')).toBeNull()
    expect(taulaPonderacioLlengua(undefined)).toBeNull()
    expect(taulaPonderacioLlengua('Sense classe')).toBeNull()
  })

  it('amb una config pròpia (per exemple, la desada a Firestore), fa servir aquesta en lloc de la de defecte', () => {
    const configPropia = {
      '1r': { periodes: [{ id: '1r trimestre', comunicacioOral: '50%', expressioEscrita: '10%', comprensioLectora: '40%' }] },
    }
    const t = taulaPonderacioLlengua('1r A', configPropia)
    expect(t.periodes).toHaveLength(1)
    expect(t.periodes[0].comunicacioOral).toBe('50%')
  })

  it('si la config pròpia no porta un nivell concret, cau als valors de defecte per aquell nivell', () => {
    const configPropia = { '1r': { periodes: [{ id: 'x', comunicacioOral: '50%', expressioEscrita: '10%', comprensioLectora: '40%' }] } }
    const t = taulaPonderacioLlengua('4t A', configPropia) // "3r-6e" no hi és a configPropia
    expect(t).toEqual(PONDERACIO_DEFECTE['3r-6e'])
  })
})

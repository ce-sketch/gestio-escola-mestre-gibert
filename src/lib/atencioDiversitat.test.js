import { describe, it, expect } from 'vitest'

import { criteriDiversitat, colorDiversitat, LLEGENDA_DIVERSITAT } from './atencioDiversitat'

describe('criteriDiversitat', () => {
  it('SIEI té prioritat per sobre de tot', () => {
    const a = { siei: true, adTipusA: true, pi: true, adTipusC: true }
    expect(criteriDiversitat(a).id).toBe('siei')
  })

  it('NEE A només compta si NO és SIEI', () => {
    expect(criteriDiversitat({ adTipusA: true, siei: false }).id).toBe('neeA')
    expect(criteriDiversitat({ adTipusA: true, siei: true }).id).toBe('siei')
  })

  it('PI per sobre de Nouvingut si es compleixen tots dos', () => {
    expect(criteriDiversitat({ pi: true, adTipusC: true }).id).toBe('pi')
  })

  it('Nouvingut quan només es compleix aquest', () => {
    expect(criteriDiversitat({ adTipusC: true }).id).toBe('nouvingut')
  })

  it('null si no compleix cap criteri', () => {
    expect(criteriDiversitat({})).toBeNull()
    expect(criteriDiversitat(null)).toBeNull()
    expect(criteriDiversitat(undefined)).toBeNull()
  })
})

describe('colorDiversitat', () => {
  it('torna el color del primer criteri que compleix', () => {
    expect(colorDiversitat({ pi: true })).toBe('#FF00FF')
  })

  it('null si no en compleix cap', () => {
    expect(colorDiversitat({})).toBeNull()
  })
})

describe('LLEGENDA_DIVERSITAT', () => {
  it('cada entrada té id, label, color i una funció compleix', () => {
    for (const c of LLEGENDA_DIVERSITAT) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(typeof c.compleix).toBe('function')
    }
  })
})

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

  it('TCA: té el flag NESE (F) però NO el Tipus A (G)', () => {
    // Casos com altes capacitats o dislèxies: compten com a NESE (F) però
    // no arriben a Tipus A (G) — la diferència entre els dos és el TCA.
    expect(criteriDiversitat({ adFlag: true, adTipusA: false }).id).toBe('tca')
  })

  it('Tipus A (NEE A) mana per sobre de TCA quan es compleixen tots dos', () => {
    // Un alumne amb Tipus A gairebé sempre també té el flag F actiu — no
    // s'ha de veure com a TCA, ha de manar el criteri més específic.
    expect(criteriDiversitat({ adFlag: true, adTipusA: true, siei: false }).id).toBe('neeA')
  })

  it('el flag NESE (F) sol, sense Tipus A, no es confon amb Tipus A', () => {
    expect(criteriDiversitat({ adFlag: true }).id).toBe('tca')
  })

  it('null si no compleix cap criteri', () => {
    expect(criteriDiversitat({})).toBeNull()
    expect(criteriDiversitat(null)).toBeNull()
    expect(criteriDiversitat(undefined)).toBeNull()
  })

  it('amb "actius", ignora els criteris desactivats', () => {
    const a = { siei: true, pi: true }
    // Amb tots dos actius, SIEI mana (és el primer de la llegenda).
    expect(criteriDiversitat(a, new Set(['siei', 'pi'])).id).toBe('siei')
    // Desactivant SIEI, passa a manar el següent que compleixi: PI.
    expect(criteriDiversitat(a, new Set(['pi'])).id).toBe('pi')
    // Sense cap dels dos actius, no en compleix cap.
    expect(criteriDiversitat(a, new Set(['nouvingut']))).toBeNull()
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

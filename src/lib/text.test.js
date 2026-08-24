import { describe, it, expect } from 'vitest'
import { senseAccents, normalitza, paraulesDe, clauDeText } from './text'

describe('senseAccents', () => {
  it('treu els accents catalans', () => {
    expect(senseAccents('Àlvarez Moré Victòria')).toBe('Alvarez More Victoria')
  })
  it('manté les majúscules', () => {
    expect(senseAccents('PÉREZ')).toBe('PEREZ')
  })
  it('no peta amb valors buits', () => {
    expect(senseAccents(null)).toBe('')
    expect(senseAccents(undefined)).toBe('')
  })
})

describe('normalitza', () => {
  it('treu accents, passa a minúscules i retalla espais', () => {
    expect(normalitza('  Àlvarez MORÉ  ')).toBe('alvarez more')
  })
})

describe('paraulesDe', () => {
  it('parteix en paraules ignorant comes i guions', () => {
    expect(paraulesDe('Pérez Mena, Pol-Conan')).toEqual(['perez', 'mena', 'pol', 'conan'])
  })
  it('retorna una llista buida si no hi ha text', () => {
    expect(paraulesDe('')).toEqual([])
  })
})

describe('clauDeText', () => {
  it('dona la mateixa clau escrit de maneres diferents', () => {
    expect(clauDeText('Pérez Mena, Pol-Conan')).toBe(clauDeText('perez mena pol conan'))
  })
  it('no deixa cap signe ni espai', () => {
    expect(clauDeText('A. B-C, D')).toBe('abcd')
  })
})

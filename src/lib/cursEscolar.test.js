import { describe, it, expect } from 'vitest'
import { normalitzaCursEscolar, cursSeguent } from './cursEscolar'

describe('normalitzaCursEscolar', () => {
  it('accepta les formes que la gent escriu de debò', () => {
    expect(normalitzaCursEscolar('2027-28')).toBe('2027-28')
    expect(normalitzaCursEscolar('2027-2028')).toBe('2027-28')
    expect(normalitzaCursEscolar('2027/28')).toBe('2027-28')
    expect(normalitzaCursEscolar(' 2027 - 28 ')).toBe('2027-28')
  })

  it('deixa tal qual el que no reconeix, sense inventar-se res', () => {
    expect(normalitzaCursEscolar('hola')).toBe('hola')
    expect(normalitzaCursEscolar('2027')).toBe('2027')
  })
})

describe('cursSeguent', () => {
  it('avança un any', () => {
    expect(cursSeguent('2026-27')).toBe('2027-28')
  })
  it('funciona en canviar de segle', () => {
    expect(cursSeguent('2099-00')).toBe('2100-01')
  })
})

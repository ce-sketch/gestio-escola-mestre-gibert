import { describe, it, expect } from 'vitest'

import { esAdmin, esComptePersonal, ADMIN_EMAIL } from './roles'

describe('esAdmin', () => {
  // Els mòduls de direcció (SIC, PGAC, Economia, Alumnes, Backup…) es
  // reserven a un únic compte. Aquests tests hi són perquè, si algun dia
  // s'afluixa la comprovació, es vegi aquí i no en producció.
  it('només accepta el compte de direcció', () => {
    expect(ADMIN_EMAIL).toBe('ce@escolamestregibert.cat')
    expect(esAdmin({ email: 'ce@escolamestregibert.cat' })).toBe(true)
  })

  it('no accepta cap altre compte del centre', () => {
    expect(esAdmin({ email: 'mestre@escolamestregibert.cat' })).toBe(false)
    expect(esAdmin({ email: 'cap@escolamestregibert.cat' })).toBe(false)
  })

  it('no accepta un compte de fora, encara que s\'hi assembli', () => {
    expect(esAdmin({ email: 'ce@escolamestregibert.com' })).toBe(false)
    expect(esAdmin({ email: 'ce@altraescola.cat' })).toBe(false)
    expect(esAdmin({ email: 'ce@escolamestregibert.cat.attacker.com' })).toBe(false)
  })

  it('no peta sense usuari ni sense correu', () => {
    expect(esAdmin(null)).toBe(false)
    expect(esAdmin(undefined)).toBe(false)
    expect(esAdmin({})).toBe(false)
  })

  it('no es deixa enganyar per les majúscules', () => {
    expect(esAdmin({ email: 'CE@EscolaMestreGibert.cat' })).toBe(true)
  })
})

describe('esComptePersonal', () => {
  it('accepta el personal del centre', () => {
    expect(esComptePersonal({ email: 'mestre@escolamestregibert.cat' })).toBe(true)
  })

  it('no accepta els comptes d\'alumnat, que comencen per doble zero', () => {
    expect(esComptePersonal({ email: '00123456@escolamestregibert.cat' })).toBe(false)
  })

  it('no accepta comptes d\'altres dominis', () => {
    expect(esComptePersonal({ email: 'algu@gmail.com' })).toBe(false)
    expect(esComptePersonal({ email: 'algu@escolamestregibert.com' })).toBe(false)
  })

  it('no peta sense usuari', () => {
    expect(esComptePersonal(null)).toBe(false)
    expect(esComptePersonal({})).toBe(false)
  })
})

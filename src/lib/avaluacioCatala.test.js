import { describe, it, expect } from 'vitest'

import { NIVELLS, nivellPerId, nivellDe, redueixVigents } from './avaluacioCatala'

describe('NIVELLS', () => {
  it('van de pitjor a millor, sense salts a l\'ordre', () => {
    expect(NIVELLS.map((n) => n.ordre)).toEqual([0, 1, 2, 3])
  })

  it('cap no repeteix identificador', () => {
    const ids = NIVELLS.map((n) => n.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('tots tenen etiqueta, forma curta i color', () => {
    for (const n of NIVELLS) {
      expect(n.label, n.id).toBeTruthy()
      expect(n.curt, n.id).toBeTruthy()
      expect(n.color, n.id).toBeTruthy()
    }
  })
})

describe('nivellPerId', () => {
  it('troba el nivell', () => {
    expect(nivellPerId('assoliment_notable').curt).toBe('AN')
  })

  it('torna null si no el reconeix, en comptes de petar', () => {
    expect(nivellPerId('inventat')).toBeNull()
    expect(nivellPerId(null)).toBeNull()
  })
})

describe('nivellDe', () => {
  it('els llindars són 5, 7 i 8,5', () => {
    expect(nivellDe(4.9).id).toBe('no_assoliment')
    expect(nivellDe(5).id).toBe('assoliment_satisfactori')
    expect(nivellDe(6.9).id).toBe('assoliment_satisfactori')
    expect(nivellDe(7).id).toBe('assoliment_notable')
    expect(nivellDe(8.4).id).toBe('assoliment_notable')
    expect(nivellDe(8.5).id).toBe('assoliment_excel·lent')
    expect(nivellDe(10).id).toBe('assoliment_excel·lent')
  })

  it('el 0 dona nivell: és una nota, no una absència', () => {
    // Amb una comprovació de veritat/falsedat s'hauria pres per "sense
    // nota", i l'alumne hauria desaparegut dels recomptes.
    expect(nivellDe(0)?.id).toBe('no_assoliment')
  })

  it('sense nota torna null', () => {
    expect(nivellDe(null)).toBeNull()
    expect(nivellDe(undefined)).toBeNull()
    expect(nivellDe(NaN)).toBeNull()
  })

  it('el 5 és aprovat: el llindar no es pot moure sense adonar-se\'n', () => {
    // És la frontera que decideix si una àrea consta com a superada a la
    // memòria i al SIC.
    expect(nivellDe(5).ordre).toBeGreaterThan(0)
    expect(nivellDe(4.99).ordre).toBe(0)
  })
})

describe('redueixVigents', () => {
  const clau = (r) => `${r.alumneId}-${r.trimestre}`
  const reg = (alumneId, trimestre, nota, seconds) => ({
    alumneId, trimestre, nota, creatEl: { seconds },
  })

  it('es queda amb el registre més recent de cada clau', () => {
    // És el que fa que una correcció substitueixi la marca anterior:
    // cada canvi afegeix una fila nova, no en modifica cap.
    const r = redueixVigents([
      reg('a', '1r', 4, 1),
      reg('a', '1r', 8, 2),
    ], clau)
    expect(r).toHaveLength(1)
    expect(r[0].nota).toBe(8)
  })

  it('no es fia de l\'ordre de la llista', () => {
    // Firestore no garanteix cap ordre concret: si es fiés de la posició,
    // la nota vigent dependria de l'atzar.
    const r = redueixVigents([
      reg('a', '1r', 8, 2),
      reg('a', '1r', 4, 1),
    ], clau)
    expect(r[0].nota).toBe(8)
  })

  it('separa per clau: alumnes i trimestres diferents no es trepitgen', () => {
    const r = redueixVigents([
      reg('a', '1r', 5, 1), reg('a', '2n', 6, 1), reg('b', '1r', 7, 1),
    ], clau)
    expect(r).toHaveLength(3)
  })

  it('un registre sense data de creació no desbanca un que en té', () => {
    // Els registres antics poden no portar `creatEl`; si comptessin com a
    // més nous, tornarien a manar sobre les correccions posteriors.
    const r = redueixVigents([
      { alumneId: 'a', trimestre: '1r', nota: 4 },
      reg('a', '1r', 9, 5),
    ], clau)
    expect(r[0].nota).toBe(9)
  })

  it('amb només registres antics, en dona un igualment', () => {
    const r = redueixVigents([
      { alumneId: 'a', trimestre: '1r', nota: 4 },
    ], clau)
    expect(r).toHaveLength(1)
  })

  it('no peta amb la llista buida', () => {
    expect(redueixVigents([], clau)).toEqual([])
  })
})

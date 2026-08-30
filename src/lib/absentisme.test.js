import { describe, it, expect, vi } from 'vitest'

// El mòdul importa Firebase per a la descàrrega de registres; aquí només
// es proven els càlculs, que són els que decideixen si una família rep un
// avís d'absentisme.
vi.mock('../firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}), query: () => ({}), where: () => ({}), getDocs: async () => ({ docs: [] }),
}))

const { calculaIndexos, nivellAlerta } = await import('./absentisme')

const alumnes = [{ id: 'a', nom: 'Anna' }, { id: 'b', nom: 'Bru' }]
const marca = (alumneId, data, torn, estat, seconds = 1) => ({
  alumneId, data, torn, estat, creatEl: { seconds },
})

describe('calculaIndexos', () => {
  it('compta cada sessió: un dia lectiu són dos torns', () => {
    // 10 dies lectius = 20 sessions. Dues absències = 10%.
    const r = calculaIndexos(alumnes, [
      marca('a', '2026-09-01', 'mati', 'absent_injustificat'),
      marca('a', '2026-09-01', 'tarda', 'absent_injustificat'),
    ], 10)
    expect(r[0].indexAbsentisme).toBe(10)
  })

  it('distingeix el justificat de l\'injustificat', () => {
    // La distinció importa: els llindars d'alerta miren només
    // l'injustificat, i una família amb parts mèdics no ha de saltar.
    const r = calculaIndexos(alumnes, [
      marca('a', '2026-09-01', 'mati', 'absent_justificat'),
      marca('a', '2026-09-01', 'tarda', 'absent_injustificat'),
    ], 10)
    expect(r[0].absencies).toBe(2)
    expect(r[0].absenciesInjust).toBe(1)
    expect(r[0].indexAbsentisme).toBe(10)
    expect(r[0].indexInjustificat).toBe(5)
  })

  it('els retards no compten com a absències', () => {
    const r = calculaIndexos(alumnes, [
      marca('a', '2026-09-01', 'mati', 'retard_injustificat'),
    ], 10)
    expect(r[0].absencies).toBe(0)
    expect(r[0].retards).toBe(1)
    expect(r[0].retardsInjust).toBe(1)
  })

  it('una correcció posterior substitueix la marca anterior', () => {
    // Si es comptessin totes dues, una absència corregida a justificada
    // seguiria comptant com a injustificada.
    const r = calculaIndexos(alumnes, [
      marca('a', '2026-09-01', 'mati', 'absent_injustificat', 1),
      marca('a', '2026-09-01', 'mati', 'absent_justificat', 2),
    ], 10)
    expect(r[0].absencies).toBe(1)
    expect(r[0].absenciesInjust).toBe(0)
  })

  it('el mateix dia al matí i a la tarda són dues marques diferents', () => {
    const r = calculaIndexos(alumnes, [
      marca('a', '2026-09-01', 'mati', 'absent_injustificat'),
      marca('a', '2026-09-01', 'tarda', 'absent_injustificat'),
    ], 10)
    expect(r[0].absencies).toBe(2)
  })

  it('no barreja els alumnes', () => {
    const r = calculaIndexos(alumnes, [
      marca('a', '2026-09-01', 'mati', 'absent_injustificat'),
    ], 10)
    expect(r.find((x) => x.alumne.id === 'b').absencies).toBe(0)
  })

  it('dona una fila per alumne, encara que no en tingui cap', () => {
    // Si en faltés alguna, la llista de la pantalla no quadraria amb la
    // classe i semblaria que hi ha alumnes perduts.
    expect(calculaIndexos(alumnes, [], 10)).toHaveLength(2)
  })

  it('no divideix per zero si encara no hi ha dies lectius', () => {
    // Passa al principi de curs, i un NaN es propagaria a tota la taula.
    const r = calculaIndexos(alumnes, [marca('a', '2026-09-01', 'mati', 'absent_injustificat')], 0)
    expect(r[0].indexAbsentisme).toBe(0)
    expect(Number.isNaN(r[0].indexAbsentisme)).toBe(false)
  })

  it('ignora els estats que no són ni absència ni retard', () => {
    const r = calculaIndexos(alumnes, [marca('a', '2026-09-01', 'mati', 'present')], 10)
    expect(r[0].absencies).toBe(0)
    expect(r[0].retards).toBe(0)
  })
})

describe('nivellAlerta', () => {
  it('els llindars són 10% (atenció) i 25% (greu)', () => {
    expect(nivellAlerta(9.9)).toBeNull()
    expect(nivellAlerta(10)).toBe('atencio')
    expect(nivellAlerta(24.9)).toBe('atencio')
    expect(nivellAlerta(25)).toBe('greu')
    expect(nivellAlerta(100)).toBe('greu')
  })

  it('sense absentisme injustificat no hi ha alerta', () => {
    expect(nivellAlerta(0)).toBeNull()
  })
})

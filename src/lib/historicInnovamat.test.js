import { describe, it, expect, vi } from 'vitest'

vi.mock('./carregaLlibreries', () => ({ carregaPdfjs: () => {} }))

const {
  momentId, momentsConmat, entradesHistoric, ultimConmatDe, distribucioPerNivell,
} = await import('./historicInnovamat')

describe('momentId', () => {
  it('reconeix el moment del text de la portada', () => {
    expect(momentId('Avaluació final')).toBe('final')
    expect(momentId('Avaluació inicial')).toBe('inici')
  })
  it('per defecte assumeix inici de curs', () => {
    expect(momentId(null)).toBe('inici')
  })
})

describe('momentsConmat', () => {
  it('llegeix el format nou, amb un resultat per moment', () => {
    const r = { conmat: { inici: { nivell: 'Baix' }, final: { nivell: 'Alt' } } }
    expect(momentsConmat(r)).toHaveLength(2)
  })

  it('llegeix també el format antic, sense perdre dades', () => {
    // Els registres desats abans que existís l'històric tenien el ConMat
    // en un sol objecte pla. Han de seguir sortint.
    const r = { conmat: { nivell: 'Alt', moment: 'Avaluació final' } }
    const m = momentsConmat(r)
    expect(m).toHaveLength(1)
    expect(m[0].moment).toBe('final')
    expect(m[0].nivell).toBe('Alt')
  })

  it('no peta si no hi ha ConMat', () => {
    expect(momentsConmat({})).toEqual([])
    expect(momentsConmat(null)).toEqual([])
  })
})

describe('entradesHistoric', () => {
  const registres = [
    { cursEscolar: '2025-26', alumneId: 'a', nom: 'Alumne A', conmat: { inici: { nivell: 'Baix' }, final: { nivell: 'Alt' } } },
    { cursEscolar: '2026-27', alumneId: 'a', nom: 'Alumne A', conmat: { inici: { nivell: 'Mitjà-alt' } } },
    { tipus: 'informe', cursEscolar: '2025-26', classe: '3rA' },
  ]

  it('ignora els registres que no són d\'alumnes', () => {
    expect(entradesHistoric(registres).every((e) => e.alumneId)).toBe(true)
  })

  it('ordena del curs més recent al més antic', () => {
    expect(entradesHistoric(registres)[0].cursEscolar).toBe('2026-27')
  })

  it('dins d\'un curs, el final va abans que l\'inici', () => {
    const del25 = entradesHistoric(registres).filter((e) => e.cursEscolar === '2025-26')
    expect(del25[0].moment).toBe('final')
  })
})

describe('ultimConmatDe', () => {
  const registres = [
    { cursEscolar: '2025-26', alumneId: 'a', nom: 'A', conmat: { final: { nivell: 'Baix' } } },
    { cursEscolar: '2026-27', alumneId: 'a', nom: 'A', conmat: { inici: { nivell: 'Alt' } } },
  ]

  it('retorna el resultat més recent de l\'alumne', () => {
    expect(ultimConmatDe(registres, 'a').nivell).toBe('Alt')
  })

  it('retorna null si no se li demana cap alumne', () => {
    expect(ultimConmatDe(registres, '')).toBeNull()
  })

  it('no confon un alumne sense fitxa amb un altre', () => {
    const amb = [{ cursEscolar: '2025-26', alumneId: null, nom: 'X', sensCasar: true, conmat: { final: { nivell: 'Baix' } } }]
    expect(ultimConmatDe(amb, 'a')).toBeNull()
  })
})

describe('distribucioPerNivell', () => {
  it('compta els alumnes de cada nivell i en calcula el percentatge', () => {
    const { files, total } = distribucioPerNivell([
      { nivell: 'Baix' }, { nivell: 'Baix' }, { nivell: 'Alt' }, { nivell: 'Mitjà-alt' },
    ])
    expect(total).toBe(4)
    expect(files.find((f) => f.nivell === 'Baix').alumnes).toBe(2)
    expect(files.find((f) => f.nivell === 'Baix').percentatge).toBe(50)
  })

  it('no divideix per zero quan no hi ha dades', () => {
    const { files } = distribucioPerNivell([])
    expect(files.every((f) => f.percentatge === 0)).toBe(true)
  })
})

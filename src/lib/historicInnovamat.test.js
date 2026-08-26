import { describe, it, expect, vi } from 'vitest'

vi.mock('./carregaLlibreries', () => ({ carregaPdfjs: () => {} }))

const {
  momentId, momentsConmat, entradesHistoric, ultimConmatDe, ultimCosmosDe, distribucioPerNivell,
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

  it('normalitza el moment del format nou encara que el text lliure de la portada hi sigui a dins', () => {
    // Bug real (curs 2025-26): `resultat()` desa dins de cada moment un
    // camp `moment` amb el text de la portada ("Avaluació final"), no
    // l'id normalitzat. Si l'expansió d'aquest objecte va DESPRÉS de fixar
    // `moment: m.id`, el text lliure el sobreescriu i tota la secció
    // "Evolució del centre" es queda buida perquè mai troba cap entrada
    // amb moment === 'final'.
    const r = { conmat: { final: { nivell: 'Alt', moment: 'Avaluació final', classe: '3rA' } } }
    const [entrada] = momentsConmat(r)
    expect(entrada.moment).toBe('final')
    expect(entrada.classe).toBe('3rA')
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

  it('marca com a noAvaluat l\'alumne que consta a l\'informe però no va fer la prova', () => {
    const amb = [
      { cursEscolar: '2025-26', alumneId: 'b', nom: 'Alumne B', conmat: { final: { nivell: null, noAvaluat: true, classe: '3rA' } } },
    ]
    const [entrada] = entradesHistoric(amb)
    expect(entrada.noAvaluat).toBe(true)
    expect(entrada.nivell).toBeNull()
  })

  it('no marca noAvaluat un alumne normal, encara que el registre sigui del format antic', () => {
    expect(entradesHistoric(registres)[0].noAvaluat).toBe(false)
  })

  it('les entrades del format nou queden filtrables per moment normalitzat, no pel text de la portada', () => {
    // És exactament el que fa servir "Evolució del centre" a
    // HistoricInnovamat.jsx: filtra `entrades` per `e.moment === 'final'`.
    // Si el moment es queda amb el text lliure ("Avaluació final") en
    // comptes de l'id, aquest filtre no troba mai res i la secció sencera
    // surt buida encara que hi hagi 207 alumnes desats.
    const amb = [{
      cursEscolar: '2025-26', alumneId: 'c', nom: 'Alumne C',
      conmat: { final: { nivell: 'Baix', moment: 'Avaluació final', classe: '3rA' } },
    }]
    const entrades = entradesHistoric(amb)
    expect(entrades.filter((e) => e.moment === 'final')).toHaveLength(1)
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

describe('ultimCosmosDe', () => {
  // A 1r i 2n la prova d'Innovamat és el COSMOS, no el ConMat: aquests
  // registres no tenen mai `conmat`, només `cosmos`. `ultimConmatDe` hi
  // torna null (correcte), però l'informe individual ha de poder mostrar
  // igualment el resultat del COSMOS en comptes de dir que no n'hi ha cap.
  const registres = [
    { cursEscolar: '2024-25', alumneId: 'a', nom: 'A', cosmos: { moments: { inicial: { rendiment: 'Baix' }, final: { rendiment: 'Mitjà' } } } },
    { cursEscolar: '2025-26', alumneId: 'a', nom: 'A', cosmos: { moments: { inicial: { rendiment: 'Alt' }, final: { rendiment: 'Alt' } } } },
  ]

  it('retorna el resultat del curs més recent', () => {
    expect(ultimCosmosDe(registres, 'a').cursEscolar).toBe('2025-26')
    expect(ultimCosmosDe(registres, 'a').moments.final.rendiment).toBe('Alt')
  })

  it('retorna null si no se li demana cap alumne', () => {
    expect(ultimCosmosDe(registres, '')).toBeNull()
  })

  it('retorna null si l\'alumne no té cap COSMOS desat (per exemple, si ja és a un curs amb ConMat)', () => {
    const amb = [{ cursEscolar: '2025-26', alumneId: 'b', nom: 'B', conmat: { final: { nivell: 'Alt' } } }]
    expect(ultimCosmosDe(amb, 'b')).toBeNull()
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

  it('els alumnes sense nivell (no van fer la prova) no compten al total ni als percentatges', () => {
    // Cas real: als totals de l'Excel hi ha alumnes que l'app no comptava
    // perquè el PDF diu "Aquest alumne no ha fet la ConMat...". Es desen
    // amb `nivell: null`, però no es poden classificar en cap dels quatre
    // nivells.
    const entrades = [
      { nivell: 'Alt' }, { nivell: 'Alt' }, { nivell: 'Baix' },
      { nivell: null, noAvaluat: true }, { nivell: null, noAvaluat: true },
    ]
    const { total, noAvaluats, totalGeneral, files } = distribucioPerNivell(entrades)
    expect(total).toBe(3)
    expect(noAvaluats).toBe(2)
    expect(totalGeneral).toBe(5) // el que ha de quadrar amb l'Excel
    expect(files.find((f) => f.nivell === 'Alt').percentatge).toBeCloseTo(66.67, 1)
  })
})

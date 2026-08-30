import { describe, it, expect } from 'vitest'

import {
  cursCurt, trimestreDe, provaDeFull, subprovaDe,
  agrupaVlcl, nomesTee, fusionaRegistres, cursosDe, treuCurs,
} from './historicProvesImport'

describe('cursCurt', () => {
  it('normalitza les formes que surten als fulls', () => {
    expect(cursCurt('22-23')).toBe('22-23')
    expect(cursCurt('2022-23')).toBe('22-23')
    expect(cursCurt('2022-2023')).toBe('22-23')
    expect(cursCurt('2022/23')).toBe('22-23')
  })

  it('aguanta els espais al voltant del guionet', () => {
    expect(cursCurt(' 22 - 23 ')).toBe('22-23')
  })

  it('torna null si no ho és, en comptes d\'endevinar-ho', () => {
    expect(cursCurt('Total')).toBeNull()
    expect(cursCurt('215')).toBeNull()
    expect(cursCurt('')).toBeNull()
    expect(cursCurt(null)).toBeNull()
  })
})

describe('trimestreDe', () => {
  it('reconeix els trimestres', () => {
    expect(trimestreDe('1r trimestre')).toBe('1r')
    expect(trimestreDe('2n trimestre')).toBe('2n')
    expect(trimestreDe('3r trimestre')).toBe('3r')
  })

  it('reconeix el vocabulari de la VL/CL', () => {
    // Als fulls de lectura els moments no es diuen "trimestre".
    expect(trimestreDe('Avaluació Inicial')).toBe('1r')
    expect(trimestreDe('Avaluació Final')).toBe('3r')
    expect(trimestreDe('Avaluació Mitjana')).toBe('2n')
  })

  it('torna null si no en reconeix cap', () => {
    expect(trimestreDe('Curs')).toBeNull()
    expect(trimestreDe('')).toBeNull()
  })
})

describe('provaDeFull i subprovaDe', () => {
  it('reconeix els fulls del centre', () => {
    expect(provaDeFull('Resultats TEE')).toBe('tee')
    expect(provaDeFull('Resultats VLCL')).toBe('vlcl')
  })

  it('descarta els fulls que no són de resultats', () => {
    expect(provaDeFull('Notes')).toBeNull()
    expect(provaDeFull('1A')).toBeNull()
  })

  it('distingeix el bloc de velocitat del de comprensió', () => {
    expect(subprovaDe('Velocitat lectora (VL)')).toBe('vl')
    expect(subprovaDe('Comprensió lectora (CL)')).toBe('cl')
    expect(subprovaDe('Curs')).toBeNull()
  })
})

describe('agrupaVlcl', () => {
  const llegits = [
    { prova: 'vlcl', subprova: 'vl', trimestre: '1r', curs: '22-23', na: 20, asat: 60, anot: 100, aexc: 35, total: 215 },
    { prova: 'vlcl', subprova: 'cl', trimestre: '1r', curs: '22-23', na: 10, asat: 45, anot: 120, aexc: 40, total: 215 },
    { prova: 'tee', trimestre: '1r', curs: '22-23', na: 30, asat: 70, anot: 90, aexc: 25, total: 215 },
  ]

  it('ajunta la velocitat i la comprensió en un sol registre', () => {
    // És la forma que ja té Firestore: canviar-la voldria dir migrar les
    // dades que hi ha desades.
    const [r] = agrupaVlcl(llegits)
    expect(r.vl.na).toBe(20)
    expect(r.cl.na).toBe(10)
  })

  it('no s\'emporta les files del TEE', () => {
    expect(agrupaVlcl(llegits)).toHaveLength(1)
  })

  it('deixa a zero la meitat que falti, en comptes de no posar-hi res', () => {
    // Un full que només tingui la velocitat ha de donar un registre
    // vàlid: qui el llegeix espera trobar-hi sempre les dues.
    const [r] = agrupaVlcl([llegits[0]])
    expect(r.cl.total).toBe(0)
    expect(r.cl.na).toBe(0)
  })

  it('no peta sense registres', () => {
    expect(agrupaVlcl(null)).toEqual([])
  })
})

describe('nomesTee', () => {
  it('treu els camps interns del lector', () => {
    const [r] = nomesTee([{ prova: 'tee', subprova: null, trimestre: '1r', curs: '22-23', na: 1, total: 1 }])
    expect(r.prova).toBeUndefined()
    expect(r.subprova).toBeUndefined()
    expect(r.curs).toBe('22-23')
  })

  it('no s\'emporta les files de VL/CL', () => {
    expect(nomesTee([{ prova: 'vlcl', curs: '22-23' }])).toEqual([])
  })
})

describe('fusionaRegistres', () => {
  const existents = [
    { trimestre: '1r', curs: '22-23', na: 30 },
    { trimestre: '1r', curs: '23-24', na: 28 },
  ]

  it('substitueix els cursos que es tornen a pujar', () => {
    // Tornar a pujar un full corregit no ha d'obligar a esborrar res abans.
    const nous = [{ trimestre: '1r', curs: '22-23', na: 99 }]
    const r = fusionaRegistres(existents, nous)
    expect(r).toHaveLength(2)
    expect(r.find((x) => x.curs === '22-23').na).toBe(99)
  })

  it('conserva els que no es tornen a pujar', () => {
    const r = fusionaRegistres(existents, [{ trimestre: '1r', curs: '22-23', na: 99 }])
    expect(r.find((x) => x.curs === '23-24').na).toBe(28)
  })

  it('el mateix curs a trimestres diferents són registres diferents', () => {
    const nous = [{ trimestre: '3r', curs: '22-23', na: 15 }]
    expect(fusionaRegistres(existents, nous)).toHaveLength(3)
  })

  it('no peta sense res', () => {
    expect(fusionaRegistres(null, null)).toEqual([])
  })
})

describe('cursosDe i treuCurs', () => {
  const registres = [
    { trimestre: '1r', curs: '22-23' },
    { trimestre: '3r', curs: '22-23' },
    { trimestre: '1r', curs: '23-24' },
  ]

  it('llista els cursos del més recent al més antic', () => {
    expect(cursosDe(registres)).toEqual(['23-24', '22-23'])
  })

  it('desfer un curs se n\'emporta tots els trimestres', () => {
    // Si en deixés algun, l'històric quedaria a mitges sense dir-ho.
    expect(treuCurs(registres, '22-23')).toHaveLength(1)
  })

  it('desfer un curs que no hi és no toca res', () => {
    expect(treuCurs(registres, '99-00')).toHaveLength(3)
  })

  it('no peta sense registres', () => {
    expect(cursosDe(null)).toEqual([])
    expect(treuCurs(null, '22-23')).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'

import {
  PROVES, provaPerId, nivellDeClasse, classesDeLaProva, classesActives,
  passaLaProva, ambClasse, ambTotesLesClasses, copiaMoment, resumExclusions,
  clauExclusio,
} from './provesActives'

const CLASSES = [
  'I3A', 'I4A', 'I4B', 'I5A', 'I5B',
  '1rA', '1rB', '2nA', '2nB', '3rA', '3rB', '4rtA', '5èA', '6èA',
]

describe('nivellDeClasse', () => {
  it('reconeix Infantil i primària', () => {
    expect(nivellDeClasse('I4A')).toBe('I4')
    expect(nivellDeClasse('1rA')).toBe('1')
    expect(nivellDeClasse('4rtB')).toBe('4')
    expect(nivellDeClasse('6èA')).toBe('6')
  })

  it('no peta amb valors estranys', () => {
    expect(nivellDeClasse('')).toBeNull()
    expect(nivellDeClasse(null)).toBeNull()
    expect(nivellDeClasse('ZZ')).toBeNull()
  })
})

describe('PROVES', () => {
  it('hi ha una entrada per a cada prova del centre', () => {
    expect(PROVES.map((p) => p.id)).toEqual([
      'lectoescriptura', 'tee', 'lectura', 'lecturaCl', 'notaArea', 'cosmos', 'conmat',
    ])
  })

  it('cada prova diu a quins nivells s\'adreça i quins moments té', () => {
    for (const p of PROVES) {
      expect(p.nivells.length, `${p.id} sense nivells`).toBeGreaterThan(0)
      expect(p.moments.length, `${p.id} sense moments`).toBeGreaterThan(0)
      expect(p.nom).toBeTruthy()
    }
  })

  it('el ConMat conserva l\'id "inici" i el COSMOS "inicial"', () => {
    // Tenen la mateixa etiqueta però ids diferents, i és així a les dades
    // ja desades. Unificar-los trencaria l'històric.
    expect(provaPerId('conmat').moments.map((m) => m.id)).toEqual(['inici', 'final'])
    expect(provaPerId('cosmos').moments.map((m) => m.id)).toEqual(['inicial', 'final'])
  })

  it('cada prova fa servir el vocabulari del seu document d\'origen', () => {
    // No s'unifiquen: el TEE es qualifica per trimestres, el VL/CL es
    // mesura en tres moments i l'Innovamat passa dues proves l'any.
    expect(provaPerId('tee').moments[0].label).toMatch(/trimestre/i)
    expect(provaPerId('lectura').moments[0].label).toMatch(/Avaluació/i)
    expect(provaPerId('conmat').moments[0].label).toMatch(/curs/i)
  })
})

describe('classesDeLaProva', () => {
  it('el COSMOS només s\'adreça a 1r i 2n', () => {
    expect(classesDeLaProva(provaPerId('cosmos'), CLASSES)).toEqual(['1rA', '1rB', '2nA', '2nB'])
  })

  it('el ConMat, de 3r a 6è', () => {
    expect(classesDeLaProva(provaPerId('conmat'), CLASSES)).toEqual(['3rA', '3rB', '4rtA', '5èA', '6èA'])
  })

  it('la lectoescriptura, I4 i I5 (I3 no)', () => {
    expect(classesDeLaProva(provaPerId('lectoescriptura'), CLASSES)).toEqual(['I4A', 'I4B', 'I5A', 'I5B'])
  })

  it('el TEE, tota la primària i cap d\'Infantil', () => {
    const c = classesDeLaProva(provaPerId('tee'), CLASSES)
    expect(c).not.toContain('I5A')
    expect(c).toContain('1rA')
  })
})

describe('classesActives', () => {
  it('sense configurar res, les passen totes les que els toca', () => {
    // Una escola que no toqui res ho ha de veure tot: la configuració
    // només serveix per treure'n.
    expect(classesActives(null, 'lectoescriptura', 'curs', CLASSES))
      .toEqual(['I4A', 'I4B', 'I5A', 'I5B'])
  })

  it('treu les que s\'hagin desmarcat, només d\'aquell moment', () => {
    const config = { exclusions: { [clauExclusio('tee', '1')]: ['1rA', '1rB'] } }
    expect(classesActives(config, 'tee', '1', CLASSES)).not.toContain('1rA')
    // El tercer trimestre no queda afectat.
    expect(classesActives(config, 'tee', '3', CLASSES)).toContain('1rA')
  })

  it('una exclusió d\'una classe que no fa la prova no hi fa res', () => {
    const config = { exclusions: { [clauExclusio('cosmos', 'final')]: ['5èA'] } }
    expect(classesActives(config, 'cosmos', 'final', CLASSES)).toEqual(['1rA', '1rB', '2nA', '2nB'])
  })

  it('passaLaProva respon per una classe sola', () => {
    const config = { exclusions: { [clauExclusio('tee', '1')]: ['1rA'] } }
    expect(passaLaProva(config, 'tee', '1', '1rA')).toBe(false)
    expect(passaLaProva(config, 'tee', '1', '2nA')).toBe(true)
  })
})

describe('ambClasse', () => {
  it('desmarcar una classe la treu del moment', () => {
    const nou = ambClasse(null, 'tee', '1', '1rA', false)
    expect(classesActives(nou, 'tee', '1', CLASSES)).not.toContain('1rA')
  })

  it('tornar-la a marcar la retorna', () => {
    let c = ambClasse(null, 'tee', '1', '1rA', false)
    c = ambClasse(c, 'tee', '1', '1rA', true)
    expect(classesActives(c, 'tee', '1', CLASSES)).toContain('1rA')
  })

  it('no modifica la configuració que rep', () => {
    // Qui la crida ha de poder comparar l'abans i el després per saber
    // si cal desar.
    const original = { exclusions: {} }
    ambClasse(original, 'tee', '1', '1rA', false)
    expect(original.exclusions).toEqual({})
  })

  it('quan no queda cap exclusió, no deixa la clau buida', () => {
    let c = ambClasse(null, 'tee', '1', '1rA', false)
    c = ambClasse(c, 'tee', '1', '1rA', true)
    expect(c.exclusions[clauExclusio('tee', '1')]).toBeUndefined()
  })
})

describe('ambTotesLesClasses', () => {
  it('desmarca-les totes deixa el moment sense cap classe', () => {
    const c = ambTotesLesClasses(null, 'cosmos', 'final', CLASSES, false)
    expect(classesActives(c, 'cosmos', 'final', CLASSES)).toEqual([])
  })

  it('marca-les totes esborra les exclusions d\'aquell moment', () => {
    let c = ambTotesLesClasses(null, 'cosmos', 'final', CLASSES, false)
    c = ambTotesLesClasses(c, 'cosmos', 'final', CLASSES, true)
    expect(classesActives(c, 'cosmos', 'final', CLASSES)).toHaveLength(4)
  })
})

describe('copiaMoment', () => {
  it('copia el que hi ha marcat d\'un moment a un altre', () => {
    // El cas freqüent: a 1r no passen les proves fins al tercer
    // trimestre, i marcar-ho moment per moment és repetitiu.
    let c = ambClasse(null, 'tee', '1', '1rA', false)
    c = ambClasse(c, 'tee', '1', '1rB', false)
    c = copiaMoment(c, 'tee', '1', '2')
    expect(classesActives(c, 'tee', '2', CLASSES)).not.toContain('1rA')
    expect(classesActives(c, 'tee', '2', CLASSES)).not.toContain('1rB')
  })

  it('copiar un moment sense exclusions neteja el de destí', () => {
    let c = ambClasse(null, 'tee', '3', '1rA', false)
    c = copiaMoment(c, 'tee', '1', '3')
    expect(classesActives(c, 'tee', '3', CLASSES)).toContain('1rA')
  })
})

describe('resumExclusions', () => {
  it('diu quantes classes queden fora de cada prova', () => {
    const c = ambClasse(null, 'lectoescriptura', 'curs', 'I4A', false)
    const resum = resumExclusions(c, CLASSES)
    const lecto = resum.find((r) => r.prova.id === 'lectoescriptura')
    expect(lecto).toMatchObject({ totalClasses: 4, ambExclusions: 1 })
  })

  it('sense configurar res, cap prova té exclusions', () => {
    expect(resumExclusions(null, CLASSES).every((r) => r.ambExclusions === 0)).toBe(true)
  })

  it('no compta exclusions de classes que no fan la prova', () => {
    const c = { exclusions: { [clauExclusio('cosmos', 'final')]: ['6èA'] } }
    const cosmos = resumExclusions(c, CLASSES).find((r) => r.prova.id === 'cosmos')
    expect(cosmos.ambExclusions).toBe(0)
  })
})

describe('CL separada de la VL', () => {
  // Cas real: a 1r, segons com vagi de maduresa el grup, es fa la
  // velocitat al setembre i la comprensió es deixa per al juny. Amb una
  // sola prova per a totes dues no es podia dir.
  const config = { exclusions: { lecturaCl__inicial: ['1rA', '1rB'] } }

  it('la CL és una prova pròpia, a part de la VL', () => {
    expect(provaPerId('lecturaCl')).toBeTruthy()
    expect(provaPerId('lectura')).toBeTruthy()
  })

  it('desmarcar la CL no toca la VL', () => {
    expect(passaLaProva(config, 'lecturaCl', 'inicial', '1rA')).toBe(false)
    expect(passaLaProva(config, 'lectura', 'inicial', '1rA')).toBe(true)
  })

  it('la mateixa classe pot fer la CL al final i no a l\'inicial', () => {
    expect(passaLaProva(config, 'lecturaCl', 'inicial', '1rA')).toBe(false)
    expect(passaLaProva(config, 'lecturaCl', 'final', '1rA')).toBe(true)
  })

  it('no afecta les altres classes', () => {
    expect(passaLaProva(config, 'lecturaCl', 'inicial', '3rA')).toBe(true)
  })

  it('per defecte totes les classes fan la CL', () => {
    expect(passaLaProva(null, 'lecturaCl', 'inicial', '1rA')).toBe(true)
  })

  it('la CL no ofereix l\'Avaluació Mitjana, que no en té mai', () => {
    // Oferir-la faria pensar que es pot activar.
    const moments = provaPerId('lecturaCl').moments.map((m) => m.id)
    expect(moments).toEqual(['inicial', 'final'])
    expect(provaPerId('lectura').moments.map((m) => m.id)).toContain('mitjana')
  })

  it('totes dues es passen només a primària', () => {
    expect(provaPerId('lecturaCl').nivells).toEqual(provaPerId('lectura').nivells)
  })
})

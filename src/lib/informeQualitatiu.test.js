import { describe, it, expect } from 'vitest'

import { generaInformeQualitatiu, tendenciaCriteris, primerNom, deNom, comptadorDeNom } from './informeQualitatiu'

// Rúbrica simplificada, amb la mateixa forma que la real: MENYS punts és
// MILLOR nivell (1 = alt).
const NIVELLS = [
  { id: 'ae', label: 'Assoliment Excel·lent', punts: 1 },
  { id: 'an', label: 'Assoliment Notable', punts: 2 },
  { id: 'as', label: 'Assoliment Satisfactori', punts: 3 },
  { id: 'na', label: 'No assoliment', punts: 4 },
]
const CRITERIS = [
  { id: 'coherencia', label: 'Coherència' },
  { id: 'lexic', label: 'Lèxic' },
  { id: 'ortografia', label: 'Ortografia' },
]
const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']

const tee = (global, criteris) => ({ global, criteris })

describe('primerNom', () => {
  it('agafa el nom de fonts de "Cognoms, Nom"', () => {
    expect(primerNom('Alfa Beta, Anna')).toBe('Anna')
  })
  it('agafa la primera paraula si no hi ha coma', () => {
    expect(primerNom('Anna Alfa')).toBe('Anna')
  })
  it('no peta sense nom', () => {
    expect(primerNom('')).toBe('')
    expect(primerNom(null)).toBe('')
  })
})

describe('tendenciaCriteris', () => {
  it('detecta el criteri fluix a TOTS els trimestres', () => {
    // Cas real que abans es perdia: l'ortografia és el punt més fluix els
    // tres trimestres, però la proposta sortia només de l'últim.
    const per = {
      '1r trimestre': tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'na' }),
      '2n trimestre': tee('an', { coherencia: 'ae', lexic: 'ae', ortografia: 'na' }),
      '3r trimestre': tee('an', { coherencia: 'ae', lexic: 'ae', ortografia: 'as' }),
    }
    expect(tendenciaCriteris(TRIMESTRES, per, CRITERIS, NIVELLS).persistent).toBe('ortografia')
  })

  it('no diu que sigui persistent si va canviant', () => {
    const per = {
      '1r trimestre': tee('an', { coherencia: 'na', lexic: 'ae', ortografia: 'ae' }),
      '2n trimestre': tee('an', { coherencia: 'ae', lexic: 'na', ortografia: 'ae' }),
    }
    expect(tendenciaCriteris(TRIMESTRES, per, CRITERIS, NIVELLS).persistent).toBeNull()
  })

  it('detecta el criteri que més ha millorat', () => {
    const per = {
      '1r trimestre': tee('as', { coherencia: 'na', lexic: 'an', ortografia: 'an' }),
      '3r trimestre': tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'an' }),
    }
    expect(tendenciaCriteris(TRIMESTRES, per, CRITERIS, NIVELLS).millorat).toBe('coherencia')
  })

  it('no considera millora un canvi de menys d\'un nivell', () => {
    const per = {
      '1r trimestre': tee('an', { coherencia: 'an', lexic: 'an', ortografia: 'an' }),
      '3r trimestre': tee('an', { coherencia: 'an', lexic: 'an', ortografia: 'an' }),
    }
    expect(tendenciaCriteris(TRIMESTRES, per, CRITERIS, NIVELLS).millorat).toBeNull()
  })

  it('no diu res amb un sol trimestre: no hi ha tendència possible', () => {
    const per = { '1r trimestre': tee('an', { coherencia: 'na', lexic: 'ae', ortografia: 'ae' }) }
    expect(tendenciaCriteris(TRIMESTRES, per, CRITERIS, NIVELLS)).toEqual({ persistent: null, millorat: null })
  })

  it('no peta sense cap dada', () => {
    expect(tendenciaCriteris(TRIMESTRES, {}, CRITERIS, NIVELLS)).toEqual({ persistent: null, millorat: null })
  })
})

describe('generaInformeQualitatiu', () => {
  const base = {
    nom: 'Alfa Beta, Anna',
    trimestres: TRIMESTRES,
    criterisTee: CRITERIS,
    nivellsCicle: NIVELLS,
    momentsLectura: [
      { id: 'inicial', label: 'primera avaluació', teCL: true },
      { id: 'final', label: 'avaluació final', teCL: true },
    ],
    lecturaPerMoment: {},
    teePerTrimestre: {},
  }

  it('avisa quan no hi ha prou dades, en comptes d\'inventar-se un text', () => {
    expect(generaInformeQualitatiu(base)).toMatch(/Encara no hi ha prou dades/i)
  })

  it('només fa servir el nom de fonts, mai els cognoms', () => {
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: { '1r trimestre': tee('ae', { coherencia: 'ae' }) },
    })
    expect(text).toContain('Anna')
    expect(text).not.toContain('Beta')
  })

  it('esmenta el criteri fluix de tot el curs', () => {
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: {
        '1r trimestre': tee('an', { coherencia: 'ae', lexic: 'ae', ortografia: 'na' }),
        '2n trimestre': tee('an', { coherencia: 'ae', lexic: 'ae', ortografia: 'na' }),
        '3r trimestre': tee('an', { coherencia: 'ae', lexic: 'ae', ortografia: 'na' }),
      },
    })
    expect(text).toMatch(/tot el curs|tres trimestres/i)
  })

  it('reconeix en què s\'ha millorat', () => {
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: {
        '1r trimestre': tee('as', { coherencia: 'na', lexic: 'an', ortografia: 'an' }),
        '3r trimestre': tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'an' }),
      },
    })
    expect(text).toMatch(/avançat|crescut|progrés/i)
  })

  it('descriu com evoluciona la comprensió lectora, no només la velocitat', () => {
    const text = generaInformeQualitatiu({
      ...base,
      lecturaPerMoment: {
        inicial: { vl: 60, nivellVl: 'baix', cl: 4, nivellCl: 'baix' },
        final: { vl: 90, nivellVl: 'mitjà', cl: 8, nivellCl: 'alt' },
      },
    })
    expect(text).toMatch(/comprensió lectora ha guanyat terreny/i)
  })

  it('sempre acaba amb una proposta de treball', () => {
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: { '1r trimestre': tee('ae', { coherencia: 'ae' }) },
    })
    expect(text).toMatch(/propos|de cara/i)
  })

  it('el mateix alumne dona sempre el mateix text', () => {
    const args = { ...base, teePerTrimestre: { '1r trimestre': tee('an', { coherencia: 'an' }) } }
    expect(generaInformeQualitatiu(args)).toBe(generaInformeQualitatiu(args))
  })

  it('alumnes diferents amb les mateixes notes no tenen textos calcats', () => {
    const textos = ['Anna', 'Bru', 'Cesc', 'Dora', 'Eloi']
      .map((n) => generaInformeQualitatiu({
        ...base, nom: `Cognom, ${n}`,
        teePerTrimestre: { '1r trimestre': tee('an', { coherencia: 'an' }) },
      }))
    expect(new Set(textos).size).toBeGreaterThan(1)
  })
})

describe('deNom', () => {
  it('apostrofa davant de vocal', () => {
    expect(deNom('Anna')).toBe("d'Anna")
    expect(deNom('Eloi')).toBe("d'Eloi")
    expect(deNom('Irene')).toBe("d'Irene")
  })

  it('apostrofa davant de h muda', () => {
    expect(deNom('Hugo')).toBe("d'Hugo")
  })

  it('no apostrofa davant de consonant', () => {
    expect(deNom('Bru')).toBe('de Bru')
    expect(deNom('Pol')).toBe('de Pol')
  })

  it('aguanta els accents inicials', () => {
    expect(deNom('Àlex')).toBe("d'Àlex")
    expect(deNom('Òscar')).toBe("d'Òscar")
  })

  it('no peta sense nom', () => {
    expect(deNom('')).toBe('de')
    expect(deNom(null)).toBe('de')
  })
})

describe('no repetir-se', () => {
  const base = {
    nom: 'Alfa Beta, Anna',
    trimestres: TRIMESTRES,
    criterisTee: CRITERIS,
    nivellsCicle: NIVELLS,
    momentsLectura: [{ id: 'inicial', label: 'primera avaluació', teCL: true }],
    lecturaPerMoment: { inicial: { vl: 80, nivellVl: 'mitjà', cl: 7, nivellCl: 'mitjà' } },
    teePerTrimestre: {},
  }

  it('el nom no surt més de dues vegades', () => {
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: {
        '1r trimestre': tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'na' }),
        '2n trimestre': tee('an', { coherencia: 'ae', lexic: 'ae', ortografia: 'as' }),
        '3r trimestre': tee('ae', { coherencia: 'ae', lexic: 'ae', ortografia: 'an' }),
      },
    })
    expect((text.match(/Anna/g) ?? []).length).toBeLessThanOrEqual(2)
  })

  it('els cognoms no surten mai', () => {
    const text = generaInformeQualitatiu({
      ...base, teePerTrimestre: { '1r trimestre': tee('an', { coherencia: 'an' }) },
    })
    expect(text).not.toMatch(/Alfa|Beta/)
  })

  it('un comptador de fora limita el total: si ja s\'ha gastat, no en gasta més', () => {
    // És el que passa a l'informe de l'alumne: el paràgraf de matemàtiques
    // ja n'ha consumit un abans d'arribar aquí.
    const noms = comptadorDeNom('Anna', 1)
    noms.seguent() // el gasta el paràgraf de matemàtiques
    const text = generaInformeQualitatiu({
      ...base, noms,
      teePerTrimestre: { '1r trimestre': tee('an', { coherencia: 'an' }) },
    })
    expect(text).not.toContain('Anna')
  })

  it('no torna a destacar els mateixos dos criteris si no han canviat', () => {
    // Amb notes idèntiques als tres trimestres, dir tres vegades el mateix
    // amb altres paraules sembla informació nova quan no ho és.
    const iguals = tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'na' })
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: { '1r trimestre': iguals, '2n trimestre': iguals, '3r trimestre': iguals },
    })
    const menciona = (text.match(/mentre que/g) ?? []).length
    expect(menciona).toBe(1)
  })

  it('sí que ho torna a dir si els criteris destacats canvien', () => {
    const text = generaInformeQualitatiu({
      ...base,
      teePerTrimestre: {
        '1r trimestre': tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'na' }),
        '2n trimestre': tee('an', { coherencia: 'na', lexic: 'an', ortografia: 'ae' }),
      },
    })
    expect((text.match(/mentre que/g) ?? []).length).toBe(2)
  })
})

describe('sense frases repetides', () => {
  const NOMS_PROVA = ['Alfa, Anna', 'Gomez, Bru', 'Puig, Cesc', 'Roca, Dora']
  const M = [
    { id: 'inicial', label: 'primera avaluació', teCL: true },
    { id: 'mitja', label: 'segona avaluació', teCL: true },
    { id: 'final', label: 'avaluació final', teCL: true },
  ]

  /** Les frases que surten dues vegades EXACTAMENT igual dins d'un text. */
  const repetides = (text) => {
    const frases = text.split(/(?<=\.)\s+/).map((f) => f.trim()).filter(Boolean)
    return frases.filter((f, i) => frases.indexOf(f) !== i)
  }

  it('cap informe no repeteix una frase, sigui quina sigui la combinació', () => {
    // Barrida per totes les combinacions de nivell global a dos
    // trimestres. Abans, amb notes iguals sortien tres frases dient el
    // mateix amb altres paraules.
    for (const nom of NOMS_PROVA) {
      for (const g1 of NIVELLS.map((n) => n.id)) {
        for (const g2 of NIVELLS.map((n) => n.id)) {
          const text = generaInformeQualitatiu({
            nom, trimestres: TRIMESTRES, criterisTee: CRITERIS, nivellsCicle: NIVELLS,
            teePerTrimestre: {
              '1r trimestre': tee(g1, { coherencia: 'ae', lexic: 'an', ortografia: 'na' }),
              '2n trimestre': tee(g2, { coherencia: 'ae', lexic: 'an', ortografia: 'na' }),
            },
            momentsLectura: M,
            lecturaPerMoment: {
              inicial: { vl: 70, nivellVl: 'baix', cl: 5, nivellCl: 'baix' },
              final: { vl: 95, nivellVl: 'mitjà', cl: 7, nivellCl: 'mitjà' },
            },
          })
          expect(repetides(text), `${nom} ${g1}/${g2}`).toEqual([])
        }
      }
    }
  })

  it('no repeteix el nivell de lectura quan es manté als tres moments', () => {
    const igual = { vl: 80, nivellVl: 'mitjà', cl: 7, nivellCl: 'mitjà' }
    const text = generaInformeQualitatiu({
      nom: 'Alfa, Anna', trimestres: TRIMESTRES, criterisTee: CRITERIS, nivellsCicle: NIVELLS,
      teePerTrimestre: {}, momentsLectura: M,
      lecturaPerMoment: { inicial: igual, mitja: igual, final: igual },
    })
    expect((text.match(/La comprensió lectora/g) ?? []).length).toBeLessThanOrEqual(1)
    expect(repetides(text)).toEqual([])
  })

  it('no diu el mateix nivell d\'escriptura més de dues vegades', () => {
    const igual = tee('an', { coherencia: 'ae', lexic: 'an', ortografia: 'na' })
    const text = generaInformeQualitatiu({
      nom: 'Alfa, Anna', trimestres: TRIMESTRES, criterisTee: CRITERIS, nivellsCicle: NIVELLS,
      teePerTrimestre: { '1r trimestre': igual, '2n trimestre': igual, '3r trimestre': igual },
      momentsLectura: [], lecturaPerMoment: {},
    })
    expect((text.match(/Assoliment Notable/g) ?? []).length).toBeLessThanOrEqual(2)
  })
})

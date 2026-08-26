import { describe, it, expect } from 'vitest'

import { paragrafMatematiques, dimensionsDestacades, nomDimensio } from './informeMatematiques'
import { comptadorDeNom } from './informeQualitatiu'

const NOMS = {
  velocitat: "velocitat d'execució",
  raonament: 'raonament',
  memoria: 'memòria de treball',
}

describe('dimensionsDestacades', () => {
  it('assenyala la més alta i la més baixa quan la diferència és clara', () => {
    const { forta, fluixa } = dimensionsDestacades({
      a: { percentil: 90, nom: 'A' }, b: { percentil: 50, nom: 'B' }, c: { percentil: 20, nom: 'C' },
    })
    expect(forta.nom).toBe('A')
    expect(fluixa.nom).toBe('C')
  })

  it('no assenyala res si estan totes agrupades', () => {
    // 15 punts de percentil entre l'extrem alt i el baix és soroll de la
    // mesura, no una fortalesa ni una debilitat de l'infant.
    const { forta, fluixa } = dimensionsDestacades({
      a: { percentil: 55 }, b: { percentil: 48 }, c: { percentil: 40 },
    })
    expect(forta).toBeNull()
    expect(fluixa).toBeNull()
  })

  it('no assenyala res amb menys de tres dimensions mesurades', () => {
    const { forta } = dimensionsDestacades({ a: { percentil: 95 }, b: { percentil: 10 } })
    expect(forta).toBeNull()
  })

  it('ignora les dimensions sense percentil', () => {
    const { forta, fluixa } = dimensionsDestacades({
      a: { percentil: 90, nom: 'A' }, b: { percentil: null, nom: 'B' },
      c: { percentil: 20, nom: 'C' }, d: { percentil: 55, nom: 'D' },
    })
    expect(forta.nom).toBe('A')
    expect(fluixa.nom).toBe('C')
  })

  it('no peta sense dimensions', () => {
    expect(dimensionsDestacades(null).forta).toBeNull()
    expect(dimensionsDestacades({}).forta).toBeNull()
  })
})

describe('paragrafMatematiques — ConMat', () => {
  const base = { nom: 'Alfa Beta, Anna' }

  it('situa el nivell i fa servir només el nom de fonts', () => {
    const text = paragrafMatematiques({ ...base, conmat: { nivell: 'Alt' } })
    expect(text).toContain('Anna')
    expect(text).not.toContain('Alfa')
    // La franja s'anomena en paraules: afegir-hi "(nivell Alt)" al darrere
    // deia dues vegades el mateix.
    expect(text).toMatch(/franja alta/)
  })

  it('reconeix la millora respecte del curs passat', () => {
    const text = paragrafMatematiques({
      ...base,
      conmat: { nivell: 'Alt' },
      conmatAnterior: { nivell: 'Mitjà-baix' },
    })
    expect(text).toMatch(/millora|recorregut|pujat/i)
  })

  it('assenyala amb prudència quan el resultat baixa', () => {
    const text = paragrafMatematiques({
      ...base,
      conmat: { nivell: 'Baix' },
      conmatAnterior: { nivell: 'Alt' },
    })
    expect(text).toMatch(/seguir de prop|amb calma/i)
  })

  it('diu que es manté quan el nivell és el mateix', () => {
    const text = paragrafMatematiques({
      ...base, conmat: { nivell: 'Mitjà-alt' }, conmatAnterior: { nivell: 'Mitjà-alt' },
    })
    expect(text).toMatch(/mant[ée]/i)
  })

  it('no compara si el nivell anterior no es reconeix', () => {
    const text = paragrafMatematiques({
      ...base, conmat: { nivell: 'Alt' }, conmatAnterior: { nivell: 'Altíssim' },
    })
    expect(text).not.toMatch(/curs passat|curs anterior/i)
  })

  it('diu clarament quan no va fer la prova', () => {
    const text = paragrafMatematiques({ ...base, conmat: { noAvaluat: true, nivell: null } })
    expect(text).toMatch(/no consta/i)
  })

  it('torna text buit si no hi ha cap prova', () => {
    expect(paragrafMatematiques(base)).toBe('')
  })
})

describe('paragrafMatematiques — COSMOS', () => {
  const base = { nom: 'Delta, Dora', nomsDimensions: NOMS }
  const dimensions = {
    velocitat: { percentil: 92 },
    raonament: { percentil: 45 },
    memoria: { percentil: 15 },
  }

  it('descriu l\'evolució entre la prova inicial i la final', () => {
    const text = paragrafMatematiques({
      ...base,
      cosmos: { inicial: 'Baix', final: 'Alt', fiabilitatFinal: 'Resultats fiables', dimensionsFinal: dimensions },
    })
    expect(text).toMatch(/Baix/)
    expect(text).toMatch(/Alt/)
  })

  it('anomena la dimensió forta i la fluixa pel seu nom llegible', () => {
    const text = paragrafMatematiques({
      ...base,
      cosmos: { inicial: 'Mitjà', final: 'Mitjà', fiabilitatFinal: 'Resultats fiables', dimensionsFinal: dimensions },
    })
    // Sense distingir majúscules: quan la dimensió obre la frase, va amb
    // majúscula inicial ("Velocitat d'execució és on...").
    expect(text.toLowerCase()).toContain("velocitat d'execució")
    expect(text.toLowerCase()).toContain('memòria de treball')
  })

  it('no destaca cap dimensió quan el perfil és pla', () => {
    const text = paragrafMatematiques({
      ...base,
      cosmos: {
        inicial: 'Mitjà', final: 'Mitjà', fiabilitatFinal: 'Resultats fiables',
        dimensionsFinal: { velocitat: { percentil: 52 }, raonament: { percentil: 48 }, memoria: { percentil: 44 } },
      },
    })
    expect(text).toMatch(/equilibrat|ritme semblant|cap diferència|no hi ha difer/i)
  })

  it('NO valora res si l\'informe marca la prova com a poc fiable', () => {
    // El més important d'aquest fitxer: descriure fortaleses i debilitats
    // a partir d'una prova que el mateix Innovamat diu que no és fiable
    // seria pitjor que no dir res.
    const text = paragrafMatematiques({
      ...base,
      cosmos: {
        inicial: 'Baix', final: 'Baix', fiabilitatFinal: 'Resultats no fiables',
        dimensionsFinal: dimensions,
      },
    })
    expect(text).toMatch(/poc fiable|no s[óo]n fiables/i)
    expect(text.toLowerCase()).not.toContain("velocitat d'execució")
    expect(text.toLowerCase()).not.toContain('memòria de treball')
  })

  it('diu clarament quan no va fer la prova final', () => {
    const text = paragrafMatematiques({ ...base, cosmos: { noAvaluat: true } })
    expect(text).toMatch(/no consta|no.*feta/i)
  })

  it('aguanta que falti el rendiment inicial', () => {
    const text = paragrafMatematiques({
      ...base,
      cosmos: { inicial: null, final: 'Alt', fiabilitatFinal: 'Resultats fiables', dimensionsFinal: dimensions },
    })
    expect(text).toContain('Alt')
  })
})

describe('paragrafMatematiques — estabilitat del text', () => {
  it('el mateix alumne amb les mateixes dades dona sempre el mateix text', () => {
    const args = { nom: 'Alfa Beta, Anna', conmat: { nivell: 'Alt' } }
    expect(paragrafMatematiques(args)).toBe(paragrafMatematiques(args))
  })

  it('dos alumnes amb les mateixes dades no tenen textos calcats', () => {
    // Si tota una classe rep el mateix redactat, es nota que l'ha escrit
    // una màquina. La tria depèn del nom.
    const textos = ['Anna', 'Bru', 'Cesc', 'Dora', 'Eloi', 'Ferran']
      .map((n) => paragrafMatematiques({ nom: `Cognom, ${n}`, conmat: { nivell: 'Alt' } }))
    expect(new Set(textos).size).toBeGreaterThan(1)
  })

  it('no peta sense nom', () => {
    expect(() => paragrafMatematiques({ nom: '', conmat: { nivell: 'Alt' } })).not.toThrow()
  })

  it('no fa servir el nom si el comptador compartit ja està exhaurit', () => {
    // A l'informe complet, el màxim de dos usos és per a TOT el text, no
    // per paràgraf: aquest ha de saber prescindir del nom.
    const noms = comptadorDeNom('Anna', 0)
    const text = paragrafMatematiques({ nom: 'Alfa, Anna', noms, conmat: { nivell: 'Alt' } })
    expect(text).not.toContain('Anna')
    expect(text).toMatch(/franja alta/)
  })

  it('mai no escriu els cognoms', () => {
    const text = paragrafMatematiques({ nom: 'Alfa Beta, Anna', conmat: { nivell: 'Alt' } })
    expect(text).not.toMatch(/Alfa|Beta/)
  })
})

describe('robustesa dels noms de dimensió', () => {
  it('no destaca res si les dues dimensions es diuen igual', () => {
    // El CSV real porta "comparació magnituds" i "comparació magnituds 2".
    // Si totes dues acabessin amb el mateix nom llegible, l'informe diria
    // que la mateixa cosa és alhora el punt fort i el punt fluix.
    const { forta, fluixa } = dimensionsDestacades({
      a: { percentil: 95, nom: 'comparació de magnituds' },
      b: { percentil: 50, nom: 'raonament' },
      c: { percentil: 10, nom: 'comparació de magnituds' },
    })
    expect(forta).toBeNull()
    expect(fluixa).toBeNull()
  })

  it('mai no escriu un identificador cru a l\'informe', () => {
    // Si l'Innovamat afegís una dimensió nova, no seria al mapa de noms.
    const text = paragrafMatematiques({
      nom: 'Delta, Dora',
      nomsDimensions: {},
      cosmos: {
        inicial: 'Mitjà', final: 'Mitjà', fiabilitatFinal: 'Resultats fiables',
        dimensionsFinal: {
          dimensio_nova_inventada: { percentil: 95 },
          raonament: { percentil: 50 },
          memoria_de_treball: { percentil: 10 },
        },
      },
    })
    expect(text).not.toMatch(/_/)
    expect(text.toLowerCase()).toContain('dimensio nova inventada')
  })

  it('nomDimensio prefereix el mapa, després l\'original, i mai l\'id cru', () => {
    expect(nomDimensio('raonament', { raonament: 'raonament lògic' })).toBe('raonament lògic')
    expect(nomDimensio('x_y', {}, 'nom original')).toBe('nom original')
    expect(nomDimensio('memoria_de_treball', {})).toBe('memoria de treball')
  })
})

describe('proposta de treball', () => {
  const dims = {
    velocitat_d_execucio: { percentil: 92 },
    raonament: { percentil: 55 },
    memoria_de_treball: { percentil: 12 },
  }

  it('proposa alguna cosa quan hi ha un punt fluix', () => {
    const text = paragrafMatematiques({
      nom: 'Delta, Dora',
      cosmos: { inicial: 'Mitjà', final: 'Mitjà', fiabilitatFinal: 'Resultats fiables', dimensionsFinal: dims },
    })
    expect(text).toMatch(/proposa|seria bo|passa per/i)
  })

  it('NO proposa res si la prova no és fiable', () => {
    const text = paragrafMatematiques({
      nom: 'Delta, Dora',
      cosmos: { inicial: 'Mitjà', final: 'Mitjà', fiabilitatFinal: 'Resultats no fiables', dimensionsFinal: dims },
    })
    expect(text).not.toMatch(/seria bo|es proposa|passa per/i)
  })
})

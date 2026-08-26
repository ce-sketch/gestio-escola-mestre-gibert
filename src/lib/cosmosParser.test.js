import { describe, it, expect } from 'vitest'

import { llegeixCosmos, resumClasse, classeDeNomFitxer, rendimentAPercentatge } from './cosmosParser'

// Capçalera treta d'un CSV real del curs 25-26 (1rA). Conté els paranys
// que importen: apòstrof tipogràfic ("velocitat d’execució"), accents, i
// dues dimensions on el nom d'una és el principi de l'altra ("comparació
// magnituds" i "comparació magnituds 2").
const CAPCALERA = [
  'Nom', 'Cognoms', 'Resultat de la intervenció', 'Mitjana setmanal de sessions (intervenció)',
  'Data del COSMOS inicial', 'COSMOS inicial completat', 'Fiabilitat dels resultats del COSMOS inicial',
  'Puntuació habilitats numèriques COSMOS inicial', 'Rendiment habilitats numèriques COSMOS inicial',
  'Percentil velocitat d’execució COSMOS inicial', 'Rendiment velocitat d’execució COSMOS inicial',
  'Percentil comparació magnituds 2 COSMOS inicial', 'Rendiment comparació magnituds 2 COSMOS inicial',
  'Percentil comparació magnituds COSMOS inicial', 'Rendiment comparació magnituds COSMOS inicial',
  'Data del COSMOS final', 'COSMOS final completat', 'Fiabilitat dels resultats del COSMOS final',
  'Puntuació habilitats numèriques COSMOS final', 'Rendiment habilitats numèriques COSMOS final',
  'Percentil velocitat d’execució COSMOS final', 'Rendiment velocitat d’execució COSMOS final',
  'Percentil comparació magnituds 2 COSMOS final', 'Rendiment comparació magnituds 2 COSMOS final',
  'Percentil comparació magnituds COSMOS final', 'Rendiment comparació magnituds COSMOS final',
].join(',')

/** Una fila amb tots els resultats plens. */
const ambResultats = (nom, cognoms, rendimentFinal = 'Alt') => [
  nom, cognoms, 'Èxit', '2.5',
  '2025-10-20', 'Sí', 'Resultats fiables', '1.14', 'Mitjà', '92', 'Alt', '', '', '89', 'Alt',
  '2026-05-04', 'Sí', 'Resultats fiables', '1.65', rendimentFinal, '95', 'Alt', '80', 'Mitjà', '16', 'Baix',
].join(',')

/** Cas real: l'alumne consta al CSV però no va fer cap de les dues
 *  proves, i totes les columnes de resultats vénen buides. */
const senseProva = (nom, cognoms) => [
  nom, cognoms, '', '',
  '2025-10-20', 'No', '-', '', '', '', '', '', '', '', '',
  '2026-05-04', 'No', '-', '', '', '', '', '', '', '', '',
].join(',')

const csv = (...files) => [CAPCALERA, ...files].join('\n')

describe('llegeixCosmos', () => {
  it('llegeix els alumnes i en compon el nom complet', () => {
    const { alumnes } = llegeixCosmos(csv(ambResultats('Olivia', 'Concolino')))
    expect(alumnes).toHaveLength(1)
    expect(alumnes[0].nomComplet).toBe('Concolino, Olivia')
  })

  it('dedueix les dimensions de la capçalera, sense donar-les per fetes', () => {
    // L'apòstrof tipogràfic de l'Innovamat (’) queda normalitzat a ' — si
    // no, cada comparació de text posterior hauria de recordar quin dels
    // dos apòstrofs toca.
    const { dimensions } = llegeixCosmos(csv(ambResultats('Olivia', 'Concolino')))
    expect(dimensions.map((d) => d.nom)).toEqual([
      "velocitat d'execució", 'comparació magnituds 2', 'comparació magnituds',
    ])
  })

  it('no confon dues dimensions quan el nom d\'una és el principi de l\'altra', () => {
    const { alumnes } = llegeixCosmos(csv(ambResultats('Olivia', 'Concolino')))
    const finals = alumnes[0].moments.final.dimensions
    expect(finals.comparacio_magnituds_2.percentil).toBe(80)
    expect(finals.comparacio_magnituds.percentil).toBe(16)
  })

  it('marca com a noAvaluat qui no va completar la prova final', () => {
    // Cas real del curs 25-26: a 1rA hi havia una alumna sense cap de les
    // dues proves. Abans es desava com els altres i descompensava els
    // percentatges; ara queda marcada.
    const { alumnes } = llegeixCosmos(csv(
      ambResultats('Olivia', 'Concolino'),
      senseProva('Amélie', 'Gómez'),
    ))
    expect(alumnes.find((a) => a.nom === 'Amélie').noAvaluat).toBe(true)
    expect(alumnes.find((a) => a.nom === 'Olivia').noAvaluat).toBe(false)
  })

  it('avisa de qui no ha fet la prova, amb el nom', () => {
    const { avisos } = llegeixCosmos(csv(
      ambResultats('Olivia', 'Concolino'),
      senseProva('Amélie', 'Gómez'),
    ))
    expect(avisos.some((a) => /Gómez, Amélie/.test(a))).toBe(true)
  })

  it('peta si el fitxer no és un CSV del COSMOS', () => {
    expect(() => llegeixCosmos('Alumne,Nota\nA,10')).toThrow(/Nom.*Cognoms|COSMOS/i)
  })
})

describe('resumClasse', () => {
  const alumnes = [
    { noAvaluat: false, moments: { inicial: { rendiment: 'Baix', puntuacio: 1 }, final: { rendiment: 'Alt', puntuacio: 2 } } },
    { noAvaluat: false, moments: { inicial: { rendiment: 'Mitjà', puntuacio: 1 }, final: { rendiment: 'Mitjà', puntuacio: 1.5 } } },
    { noAvaluat: true, moments: { inicial: { rendiment: null, puntuacio: null }, final: { rendiment: null, puntuacio: null } } },
  ]

  it('no compta els no avaluats al total ni als recomptes', () => {
    const r = resumClasse(alumnes)
    expect(r.total).toBe(2)
    expect(r.final.alt).toBe(1)
    expect(r.final.sense).toBe(0)
  })

  it('recompta els no avaluats a part i dona el total general', () => {
    const r = resumClasse(alumnes)
    expect(r.noAvaluats).toBe(1)
    expect(r.totalGeneral).toBe(3) // el que ha de quadrar amb l'Excel
  })

  it('mesura la millora només entre els qui tenen les dues proves', () => {
    const r = resumClasse(alumnes)
    expect(r.ambTotesDues).toBe(2)
    expect(r.milloren).toBe(2)
  })

  it('no divideix per zero si no hi ha ningú amb les dues proves', () => {
    const r = resumClasse([alumnes[2]])
    expect(r.guanyMitja).toBeNull()
    expect(r.total).toBe(0)
  })
})

describe('classeDeNomFitxer', () => {
  it('treu la classe del nom real dels CSV de l\'Innovamat', () => {
    expect(classeDeNomFitxer('resultats_cosmos_pre_post_1rA.csv')).toBe('1rA')
    expect(classeDeNomFitxer('resultats_cosmos_pre_post_2nB.csv')).toBe('2nB')
  })

  it('aguanta el "(1)" i els espais que hi afegeix el Drive', () => {
    expect(classeDeNomFitxer('resultats_cosmos_pre_post_1rB .csv')).toBe('1rB')
  })

  it('torna null si no la reconeix, en comptes d\'endevinar-la', () => {
    expect(classeDeNomFitxer('resultats_cosmos.csv')).toBeNull()
    expect(classeDeNomFitxer('')).toBeNull()
  })
})

describe('rendimentAPercentatge', () => {
  it('tradueix l\'escala de l\'Innovamat', () => {
    expect(rendimentAPercentatge('Alt')).toBe(100)
    expect(rendimentAPercentatge('Mitjà')).toBe(66)
    expect(rendimentAPercentatge('Baix')).toBe(33)
  })

  it('torna null si no el reconeix', () => {
    expect(rendimentAPercentatge('')).toBeNull()
    expect(rendimentAPercentatge('Altíssim')).toBeNull()
  })
})

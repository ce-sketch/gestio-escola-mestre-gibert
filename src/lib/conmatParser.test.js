import { describe, it, expect, vi } from 'vitest'

// El parser importa pdf.js per llegir els PDF, que no funciona fora del
// navegador. Aquí només es proven les funcions de text, així que se'n fa
// una versió falsa.
vi.mock('./carregaLlibreries', () => ({ carregaPdfjs: () => {} }))

const { casaAmbAlumnes, claueDeNom, paraulesDeNom, clauOrdenadaDeNom } = await import('./conmatParser')

/** Prepara els alumnes tal com surten del PDF (amb la clau ja calculada). */
function delPdf(...noms) {
  return noms.map((nom) => ({ nom, clau: claueDeNom(nom), nivell: 'Alt' }))
}

describe('claueDeNom', () => {
  it('ignora accents, majúscules i signes', () => {
    expect(claueDeNom('Pérez Mena, Pol-Conan')).toBe(claueDeNom('perez mena pol conan'))
  })
})

describe('clauOrdenadaDeNom', () => {
  it('no depèn de l\'ordre de les paraules', () => {
    expect(clauOrdenadaDeNom('Pol Pérez')).toBe(clauOrdenadaDeNom('Pérez Pol'))
  })
})

describe('paraulesDeNom', () => {
  it('separa i ordena les paraules, sense accents', () => {
    expect(paraulesDeNom('Àlvarez Moré, Vera')).toEqual(['alvarez', 'more', 'vera'])
  })
})

describe('casaAmbAlumnes', () => {
  const centre = [
    { id: '1', nom: 'Abellán Álvarez, Alexandra' },
    { id: '2', nom: 'Ruiz Lozano, Laia-Ixela' },
    { id: '3', nom: 'Ruiz Lozano, Irati-Jara' },
    { id: '4', nom: 'López Albo, Emma' },
  ]

  it('casa els noms escrits exactament igual', () => {
    const { casats } = casaAmbAlumnes(delPdf('Ruiz Lozano Laia-Ixela'), centre)
    expect(casats).toHaveLength(1)
    expect(casats[0].alumneId).toBe('2')
  })

  it('casa encara que el PDF només porti el primer cognom', () => {
    // L'Innovamat no escriu sempre els dos cognoms: "Abellan Alexandra"
    // ha de casar amb "Abellán Álvarez, Alexandra".
    const { casats } = casaAmbAlumnes(delPdf('Abellan Alexandra'), centre)
    expect(casats).toHaveLength(1)
    expect(casats[0].alumneId).toBe('1')
    expect(casats[0].casatPerAproximacio).toBe(true)
  })

  it('NO endevina quan el nom encaixa amb més d\'un alumne', () => {
    // "Ruiz Lozano" són les dues germanes: assignar-ho a l'atzar donaria
    // la nota a qui no toca.
    const { casats, sensCasar, dubtosos } = casaAmbAlumnes(delPdf('Ruiz Lozano'), centre)
    expect(casats).toHaveLength(0)
    expect(sensCasar).toHaveLength(1)
    expect(dubtosos[0].candidats).toHaveLength(2)
  })

  it('l\'ambigüitat es manté encara que una germana ja estigui casada', () => {
    // Cas real que va fallar: si la Laia casa exacte abans, "Ruiz Lozano"
    // no ha d'acabar assignat a la Irati per descart.
    const { dubtosos } = casaAmbAlumnes(delPdf('Ruiz Lozano Laia-Ixela', 'Ruiz Lozano'), centre)
    expect(dubtosos).toHaveLength(1)
  })

  it('deixa sense casar els que no són al centre', () => {
    const { sensCasar } = casaAmbAlumnes(delPdf('Desconegut Pere'), centre)
    expect(sensCasar).toHaveLength(1)
  })

  it('no casa amb només una paraula, encara que coincideixi', () => {
    const { casats } = casaAmbAlumnes(delPdf('Emma'), centre)
    expect(casats).toHaveLength(0)
  })
})

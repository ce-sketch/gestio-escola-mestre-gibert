import { describe, it, expect, vi } from 'vitest'

// El parser importa pdf.js per llegir els PDF, que no funciona fora del
// navegador. Aquí només es proven les funcions de text, així que se'n fa
// una versió falsa.
vi.mock('./carregaLlibreries', () => ({ carregaPdfjs: () => {} }))

const { casaAmbAlumnes, claueDeNom, paraulesDeNom, clauOrdenadaDeNom, distribucio } = await import('./conmatParser')

/** Prepara els alumnes tal com surten del PDF. El parser desa el nom a
 *  `nomPdf` (no a `nom`): confondre-ho va fer que el casament tolerant no
 *  funcionés i que el desat petés amb el nom buit. */
function delPdf(...noms) {
  return noms.map((nomPdf) => ({ nomPdf, clau: claueDeNom(nomPdf), nivell: 'Alt' }))
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

  it('els no casats conserven el nom de l\'informe', () => {
    // Sense això, el desat mirava un camp inexistent i Firestore
    // rebutjava el document sencer per tenir el nom indefinit.
    const { sensCasar } = casaAmbAlumnes(delPdf('Desconegut Pere'), centre)
    expect(sensCasar[0].nomPdf).toBe('Desconegut Pere')
  })

  it('casa noms amb una errada d\'escriptura al cognom', () => {
    // Casos reals dels informes: "Matamoros" per "Matamoro" i
    // "Padrilla" per "Padilla". La resta del nom quadra sencera.
    const ambErrada = [
      { id: '9', nom: 'Medrano Matamoro, Marlon Alexander' },
      { id: '10', nom: 'Rosillo Padilla, Pau' },
    ]
    const { casats } = casaAmbAlumnes(
      delPdf('Medrano Matamoros Marlon Alexander', 'Rosillo Padrilla Pau'),
      ambErrada
    )
    expect(casats).toHaveLength(2)
    expect(casats[0].alumneId).toBe('9')
  })

  it('una errada NO justifica casar noms de pila diferents', () => {
    // El risc de la tolerància: assignar la nota al germà equivocat.
    const { casats } = casaAmbAlumnes(delPdf('Ruiz Lozano Marta'), centre)
    expect(casats).toHaveLength(0)
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

describe('distribucio', () => {
  // Alumnes que consten a l'informe però no van fer la prova ("Aquest
  // alumne no ha fet la ConMat..."): es desen igualment (perquè els totals
  // quadrin amb l'Excel del centre) però no poden entrar en cap nivell.
  const classe = [
    { nivell: 'Alt' }, { nivell: 'Alt' }, { nivell: 'Baix' },
    { nivell: null, noAvaluat: true }, { nivell: null, noAvaluat: true },
  ]

  it('no compta els no avaluats al total ni als percentatges', () => {
    const d = distribucio(classe)
    expect(d.total).toBe(3)
    expect(d.recompte.alt).toBe(2)
    expect(d.percentatges.alt).toBeCloseTo(66.7, 1)
  })

  it('recompta els no avaluats a part', () => {
    const d = distribucio(classe)
    expect(d.noAvaluats).toBe(2)
  })

  it('totalGeneral inclou avaluats i no avaluats — el que ha de quadrar amb l\'Excel', () => {
    const d = distribucio(classe)
    expect(d.totalGeneral).toBe(5)
  })

  it('sense cap no avaluat, es comporta com abans', () => {
    const d = distribucio([{ nivell: 'Alt' }, { nivell: 'Baix' }])
    expect(d.total).toBe(2)
    expect(d.noAvaluats).toBe(0)
    expect(d.totalGeneral).toBe(2)
  })
})

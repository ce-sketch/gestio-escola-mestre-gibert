// Text qualitatiu per a les proves de matemàtiques d'Innovamat.
//
// Segueix les mateixes regles que `informeQualitatiu.js` (llengua): banc
// de frases, tria estable a partir del nom —dos infants amb els mateixos
// resultats tenen textos diferents, però el mateix infant té sempre el
// mateix text—, només el nom de fonts i llenguatge de procés.
//
// ⚠️ Fins on es pot arribar amb cada prova
// ----------------------------------------
// Les dues proves NO donen la mateixa quantitat d'informació, i el text
// ho ha de respectar:
//
//   · COSMOS (1r i 2n) → CSV amb el percentil de vuit dimensions per a
//     cada moment. Aquí sí que hi ha de què parlar.
//   · ConMat (3r a 6è) → PDF del qual només se n'obté UN nivell global.
//     Els resultats per bloc hi són com a gràfics i no es poden llegir
//     (vegeu conmatParser.js). Convertir una sola paraula en dos
//     paràgrafs seria fer veure que se'n sap més del que se'n sap: per
//     això del ConMat només se'n treu una frase, i el context ve de
//     comparar-lo amb el curs anterior.
//
// ⚠️ Fiabilitat
// -------------
// El COSMOS marca cada prova com a "Resultats fiables" o "Resultats no
// fiables". Quan diu que no ho són, NO es genera cap valoració: descriure
// fortaleses i debilitats a partir de soroll seria pitjor que callar,
// sobretot en un document que pot llegir una família.

import { primerNom, deNom, comptadorDeNom } from './informeQualitatiu'
import { NIVELLS_CONMAT } from './conmatParser'

/** Número estable a partir d'un text: mateix nom, mateixa tria de frases.
 *  Repetit aquí i no importat perquè a `informeQualitatiu.js` és intern;
 *  exportar-lo només per a això obriria una funció que no vol ser API. */
function llavor(text) {
  let n = 0
  for (const c of String(text)) n = (n * 31 + c.codePointAt(0)) % 100000
  return n
}

function tria(llista, sembra, desplacament = 0) {
  const empremta = llavor(String(llista[0]))
  return llista[(sembra + desplacament + empremta) % llista.length]
}

const majuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

/** Els nivells del ConMat de més alt a més baix, per poder comparar-los.
 *  Es dedueix de NIVELLS_CONMAT en comptes de repetir la llista: si algun
 *  dia l'Innovamat en canvia els noms, canvia en un sol lloc. */
const ORDRE_CONMAT = NIVELLS_CONMAT.map((n) => n.label)
const posicioConmat = (nivell) =>
  ORDRE_CONMAT.findIndex((n) => n.toLowerCase() === String(nivell ?? '').toLowerCase())

const ORDRE_COSMOS = ['Baix', 'Mitjà', 'Alt']
const posicioCosmos = (r) =>
  ORDRE_COSMOS.findIndex((n) => n.toLowerCase() === String(r ?? '').toLowerCase())

// ── Banc de frases: ConMat ─────────────────────────────────────────────
// Una frase per nivell, prou per situar el resultat sense inflar-lo.

const CONMAT_PER_NIVELL = {
  Alt: {
    ambNom: [
      (n) => `A la prova de matemàtiques d'aquest curs, ${n} se situa a la franja alta`,
      (n) => `${n} resol la prova de matemàtiques amb molta solvència, dins de la franja alta`,
      (n) => `El resultat de matemàtiques ${deNom(n)} el situa a la franja alta`,
    ],
    senseNom: [
      'el resultat de la prova de matemàtiques se situa a la franja alta',
      'la prova de matemàtiques es resol amb molta solvència, dins de la franja alta',
      'a matemàtiques, el resultat queda a la franja alta',
    ],
    matis: [
      'És un resultat que parla d\'una base matemàtica ben assentada.',
      'La prova mostra recursos propis per resoldre el que se li planteja.',
      'Els fonaments hi són, i això permet plantejar reptes que estirin una mica més amunt.',
    ],
  },
  'Mitjà-alt': {
    ambNom: [
      (n) => `A la prova de matemàtiques, ${n} se situa a la franja mitjana-alta`,
      (n) => `${n} resol bé la prova de matemàtiques, a la franja mitjana-alta`,
      (n) => `El resultat de matemàtiques ${deNom(n)} queda a la franja mitjana-alta`,
    ],
    senseNom: [
      'el resultat de la prova de matemàtiques queda a la franja mitjana-alta',
      'la prova de matemàtiques es resol bé, dins de la franja mitjana-alta',
      'a matemàtiques, el resultat se situa a la franja mitjana-alta',
    ],
    matis: [
      'Hi ha una base sòlida sobre la qual continuar construint.',
      'El que la prova demana es resol amb comoditat en la major part dels casos.',
      'És un bon punt de partida per anar afinant els aspectes més exigents.',
    ],
  },
  'Mitjà-baix': {
    ambNom: [
      (n) => `A la prova de matemàtiques, ${n} se situa a la franja mitjana-baixa`,
      (n) => `El resultat de matemàtiques ${deNom(n)} queda a la franja mitjana-baixa`,
      (n) => `${n} resol la prova de matemàtiques dins de la franja mitjana-baixa`,
    ],
    senseNom: [
      'el resultat de la prova de matemàtiques queda a la franja mitjana-baixa',
      'a matemàtiques, el resultat se situa a la franja mitjana-baixa',
      'la prova de matemàtiques es resol dins de la franja mitjana-baixa',
    ],
    matis: [
      'Els aspectes bàsics hi són, i el treball continuat els anirà consolidant.',
      'Hi ha fonaments sobre els quals treballar, amb marge de creixement per endavant.',
      'És un resultat que convida a reforçar allò essencial abans d\'anar més enllà.',
    ],
  },
  Baix: {
    ambNom: [
      (n) => `A la prova de matemàtiques, ${n} se situa a la franja baixa`,
      (n) => `El resultat de matemàtiques ${deNom(n)} queda a la franja baixa`,
      (n) => `${n} encara està consolidant els aprenentatges que mesura la prova de matemàtiques`,
    ],
    senseNom: [
      'el resultat de la prova de matemàtiques queda a la franja baixa',
      'a matemàtiques, el resultat se situa a la franja baixa',
      'els aprenentatges que mesura la prova de matemàtiques encara s\'estan consolidant',
    ],
    matis: [
      'Convindrà un acompanyament proper per anar assentant els aprenentatges bàsics.',
      'El més important ara és treballar els fonaments amb calma i sense pressa.',
      'Amb propostes ajustades i temps, aquest procés anirà donant els seus fruits.',
    ],
  },
}

const CONMAT_MILLORA = [
  (a, b) => `Respecte del curs passat hi ha hagut una millora, de la franja ${a} a la ${b}: val la pena reconèixer-la.`,
  (a, b) => `El recorregut respecte del curs anterior és clar, de ${a} a ${b}.`,
  (a, b) => `Comparat amb el curs passat, el resultat ha pujat de ${a} a ${b}, cosa que no arriba sola.`,
]

const CONMAT_BAIXA = [
  (a, b) => `Respecte del curs passat el resultat ha passat de la franja ${a} a la ${b}, un canvi que convindrà seguir de prop.`,
  (a, b) => `Comparat amb el curs anterior hi ha un canvi de ${a} a ${b} que val la pena mirar amb calma.`,
]

const CONMAT_ESTABLE = [
  (n) => `El resultat es manté respecte del curs passat (franja ${n}).`,
  (n) => `Es manté la mateixa franja que el curs anterior (${n}), senyal de regularitat.`,
]

// ── Banc de frases: COSMOS ─────────────────────────────────────────────

const COSMOS_EVOLUCIO_AMUNT = [
  (a, b) => `Entre la prova d'inici i la de final de curs, el rendiment global ha passat de ${a} a ${b}.`,
  (a, b) => `Al llarg del curs hi ha hagut un avenç clar: de ${a} a ${b} en el rendiment global.`,
  (a, b) => `El curs deixa un recorregut visible, de ${a} a ${b}.`,
]

const COSMOS_EVOLUCIO_AVALL = [
  (a, b) => `Entre l'inici i el final de curs, el rendiment global ha passat de ${a} a ${b}; convindrà seguir-ho de prop.`,
  (a, b) => `El resultat de final de curs (${b}) queda per sota del d'inici (${a}), cosa que val la pena mirar amb calma.`,
]

const COSMOS_ESTABLE = [
  (n) => `El rendiment global s'ha mantingut estable durant el curs (${n}).`,
  (n) => `Entre les dues proves el rendiment es manté (${n}), senyal d'una base ja assentada.`,
]

const COSMOS_FORT = [
  (q) => `Entre les habilitats que mesura la prova, on més destaca és en ${q}`,
  (q) => `${majuscula(q)} és on el resultat surt més alt`,
  (q) => `El punt més fort de la prova és ${q}`,
]

const COSMOS_FLUIX = [
  (q) => `${q} és on hi ha més marge de creixement`,
  (q) => `on hi ha més recorregut per endavant és en ${q}`,
  (q) => `${q} és el terreny on ara val la pena posar l'atenció`,
]

const COSMOS_EQUILIBRAT = [
  'Les diferents habilitats que mesura la prova avancen a un ritme semblant, sense desnivells destacables.',
  'El perfil és equilibrat: cap de les habilitats mesurades queda especialment despenjada de la resta.',
  'No hi ha diferències remarcables entre les habilitats mesurades.',
]

const COSMOS_NO_FIABLE = [
  "L'informe marca aquesta prova com a poc fiable, de manera que els resultats no es poden interpretar amb garanties. Convindrà contrastar-los amb l'observació de l'aula.",
  "L'Innovamat assenyala que els resultats d'aquesta prova no són fiables; val més no treure'n conclusions i confiar en el que es veu a l'aula.",
]

const COSMOS_NO_AVALUAT = [
  'No consta que hagi fet la prova de final de curs, de manera que no se\'n pot valorar el resultat.',
  'La prova de final de curs no consta com a feta, així que no hi ha resultat a comentar.',
]

/**
 * Quines dimensions destaquen, amunt i avall.
 *
 * Només es diu res quan la diferència és prou clara. El llindar és de 25
 * punts de percentil: per sota d'això, dues dimensions estan pràcticament
 * igual i assenyalar-ne una com a "punt fort" seria convertir el soroll
 * de la mesura en una afirmació sobre l'infant.
 */
export function dimensionsDestacades(dimensions, llindar = 25) {
  const ambPercentil = Object.entries(dimensions ?? {})
    .map(([id, d]) => ({ id, nom: d?.nom ?? id, percentil: d?.percentil }))
    .filter((d) => typeof d.percentil === 'number' && Number.isFinite(d.percentil))
  if (ambPercentil.length < 3) return { forta: null, fluixa: null }

  const ordenades = [...ambPercentil].sort((a, b) => b.percentil - a.percentil)
  const alta = ordenades[0]
  const baixa = ordenades[ordenades.length - 1]
  if (alta.percentil - baixa.percentil < llindar) return { forta: null, fluixa: null }
  return { forta: alta, fluixa: baixa }
}

/**
 * El paràgraf de matemàtiques d'un alumne.
 *
 * @param {object} params
 * @param {string} params.nom - nom complet de la fitxa (se n'agafa el de fonts)
 * @param {object|null} params.conmat - entrada del ConMat del curs, si n'hi ha
 * @param {object|null} params.cosmos - entrada del COSMOS del curs, si n'hi ha
 * @param {object|null} params.conmatAnterior - el ConMat del curs previ, per comparar
 * @param {object} params.nomsDimensions - { idDimensio: 'nom llegible' }
 * @returns {string} el paràgraf, o '' si no hi ha res a dir
 */
export function paragrafMatematiques({
  nom, conmat = null, cosmos = null, conmatAnterior = null, nomsDimensions = {},
  noms: comptadorExtern = null,
}) {
  const nomCurt = primerNom(nom)
  const sembra = llavor(nom || 'x')
  // El comptador ve de fora quan aquest paràgraf acompanya el de llengua:
  // el màxim de dos usos del nom és per a TOT l'informe, no per paràgraf.
  const noms = comptadorExtern ?? comptadorDeNom(nomCurt)
  const frases = []

  // ── ConMat ──────────────────────────────────────────────────────────
  if (conmat) {
    if (conmat.noAvaluat) {
      frases.push('No consta que hagi fet la prova de matemàtiques d\'aquest curs.')
    } else {
      const banc = CONMAT_PER_NIVELL[conmat.nivell]
      if (banc) {
        const ambNom = noms.seguent()
        frases.push(ambNom
          ? `${tria(banc.ambNom, sembra)(ambNom)} (nivell ${conmat.nivell}).`
          : `${majuscula(tria(banc.senseNom, sembra))} (nivell ${conmat.nivell}).`)
        frases.push(tria(banc.matis, sembra))

        // La comparació amb el curs passat només si tots dos nivells es
        // reconeixen: amb un nivell desconegut, la comparació no vol dir res.
        const ara = posicioConmat(conmat.nivell)
        const abans = posicioConmat(conmatAnterior?.nivell)
        if (ara >= 0 && abans >= 0) {
          // A NIVELLS_CONMAT, l'índex 0 és el més baix: pujar d'índex és millorar.
          if (ara > abans) frases.push(tria(CONMAT_MILLORA, sembra)(conmatAnterior.nivell, conmat.nivell))
          else if (ara < abans) frases.push(tria(CONMAT_BAIXA, sembra)(conmatAnterior.nivell, conmat.nivell))
          else frases.push(tria(CONMAT_ESTABLE, sembra)(conmat.nivell))
        }
      }
    }
  }

  // ── COSMOS ──────────────────────────────────────────────────────────
  if (cosmos) {
    if (cosmos.noAvaluat) {
      frases.push(tria(COSMOS_NO_AVALUAT, sembra))
    } else {
      const fiable = !/no fiables/i.test(String(cosmos.fiabilitatFinal ?? ''))

      const ara = posicioCosmos(cosmos.final)
      const abans = posicioCosmos(cosmos.inicial)
      if (ara >= 0 && abans >= 0) {
        if (ara > abans) frases.push(tria(COSMOS_EVOLUCIO_AMUNT, sembra)(cosmos.inicial, cosmos.final))
        else if (ara < abans) frases.push(tria(COSMOS_EVOLUCIO_AVALL, sembra)(cosmos.inicial, cosmos.final))
        else frases.push(tria(COSMOS_ESTABLE, sembra)(cosmos.final))
      } else if (ara >= 0) {
        frases.push(`El rendiment a la prova de final de curs és ${cosmos.final}.`)
      }

      if (!fiable) {
        // La marca de poca fiabilitat atura aquí el text: res de perfils
        // de fortaleses i debilitats a partir d'una prova que el mateix
        // informe diu que no és interpretable.
        frases.push(tria(COSMOS_NO_FIABLE, sembra))
      } else {
        const dims = Object.fromEntries(
          Object.entries(cosmos.dimensionsFinal ?? {}).map(([id, d]) => [
            id, { ...d, nom: nomsDimensions[id] ?? d?.nom ?? id },
          ])
        )
        const { forta, fluixa } = dimensionsDestacades(dims)
        if (forta && fluixa) {
          frases.push(`${tria(COSMOS_FORT, sembra)(forta.nom)}, mentre que ${tria(COSMOS_FLUIX, sembra)(fluixa.nom)}.`)
        } else if (Object.keys(dims).length >= 3) {
          frases.push(tria(COSMOS_EQUILIBRAT, sembra))
        }
      }
    }
  }

  return frases.join(' ')
}

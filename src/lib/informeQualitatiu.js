// Generador de text qualitatiu per als informes d'alumne — combina les
// notes ja introduïdes (TEE, Lectura) en frases redactades en català,
// aptes per enganxar directament a una acta d'avaluació. No és cap IA:
// són plantilles de frases que varien segons el nivell assolit a cada
// criteri, perquè el text soni natural i no es repeteixi sempre igual.
//
// Llenguatge coeducador i empàtic: sempre en positiu i des d'una mirada de
// procés (no s'etiqueta l'alumne/a, es descriu on és ara i cap a on pot
// anar), sense pronoms de gènere (fem servir sempre el nom), i evitant
// paraules com "insuficient" o "dificultats" a favor d'un llenguatge de
// creixement ("encara en procés de consolidar").
//
// Sempre queda com a text editable — el mestre hi pot retocar el que vulgui.

// Descriptor de nivell "general" (0=millor ... 4=pitjor), a partir dels
// "punts" que ja té cada nivell — vàlid per a qualsevol dels vocabularis
// de nivell que fem servir a l'app (AE/AN/AS/NA, Expert/Avançat...).
function descriptorPerPunts(punts) {
  if (punts <= 1) return { adjectiu: 'excel·lent', frase: 'mostra un domini excel·lent', to: 'molt fort' }
  if (punts <= 2) return { adjectiu: 'notable', frase: 'mostra un bon domini', to: 'fort' }
  if (punts <= 3) return { adjectiu: 'satisfactori', frase: 'assoleix de manera satisfactòria els aspectes bàsics', to: 'en consolidació' }
  return { adjectiu: "en procés d'assoliment", frase: 'encara està en procés de consolidar', to: 'a acompanyar' }
}

const FRASES_CRITERI = {
  coherencia: ["l'organització i la coherència de les idees", 'com estructura i enllaça les idees del text'],
  lexic: ['la varietat i precisió del lèxic', 'el vocabulari que fa servir'],
  presentacio: ["la presentació i l'endreç del text", "l'endreç i la cal·ligrafia"],
  ortografia: ["l'ortografia", 'la correcció ortogràfica'],
  morfosintaxis: ['la morfosintaxi', 'la construcció gramatical de les frases'],
}

// Proposta de millora concreta per a cada criteri de TEE, quan és el punt
// més fluix — sempre orientada a l'acció, no al dèficit.
const PROPOSTES_CRITERI = {
  coherencia: "treballar la planificació prèvia del text (pluja d'idees, esquemes senzills) abans d'escriure, per ajudar a ordenar les idees",
  lexic: 'ampliar el vocabulari a través de la lectura diversificada i jocs de sinònims i antònims',
  presentacio: "practicar de manera breu i regular la cal·ligrafia i l'organització visual del full",
  ortografia: "reforçar l'ortografia amb dictats curts i la revisió conjunta dels errors més freqüents",
  morfosintaxis: "treballar la construcció de frases variades, amb exercicis d'ampliació i transformació d'oracions",
}

const PROPOSTA_VL_BAIX = 'practicar la lectura en veu alta de manera regular i breu (per exemple, 10 minuts diaris) per guanyar fluïdesa i velocitat lectora'
const PROPOSTA_CL_BAIX = 'treballar la comprensió amb preguntes obertes després de cada lectura i estratègies senzilles de resum'

/** Redacta un paràgraf sobre Text Escrit (TEE) d'UN trimestre. */
function paragrafTEE(nom, registre, criteris, nivellsCicle) {
  if (!registre) return null
  const nivell = (id) => nivellsCicle.find((n) => n.id === id)
  const global = nivell(registre.global)
  if (!global) return null

  const desc = descriptorPerPunts(global.punts)
  const frases = []
  frases.push(`En expressió escrita, ${nom} ${desc.frase} (nivell ${global.label}).`)

  const puntuats = criteris
    .map((c) => ({ criteri: c, nivellCriteri: nivell(registre.criteris?.[c.id]) }))
    .filter((x) => x.nivellCriteri)
  let criteriMesFluix = null
  if (puntuats.length > 0) {
    const millor = puntuats.reduce((a, b) => (a.nivellCriteri.punts <= b.nivellCriteri.punts ? a : b))
    const pitjor = puntuats.reduce((a, b) => (a.nivellCriteri.punts >= b.nivellCriteri.punts ? a : b))
    const fraseCriteri = (id) => FRASES_CRITERI[id]?.[0] ?? id
    if (millor.criteri.id !== pitjor.criteri.id && pitjor.nivellCriteri.punts - millor.nivellCriteri.punts >= 2) {
      frases.push(`Destaca especialment en ${fraseCriteri(millor.criteri.id)}, i ${fraseCriteri(pitjor.criteri.id)} és l'aspecte on encara té més marge de creixement.`)
      criteriMesFluix = pitjor.criteri.id
    } else if (millor.nivellCriteri.punts <= 2) {
      frases.push(`Mostra un bon nivell general, amb ${fraseCriteri(millor.criteri.id)} com a punt fort.`)
    } else if (pitjor.nivellCriteri.punts >= 3) {
      criteriMesFluix = pitjor.criteri.id
    }
  }
  return { text: frases.join(' '), criteriMesFluix, global }
}

/** Redacta un paràgraf sobre Lectura (VL/CL) d'UN moment. */
function paragrafLectura(nom, registre, moment) {
  if (!registre) return null
  const frases = []
  let vlBaix = false
  let clBaix = false
  if (registre.vl !== null && registre.vl !== undefined) {
    frases.push(`Pel que fa a la velocitat lectora, ${nom} llegeix a un ritme de ${registre.vl} paraules per minut (nivell ${registre.nivellVl ?? 'sense classificar'}).`)
    vlBaix = /baix|insuficient|inicial/i.test(String(registre.nivellVl ?? ''))
  }
  if (moment?.teCL && registre.cl !== null && registre.cl !== undefined) {
    frases.push(`Quant a la comprensió lectora, es troba en un nivell ${registre.nivellCl ?? 'sense classificar'}.`)
    clBaix = /baix|insuficient/i.test(String(registre.nivellCl ?? ''))
  }
  return frases.length > 0 ? { text: frases.join(' '), vlBaix, clBaix } : null
}

/**
 * Genera l'informe qualitatiu complet d'un alumne, combinant tots els
 * trimestres/moments amb dades, amb llenguatge coeducador i empàtic, i
 * acabant amb una proposta de millora concreta. Retorna un únic text en
 * català, en paràgrafs separats per un salt de línia en blanc, apte per
 * enganxar a una acta d'avaluació.
 */
export function generaInformeQualitatiu({ nom, trimestres, teePerTrimestre, criterisTee, nivellsCicle, momentsLectura, lecturaPerMoment }) {
  const paragrafs = []
  let criteriMesFluixDarrer = null
  let vlBaixDarrer = false
  let clBaixDarrer = false

  const resultatsTee = trimestres
    .map((t) => paragrafTEE(nom, teePerTrimestre[t], criterisTee, nivellsCicle))
    .filter(Boolean)
  if (resultatsTee.length > 0) {
    if (resultatsTee.length === 1) {
      paragrafs.push(resultatsTee[0].text)
    } else {
      paragrafs.push(resultatsTee.map((r) => r.text).join(' '))
      const primer = resultatsTee[0].global
      const darrer = resultatsTee[resultatsTee.length - 1].global
      if (primer && darrer && primer.id !== darrer.id) {
        if (darrer.punts < primer.punts) {
          paragrafs.push(`Es constata una evolució positiva al llarg del curs, passant d'un nivell ${primer.label} a un nivell ${darrer.label}. És un progrés que val la pena reconèixer i celebrar amb ${nom}.`)
        } else {
          paragrafs.push(`S'observa un canvi respecte a l'inici de curs (de ${primer.label} a ${darrer.label}) que caldria seguir acompanyant de prop, sense perdre de vista els avenços fets fins ara.`)
        }
      } else {
        paragrafs.push(`Manté un nivell estable (${darrer.label}) al llarg del curs.`)
      }
    }
    criteriMesFluixDarrer = resultatsTee[resultatsTee.length - 1].criteriMesFluix
  }

  const resultatsLectura = momentsLectura
    .map((m) => paragrafLectura(nom, lecturaPerMoment[m.id], m))
    .filter(Boolean)
  if (resultatsLectura.length > 0) {
    paragrafs.push(resultatsLectura.map((r) => r.text).join(' '))
    const darrer = resultatsLectura[resultatsLectura.length - 1]
    vlBaixDarrer = darrer.vlBaix
    clBaixDarrer = darrer.clBaix
  }

  if (paragrafs.length === 0) {
    return 'Encara no hi ha prou dades introduïdes (TEE o Lectura) per generar cap informe qualitatiu.'
  }

  // --- Proposta de millora, sempre en positiu i orientada a l'acció ---
  const propostes = []
  if (criteriMesFluixDarrer && PROPOSTES_CRITERI[criteriMesFluixDarrer]) {
    propostes.push(PROPOSTES_CRITERI[criteriMesFluixDarrer])
  }
  if (vlBaixDarrer) propostes.push(PROPOSTA_VL_BAIX)
  if (clBaixDarrer) propostes.push(PROPOSTA_CL_BAIX)

  if (propostes.length > 0) {
    const llistaPropostes = propostes.length === 1
      ? propostes[0]
      : propostes.slice(0, -1).join(', ') + ' i ' + propostes[propostes.length - 1]
    paragrafs.push(`Proposta de millora: es recomana ${llistaPropostes}. Amb un acompanyament constant i proper, ${nom} té totes les eines per seguir avançant.`)
  } else {
    paragrafs.push(`Proposta de millora: es recomana mantenir l'acompanyament actual i seguir oferint reptes que motivin ${nom} a continuar progressant.`)
  }

  return paragrafs.join('\n\n')
}

// Generador de text qualitatiu per als informes d'alumne — combina les
// notes ja introduïdes (TEE i Lectura) en frases redactades en català,
// aptes per enganxar a una acta d'avaluació. No és cap IA: són plantilles
// que varien segons el nivell assolit, perquè el text soni natural.
//
// Tres criteris de redacció
// -------------------------
// 1. **Només el nom de fonts.** A un informe d'infant no li hem de posar
//    els cognoms; el text queda més proper i, de passada, més discret.
// 2. **El nom, com a molt dues vegades.** Repetir-lo a cada frase fa que
//    el text soni a formulari. A partir de la tercera menció s'escriuen
//    frases sense subjecte explícit, que en català queden naturals.
// 3. **Llenguatge coeducador i de procés**: sense pronoms de gènere, sense
//    etiquetar, i parlant d'on és ara i cap a on pot anar. Res de
//    "insuficient" ni "dificultats", sinó "encara en procés de consolidar".
//
// El text sempre queda editable: el mestre hi pot retocar el que vulgui.

/**
 * Del nom complet, només el de fonts.
 * Els alumnes es desen com a "Cognom1 Cognom2, Nom"; si no hi ha coma,
 * s'agafa la primera paraula, que és el cas dels noms escrits al revés.
 */
export function primerNom(nomComplet) {
  if (!nomComplet) return ''
  const net = String(nomComplet).trim()
  if (net.includes(',')) {
    const darrere = net.split(',').slice(1).join(',').trim()
    if (darrere) return darrere.split(/\s+/)[0]
  }
  return net.split(/\s+/)[0]
}

/**
 * Reparteix les mencions del nom: les dues primeres vegades el retorna, i
 * a partir d'aquí retorna null perquè qui l'utilitza escrigui la frase
 * sense subjecte.
 */
const majuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

function comptadorDeNom(nom, maxim = 2) {
  let usos = 0
  return {
    /** El nom si encara queda quota; null si no. */
    seguent() {
      if (usos >= maxim) return null
      usos++
      return nom
    },
    get gastat() { return usos >= maxim },
  }
}

// Descriptor de nivell "general" (0 = millor … 4 = pitjor), a partir dels
// punts que ja té cada nivell. Val per a qualsevol dels vocabularis de
// nivell de l'app (AE/AN/AS/NA, Expert/Avançat…).
function descriptorPerPunts(punts) {
  if (punts <= 1) {
    return {
      adjectiu: 'excel·lent',
      ambNom: (n) => `${n} mostra un domini molt sòlid de l'expressió escrita`,
      senseNom: 'el domini de l\'expressió escrita és molt sòlid',
      matis: 'Els textos que produeix són clars, ben travats i resolen amb comoditat el que se li demana.',
    }
  }
  if (punts <= 2) {
    return {
      adjectiu: 'notable',
      ambNom: (n) => `${n} escriu amb un bon domini de la llengua`,
      senseNom: "l'expressió escrita es manté en un bon nivell",
      matis: 'Els seus textos compleixen la intenció comunicativa i es llegeixen amb facilitat.',
    }
  }
  if (punts <= 3) {
    return {
      adjectiu: 'satisfactori',
      ambNom: (n) => `${n} resol de manera satisfactòria els aspectes bàsics de l'expressió escrita`,
      senseNom: "els aspectes bàsics de l'expressió escrita estan assolits",
      matis: 'Els textos compleixen la seva funció, i el treball continuat farà que guanyin en precisió i riquesa.',
    }
  }
  return {
    adjectiu: "en procés d'assoliment",
    ambNom: (n) => `${n} està en procés de consolidar l'expressió escrita`,
    senseNom: "l'expressió escrita encara s'està consolidant",
    matis: "Cada text és una oportunitat per anar-hi guanyant seguretat, i l'acompanyament proper hi farà molt.",
  }
}

// Dues maneres de dir cada criteri, per no repetir la mateixa paraula si
// surt més d'un cop a l'informe.
const FRASES_CRITERI = {
  coherencia: ["l'organització i la coherència de les idees", 'la manera com estructura i enllaça el que vol dir'],
  lexic: ['la varietat i la precisió del lèxic', 'el vocabulari que posa en joc'],
  presentacio: ["la presentació i l'endreç del text", "la cura en la cal·ligrafia i la presentació"],
  ortografia: ["l'ortografia", 'la correcció ortogràfica'],
  morfosintaxis: ['la morfosintaxi', 'la construcció gramatical de les frases'],
}

// Proposta de millora per a cada criteri, sempre orientada a l'acció.
const PROPOSTES_CRITERI = {
  coherencia: "dedicar uns minuts a planificar el text abans d'escriure'l —una pluja d'idees o un esquema senzill— per anar ordenant el que es vol explicar",
  lexic: 'ampliar el vocabulari amb lectures variades i amb jocs de sinònims, antònims i famílies de paraules',
  presentacio: "practicar de manera breu i regular la cal·ligrafia i la distribució del text al full",
  ortografia: "reforçar l'ortografia amb dictats curts i freqüents i revisant plegats els errors que es repeteixen",
  morfosintaxis: "treballar la construcció de frases variades, ampliant i transformant oracions a partir de models",
}

const PROPOSTA_VL = 'mantenir una estona curta de lectura en veu alta cada dia —deu minuts en van prou— per guanyar fluïdesa'
const PROPOSTA_CL = "acompanyar cada lectura amb preguntes obertes i amb estratègies senzilles per resumir el que s'ha llegit"

const FRASES_PUNT_FORT = [
  (q) => `Destaca especialment en ${q}`,
  (q) => `${q.charAt(0).toUpperCase()}${q.slice(1)} és un dels seus punts forts`,
]

/** Redacta el paràgraf d'expressió escrita d'UN trimestre. */
function paragrafTEE(registre, criteris, nivellsCicle, noms, index) {
  if (!registre) return null
  const nivell = (id) => nivellsCicle.find((n) => n.id === id)
  const global = nivell(registre.global)
  if (!global) return null

  const desc = descriptorPerPunts(global.punts)
  const nom = noms.seguent()
  const frases = []
  frases.push(nom
    ? `${desc.ambNom(nom)} (nivell ${global.label}).`
    : `${desc.senseNom.charAt(0).toUpperCase()}${desc.senseNom.slice(1)} (nivell ${global.label}).`)
  // El matís només el primer cop: repetit a cada trimestre sonaria a calc.
  if (index === 0) frases.push(desc.matis)

  const puntuats = criteris
    .map((c) => ({ criteri: c, nivellCriteri: nivell(registre.criteris?.[c.id]) }))
    .filter((x) => x.nivellCriteri)

  let criteriMesFluix = null
  if (puntuats.length > 0) {
    const millor = puntuats.reduce((a, b) => (a.nivellCriteri.punts <= b.nivellCriteri.punts ? a : b))
    const pitjor = puntuats.reduce((a, b) => (a.nivellCriteri.punts >= b.nivellCriteri.punts ? a : b))
    const diu = (id, variant = 0) => FRASES_CRITERI[id]?.[variant] ?? FRASES_CRITERI[id]?.[0] ?? id
    const variant = index % 2

    if (millor.criteri.id !== pitjor.criteri.id && pitjor.nivellCriteri.punts - millor.nivellCriteri.punts >= 2) {
      const fort = FRASES_PUNT_FORT[variant](diu(millor.criteri.id, variant))
      frases.push(`${fort}, mentre que ${diu(pitjor.criteri.id, variant)} és l'aspecte amb més marge de creixement.`)
      criteriMesFluix = pitjor.criteri.id
    } else if (millor.nivellCriteri.punts <= 2) {
      frases.push(`El conjunt es manté equilibrat, amb ${diu(millor.criteri.id, variant)} com a punt de suport.`)
    } else if (pitjor.nivellCriteri.punts >= 3) {
      frases.push(`L'aspecte on ara caldria posar més atenció és ${diu(pitjor.criteri.id, variant)}.`)
      criteriMesFluix = pitjor.criteri.id
    }
  }
  return { text: frases.join(' '), criteriMesFluix, global }
}

/** "a la primera avaluació" però "a l'avaluació final": en català l'article
 *  s'apostrofa davant de vocal, i els moments es diuen "Avaluació…". */
function aLa(etiqueta, perDefecte) {
  const text = (etiqueta ?? perDefecte).toLowerCase()
  return /^[aeiouàèéíòóúh]/.test(text) ? `a l'${text}` : `a la ${text}`
}

/** Redacta el paràgraf de lectura d'UN moment. */
function paragrafLectura(registre, moment, noms, index, vlAnterior) {
  if (!registre) return null
  const frases = []
  let vlBaix = false
  let clBaix = false

  if (registre.vl !== null && registre.vl !== undefined) {
    const nivell = registre.nivellVl ?? 'sense classificar'
    if (index === 0) {
      const nom = noms.seguent()
      frases.push(nom
        ? `${majuscula(aLa(moment?.label, 'primera avaluació'))}, ${nom} llegeix a un ritme de ${registre.vl} paraules per minut (nivell ${nivell}).`
        : `${majuscula(aLa(moment?.label, 'primera avaluació'))}, la velocitat lectora se situa en ${registre.vl} paraules per minut (nivell ${nivell}).`)
    } else if (vlAnterior !== null && registre.vl > vlAnterior) {
      frases.push(`${majuscula(aLa(moment?.label, 'següent avaluació'))} arriba a ${registre.vl} paraules per minut (nivell ${nivell}), ${registre.vl - vlAnterior} més que al principi.`)
    } else if (vlAnterior !== null && registre.vl < vlAnterior) {
      frases.push(`${majuscula(aLa(moment?.label, 'següent avaluació'))} el ritme és de ${registre.vl} paraules per minut (nivell ${nivell}), una mica per sota de la lectura anterior.`)
    } else {
      frases.push(`${majuscula(aLa(moment?.label, 'següent avaluació'))} el ritme es manté en ${registre.vl} paraules per minut (nivell ${nivell}).`)
    }
    vlBaix = /baix|insuficient|inicial/i.test(String(registre.nivellVl ?? ''))
  }

  if (moment?.teCL && registre.cl !== null && registre.cl !== undefined) {
    const nivell = registre.nivellCl ?? 'sense classificar'
    frases.push(vlBaix
      ? `La comprensió del que llegeix es troba en un nivell ${nivell}, i és bon senyal que la lectura tingui sentit més enllà del ritme.`
      : `La comprensió lectora es troba en un nivell ${nivell}.`)
    clBaix = /baix|insuficient/i.test(String(registre.nivellCl ?? ''))
  }

  return frases.length > 0 ? { text: frases.join(' '), vlBaix, clBaix, vl: registre.vl ?? null } : null
}

/**
 * Genera l'informe qualitatiu complet d'un alumne.
 *
 * @param {string} nom  el nom complet tal com és a la fitxa; aquí dins se
 *                      n'agafa només el de fonts.
 * @returns {string} text en paràgrafs, separats per una línia en blanc.
 */
export function generaInformeQualitatiu({
  nom, trimestres, teePerTrimestre, criterisTee, nivellsCicle, momentsLectura, lecturaPerMoment,
}) {
  const nomCurt = primerNom(nom)
  const noms = comptadorDeNom(nomCurt)
  const paragrafs = []
  let criteriMesFluixDarrer = null
  let vlBaixDarrer = false
  let clBaixDarrer = false

  // ── Expressió escrita ────────────────────────────────────────────────
  const resultatsTee = trimestres
    .map((t, i) => paragrafTEE(teePerTrimestre[t], criterisTee, nivellsCicle, noms, i))
    .filter(Boolean)

  if (resultatsTee.length > 0) {
    paragrafs.push(resultatsTee.map((r) => r.text).join(' '))

    if (resultatsTee.length > 1) {
      const primer = resultatsTee[0].global
      const darrer = resultatsTee[resultatsTee.length - 1].global
      if (primer && darrer && primer.id !== darrer.id) {
        paragrafs.push(darrer.punts < primer.punts
          ? `Al llarg del curs s'hi aprecia una evolució clara, del nivell ${primer.label} al nivell ${darrer.label}. És un progrés que val la pena reconèixer i celebrar, perquè hi ha hagut constància al darrere.`
          : `Respecte a l'inici de curs s'observa un canvi (de ${primer.label} a ${darrer.label}) que convindrà seguir de prop, sense perdre de vista tot el que s'ha construït fins ara.`)
      } else if (darrer) {
        paragrafs.push(`El nivell s'ha mantingut estable (${darrer.label}) durant tot el curs, cosa que indica una base ja consolidada sobre la qual seguir construint.`)
      }
    }
    criteriMesFluixDarrer = resultatsTee[resultatsTee.length - 1].criteriMesFluix
  }

  // ── Lectura ──────────────────────────────────────────────────────────
  const resultatsLectura = []
  let vlAnterior = null
  for (const m of momentsLectura) {
    const r = paragrafLectura(lecturaPerMoment[m.id], m, noms, resultatsLectura.length, vlAnterior)
    if (!r) continue
    if (r.vl !== null) vlAnterior = r.vl
    resultatsLectura.push(r)
  }

  if (resultatsLectura.length > 0) {
    paragrafs.push(resultatsLectura.map((r) => r.text).join(' '))
    const darrer = resultatsLectura[resultatsLectura.length - 1]
    vlBaixDarrer = darrer.vlBaix
    clBaixDarrer = darrer.clBaix
  }

  if (paragrafs.length === 0) {
    return 'Encara no hi ha prou dades introduïdes (TEE o Lectura) per generar cap informe qualitatiu.'
  }

  // ── Proposta de millora ──────────────────────────────────────────────
  const propostes = []
  if (criteriMesFluixDarrer && PROPOSTES_CRITERI[criteriMesFluixDarrer]) {
    propostes.push(PROPOSTES_CRITERI[criteriMesFluixDarrer])
  }
  if (vlBaixDarrer) propostes.push(PROPOSTA_VL)
  if (clBaixDarrer) propostes.push(PROPOSTA_CL)

  if (propostes.length > 0) {
    const llista = propostes.length === 1
      ? propostes[0]
      : `${propostes.slice(0, -1).join('; ')}; i ${propostes[propostes.length - 1]}`
    paragrafs.push(`De cara als propers mesos, la proposta és ${llista}. Amb un acompanyament constant i proper hi ha totes les eines per seguir avançant.`)
  } else {
    paragrafs.push('De cara als propers mesos, la proposta és mantenir l\'acompanyament actual i seguir oferint reptes que engresquin a continuar progressant.')
  }

  return paragrafs.join('\n\n')
}

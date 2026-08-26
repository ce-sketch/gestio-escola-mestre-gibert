// Generador de text qualitatiu per als informes d'alumne — combina les
// notes ja introduïdes (TEE i Lectura) en frases redactades en català,
// aptes per enganxar a una acta d'avaluació. No és cap IA: és un banc de
// frases, i per a cada alumne se n'agafa una combinació.
//
// Per què un banc de frases i no una sola plantilla
// -------------------------------------------------
// Amb una sola manera de dir cada cosa, tots els informes d'una classe
// surten calcats i es nota que els ha escrit una màquina. Aquí hi ha entre
// tres i cinc maneres de dir cada cosa, i la tria **depèn del nom de
// l'alumne**: així dos infants amb les mateixes notes tenen textos que
// sonen diferents, però el mateix infant té sempre el mateix text si el
// tornes a generar. Això últim importa: no vols que et canviï el redactat
// sota els peus quan reobris l'informe.
//
// Tres criteris de redacció
// -------------------------
// 1. **Només el nom de fonts.** A un informe d'infant no li hem de posar
//    els cognoms; queda més proper i més discret.
// 2. **El nom, com a molt dues vegades.** A partir d'aquí, frases sense
//    subjecte explícit, que en català queden naturals.
// 3. **Llenguatge coeducador i de procés**: sense pronoms de gènere, sense
//    etiquetar, parlant d'on és ara i cap a on pot anar.
//
// El text sempre queda editable: el mestre hi pot retocar el que vulgui.

/**
 * Del nom complet, només el de fonts.
 * Els alumnes es desen com a "Cognom1 Cognom2, Nom"; si no hi ha coma,
 * s'agafa la primera paraula.
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
 * "de" + nom, apostrofat com toca en català: "de Bru" però "d'Anna".
 *
 * S'apostrofa davant de vocal i de h muda. La "i" i la "u" àtones amb
 * consonant al darrere no s'apostrofarien en un article ("la Irene"),
 * però amb la preposició "de" sí que ho fan ("d'Irene"), així que aquí
 * n'hi ha prou amb mirar la primera lletra.
 */
export function deNom(nom) {
  const net = String(nom ?? '').trim()
  if (!net) return 'de'
  return /^[aeiouàèéíòóúüh]/i.test(net) ? `d'${net}` : `de ${net}`
}

/** Número estable a partir d'un text: mateix nom, mateixa tria de frases. */
function llavor(text) {
  let n = 0
  for (const c of String(text)) n = (n * 31 + c.codePointAt(0)) % 100000
  return n
}

/**
 * Tria una opció de la llista, sempre la mateixa per a la mateixa llavor.
 *
 * A la llavor de l'alumne s'hi suma una empremta de la pròpia llista. Sense
 * això, totes les llistes es movien alhora i dos alumnes amb la mateixa
 * llavor mòdul quatre acabaven amb informes calcats; amb l'empremta, cada
 * família de frases es reparteix per la seva banda.
 */
function tria(llista, sembra, desplaçament = 0) {
  const empremta = llavor(String(llista[0]))
  return llista[(sembra + desplaçament + empremta) % llista.length]
}

const majuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

/** "a la primera avaluació" però "a l'avaluació final". */
function aLa(etiqueta, perDefecte) {
  const text = (etiqueta ?? perDefecte).toLowerCase()
  return /^[aeiouàèéíòóúh]/.test(text) ? `a l'${text}` : `a la ${text}`
}

/**
 * Reparteix els usos del nom, amb un màxim per a TOT l'informe.
 *
 * S'exporta perquè el paràgraf de matemàtiques (`informeMatematiques.js`)
 * i el de llengua han de compartir el mateix comptador: si cadascun es
 * fes el seu, el nom sortiria fins a quatre vegades en un informe que
 * només n'admet dues, i es notaria molt.
 */
export function comptadorDeNom(nom, maxim = 2) {
  let usos = 0
  return {
    seguent() {
      if (usos >= maxim) return null
      usos++
      return nom
    },
  }
}

// ── Banc de frases ──────────────────────────────────────────────────────

// Quatre maneres de descriure cada franja de nivell, amb el matís que
// explica què vol dir a la pràctica.
const NIVELLS = {
  alt: {
    ambNom: [
      (n) => `${n} mostra un domini molt sòlid de l'expressió escrita`,
      (n) => `${n} escriu amb seguretat i amb recursos propis`,
      (n) => `L'expressió escrita és un terreny on ${n} es mou amb comoditat`,
      (n) => `${n} demostra un nivell molt alt en tot allò que té a veure amb escriure`,
    ],
    senseNom: [
      "el domini de l'expressió escrita és molt sòlid",
      'escriure és una activitat que es resol amb seguretat i recursos propis',
      "l'expressió escrita continua sent un punt molt fort",
      'el nivell en expressió escrita es manté molt alt',
    ],
    matis: [
      'Els textos que produeix són clars, ben travats i resolen amb comoditat el que se li demana.',
      "Hi ha intenció en el que escriu: tria les paraules, ordena les idees i les fa arribar al lector.",
      'El resultat va més enllà del que demana la consigna, amb aportacions personals que enriqueixen el text.',
      "S'hi nota una veu pròpia, i això és el més difícil d'ensenyar.",
    ],
  },
  bo: {
    ambNom: [
      (n) => `${n} escriu amb un bon domini de la llengua`,
      (n) => `${n} es desenvolupa bé quan ha d'escriure`,
      (n) => `L'expressió escrita ${deNom(n)} es troba en un bon moment`,
      (n) => `${n} resol amb solvència les propostes d'escriptura`,
    ],
    senseNom: [
      "l'expressió escrita es manté en un bon nivell",
      'escriure és una activitat que es resol amb solvència',
      'el domini de la llengua escrita continua sent bo',
      'les propostes d\'escriptura es resolen amb comoditat',
    ],
    matis: [
      'Els seus textos compleixen la intenció comunicativa i es llegeixen amb facilitat.',
      "El que escriu s'entén bé i respon al que se li demana, amb una base ja assentada.",
      'Hi ha ofici en com organitza el text, i això dona peu a anar afinant els detalls.',
      "S'hi veu una feina feta que ja dona fruits, i que val la pena continuar.",
    ],
  },
  satisfactori: {
    ambNom: [
      (n) => `${n} resol de manera satisfactòria els aspectes bàsics de l'expressió escrita`,
      (n) => `${n} té assentats els fonaments de l'escriptura`,
      (n) => `Quan escriu, ${n} arriba a allò essencial que se li demana`,
      (n) => `${n} compleix els aspectes bàsics quan es posa a escriure`,
    ],
    senseNom: [
      "els aspectes bàsics de l'expressió escrita estan assolits",
      'els fonaments de l\'escriptura estan assentats',
      "el que s'escriu arriba a allò essencial que es demana",
      'la base de l\'expressió escrita es manté assolida',
    ],
    matis: [
      'Els textos compleixen la seva funció, i el treball continuat farà que guanyin en precisió i riquesa.',
      "Hi ha una base sobre la qual construir: a partir d'aquí, cada text pot anar sumant un punt més de cura.",
      'El següent pas passa per anar polint els detalls, que és on es guanya la diferència.',
      "Amb la pràctica regular, aquests fonaments aniran donant textos cada cop més rics.",
    ],
  },
  process: {
    ambNom: [
      (n) => `${n} està en procés de consolidar l'expressió escrita`,
      (n) => `${n} va fent camí en l'aprenentatge de l'escriptura`,
      (n) => `L'escriptura és, per a ${n}, un terreny encara en construcció`,
      (n) => `${n} continua treballant per assentar les bases de l'expressió escrita`,
    ],
    senseNom: [
      "l'expressió escrita encara s'està consolidant",
      "l'escriptura continua sent un terreny en construcció",
      'les bases de l\'expressió escrita encara s\'estan assentant',
      'queda camí per fer en l\'aprenentatge de l\'escriptura',
    ],
    matis: [
      "Cada text és una oportunitat per anar-hi guanyant seguretat, i l'acompanyament proper hi farà molt.",
      "El més important ara és mantenir les ganes d'escriure: la tècnica arriba després.",
      'Convé valorar cada avenç, per petit que sembli, perquè és així com es construeix la confiança.',
      "Amb propostes ajustades i temps, aquest procés anirà donant els seus fruits.",
    ],
  },
}

function franjaPerPunts(punts) {
  if (punts <= 1) return NIVELLS.alt
  if (punts <= 2) return NIVELLS.bo
  if (punts <= 3) return NIVELLS.satisfactori
  return NIVELLS.process
}

// Quatre maneres de dir cada criteri.
const FRASES_CRITERI = {
  coherencia: [
    "l'organització i la coherència de les idees",
    'la manera com estructura i enllaça el que vol dir',
    'el fil que segueix el text de principi a fi',
    "l'ordre amb què presenta allò que explica",
  ],
  lexic: [
    'la varietat i la precisió del lèxic',
    'el vocabulari que posa en joc',
    'la riquesa de les paraules que tria',
    'la precisió a l\'hora de triar cada paraula',
  ],
  presentacio: [
    "la presentació i l'endreç del text",
    'la cura en la cal·ligrafia i la presentació',
    "l'aspecte final del que lliura",
    'la pulcritud amb què presenta la feina',
  ],
  ortografia: [
    "l'ortografia",
    'la correcció ortogràfica',
    'la cura ortogràfica',
    "l'escriptura correcta de les paraules",
  ],
  morfosintaxis: [
    'la morfosintaxi',
    'la construcció gramatical de les frases',
    'la manera com construeix les oracions',
    'la solidesa gramatical del que escriu',
  ],
}

const PUNT_FORT = [
  (q) => `Destaca especialment en ${q}`,
  (q) => `${majuscula(q)} és un dels seus punts forts`,
  (q) => `Se'n surt especialment bé amb ${q}`,
  (q) => `On més es nota la feina feta és en ${q}`,
]

const PUNT_A_MILLORAR = [
  (q) => `${q} és l'aspecte amb més marge de creixement`,
  (q) => `en ${q} és on hi ha més recorregut per endavant`,
  (q) => `${q} és el terreny on ara val la pena posar l'atenció`,
  (q) => `queda camí per fer en ${q}`,
]

const EQUILIBRI = [
  (q) => `El conjunt es manté equilibrat, amb ${q} com a punt de suport.`,
  (q) => `No hi ha grans desnivells entre criteris, i ${q} fa de base.`,
  (q) => `Els diferents aspectes avancen a un ritme semblant, amb ${q} al davant.`,
  (q) => `El treball és regular en tots els criteris, i ${q} és el que hi destaca.`,
]

// Un criteri que ha estat el més fluix TOTS els trimestres no és el
// mateix que un que ho ha estat un cop: en el primer cas hi ha un patró,
// i val la pena dir-ho d'una altra manera.
const FLUIX_PERSISTENT = [
  (q) => `Al llarg de tot el curs, ${q} ha estat l'aspecte amb més recorregut per endavant.`,
  (q) => `${majuscula(q)} s'ha mantingut com el terreny amb més marge durant tot el curs.`,
  (q) => `Els tres trimestres apunten cap al mateix: ${q} és on val la pena concentrar l'esforç.`,
]

// Reconèixer una millora concreta és el que fa que un informe no sembli
// una fitxa: no és el mateix "ha millorat" que dir en què.
const CRITERI_MILLORAT = [
  (q) => `On més s'ha avançat durant el curs és en ${q}.`,
  (q) => `${majuscula(q)} és l'aspecte que més ha crescut al llarg del curs.`,
  (q) => `El progrés més visible del curs s'ha donat en ${q}.`,
]

const EVOLUCIO_POSITIVA = [
  (a, b) => `Al llarg del curs s'hi aprecia una evolució clara, del nivell ${a} al nivell ${b}. És un progrés que val la pena reconèixer i celebrar, perquè hi ha hagut constància al darrere.`,
  (a, b) => `El curs deixa un recorregut evident: de ${a} a ${b}. Aquests avenços no arriben sols, i convé dir-ho.`,
  (a, b) => `Hi ha hagut una millora sostinguda durant el curs, que ha portat del nivell ${a} al ${b}. És el resultat d'una feina mantinguda.`,
  (a, b) => `De ${a} a ${b} en un curs: val la pena aturar-s'hi i reconèixer l'esforç que hi ha darrere d'aquest canvi.`,
]

const EVOLUCIO_A_SEGUIR = [
  (a, b) => `Respecte a l'inici de curs s'observa un canvi (de ${a} a ${b}) que convindrà seguir de prop, sense perdre de vista tot el que s'ha construït fins ara.`,
  (a, b) => `El recorregut del curs (de ${a} a ${b}) demana un acompanyament més atent els propers mesos, partint del molt que ja hi ha fet.`,
  (a, b) => `Hi ha hagut un canvi de ${a} a ${b} que val la pena mirar amb calma i acompanyar, sense que això esborri els avenços anteriors.`,
]

const ESTABLE = [
  (n) => `El nivell s'ha mantingut estable (${n}) durant tot el curs, cosa que indica una base ja consolidada sobre la qual seguir construint.`,
  (n) => `Al llarg del curs el nivell s'ha sostingut (${n}), senyal que allò après ha quedat ben assentat.`,
  (n) => `La regularitat ha estat la nota dominant del curs (${n}), i aquesta constància també és un valor.`,
]

// Propostes de millora: dues formulacions per criteri.
const PROPOSTES_CRITERI = {
  coherencia: [
    "dedicar uns minuts a planificar el text abans d'escriure'l —una pluja d'idees o un esquema senzill— per anar ordenant el que es vol explicar",
    "acostumar-se a pensar el text en tres moments (què vull dir, en quin ordre, com el tanco) abans de començar a escriure",
  ],
  lexic: [
    'ampliar el vocabulari amb lectures variades i amb jocs de sinònims, antònims i famílies de paraules',
    "anar recollint les paraules noves que apareixen a les lectures i provar d'incorporar-les als textos propis",
  ],
  presentacio: [
    'practicar de manera breu i regular la cal·ligrafia i la distribució del text al full',
    "reservar sempre un moment al final per rellegir i endreçar el full abans de donar la feina per acabada",
  ],
  ortografia: [
    "reforçar l'ortografia amb dictats curts i freqüents i revisant plegats els errors que es repeteixen",
    "portar un petit recull personal de les paraules que costen més, per tenir-les a mà en el moment d'escriure",
  ],
  morfosintaxis: [
    'treballar la construcció de frases variades, ampliant i transformant oracions a partir de models',
    "provar de combinar frases curtes en frases més llargues, i a l'inrevés, per guanyar flexibilitat",
  ],
}

const PROPOSTA_VL = [
  'mantenir una estona curta de lectura en veu alta cada dia —deu minuts en van prou— per guanyar fluïdesa',
  'llegir en veu alta una estona breu però diària, buscant textos que enganxin per fer-ho més fàcil',
]

const PROPOSTA_CL = [
  "acompanyar cada lectura amb preguntes obertes i amb estratègies senzilles per resumir el que s'ha llegit",
  'conversar sobre el que s\'ha llegit abans de donar-ho per acabat, per assegurar que el text ha deixat pòsit',
]

const OBERTURA_PROPOSTA = [
  'De cara als propers mesos, la proposta és',
  'Com a línia de treball per als propers mesos, es proposa',
  'Per continuar avançant, la proposta passa per',
  'De cara endavant, seria bo',
]

const TANCAMENT = [
  'Amb un acompanyament constant i proper hi ha totes les eines per seguir avançant.',
  "Amb el suport adequat i temps, aquest camí es continuarà fent amb bon pas.",
  'Res d\'això és urgent: amb constància i acompanyament, els resultats arriben.',
  'Hi ha una base sòlida per seguir construint, i això és el que compta.',
]

const SENSE_PROPOSTA = [
  "mantenir l'acompanyament actual i seguir oferint reptes que engresquin a continuar progressant",
  "sostenir el que ja es fa i anar proposant reptes nous que mantinguin viva la motivació",
  'continuar per aquest camí, buscant propostes que segueixin estirant una mica més amunt',
]

/**
 * Com s'ha comportat cada criteri al llarg del curs.
 *
 * Abans, la proposta de millora sortia només del criteri més fluix de
 * l'ÚLTIM trimestre. Això vol dir que un mal dia al tercer trimestre
 * podia decidir tot l'informe, mentre que un criteri fluix tot l'any
 * quedava igualat amb un de puntual. Mirant els tres trimestres se sap
 * si hi ha un patró o va ser una excepció.
 *
 * Els "punts" van al revés de la intuïció: MENYS punts és MILLOR nivell
 * (1 = alt). Per això "millorar" vol dir que els punts baixen.
 *
 * @returns {{persistent: string|null, millorat: string|null}}
 *   `persistent`: id del criteri que ha estat el més fluix a tots els
 *   trimestres (només si n'hi ha dos o més amb dades).
 *   `millorat`: id del criteri que més ha guanyat, si el guany és d'un
 *   nivell sencer o més — per sota d'això no és una millora, és soroll.
 */
export function tendenciaCriteris(trimestres, teePerTrimestre, criteris, nivellsCicle) {
  const punts = (id, registre) =>
    nivellsCicle.find((n) => n.id === registre?.criteris?.[id])?.punts ?? null

  const ambDades = trimestres.filter((t) => teePerTrimestre[t])
  if (ambDades.length < 2) return { persistent: null, millorat: null }

  let persistent = null
  let millorat = null
  let millorGuany = 0

  for (const c of criteris) {
    const serie = ambDades.map((t) => punts(c.id, teePerTrimestre[t])).filter((p) => p !== null)
    if (serie.length < 2) continue

    // Guany = quants punts ha baixat del primer al darrer trimestre.
    const guany = serie[0] - serie[serie.length - 1]
    if (guany >= 1 && guany > millorGuany) {
      millorGuany = guany
      millorat = c.id
    }
  }

  // El més fluix de cada trimestre; si sempre és el mateix, hi ha patró.
  const mesFluixDe = (registre) => {
    const puntuats = criteris
      .map((c) => ({ id: c.id, p: punts(c.id, registre) }))
      .filter((x) => x.p !== null)
    if (puntuats.length === 0) return null
    return puntuats.reduce((a, b) => (a.p >= b.p ? a : b)).id
  }
  const fluixos = ambDades.map((t) => mesFluixDe(teePerTrimestre[t])).filter(Boolean)
  if (fluixos.length === ambDades.length && new Set(fluixos).size === 1) {
    persistent = fluixos[0]
  }

  return { persistent, millorat }
}

// ── Redacció ────────────────────────────────────────────────────────────

/** Paràgraf d'expressió escrita d'UN trimestre. */
function paragrafTEE(registre, criteris, nivellsCicle, noms, index, sembra, anterior = {}) {
  if (!registre) return null
  const nivell = (id) => nivellsCicle.find((n) => n.id === id)
  const global = nivell(registre.global)
  if (!global) return null

  const { parell: parellAnterior = null, globalId: globalAnterior = null } = anterior
  const franja = franjaPerPunts(global.punts)

  // Quins criteris destaquen aquest trimestre, per saber si aporta res nou.
  const puntuatsPrevi = criteris
    .map((c) => ({ criteri: c, nivellCriteri: nivell(registre.criteris?.[c.id]) }))
    .filter((x) => x.nivellCriteri)
  let parell = null
  if (puntuatsPrevi.length > 0) {
    const millorP = puntuatsPrevi.reduce((a, b) => (a.nivellCriteri.punts <= b.nivellCriteri.punts ? a : b))
    const pitjorP = puntuatsPrevi.reduce((a, b) => (a.nivellCriteri.punts >= b.nivellCriteri.punts ? a : b))
    parell = `${millorP.criteri.id}__${pitjorP.criteri.id}`
  }

  // Un trimestre en què NI el nivell global NI els criteris destacats han
  // canviat no té res a dir: repetir-ho amb altres paraules omplia
  // l'informe de frases que semblaven noves i deien el mateix, i a més
  // gastava els usos del nom, que estan comptats. Que s'ha mantingut ja
  // ho diu la frase d'evolució, més avall.
  if (globalAnterior !== null && global.id === globalAnterior && parell === parellAnterior) {
    return {
      text: '',
      criteriMesFluix: parell ? parell.split('__')[1] : null,
      global,
      parell,
      globalId: global.id,
    }
  }

  const nom = noms.seguent()
  const frases = []

  frases.push(nom
    ? `${tria(franja.ambNom, sembra, index)(nom)} (nivell ${global.label}).`
    : `${majuscula(tria(franja.senseNom, sembra, index))} (nivell ${global.label}).`)

  // El matís només el primer cop: repetit a cada trimestre sonaria a calc.
  if (index === 0) frases.push(tria(franja.matis, sembra))

  const puntuats = criteris
    .map((c) => ({ criteri: c, nivellCriteri: nivell(registre.criteris?.[c.id]) }))
    .filter((x) => x.nivellCriteri)

  let criteriMesFluix = null
  if (puntuats.length > 0) {
    const millor = puntuats.reduce((a, b) => (a.nivellCriteri.punts <= b.nivellCriteri.punts ? a : b))
    const pitjor = puntuats.reduce((a, b) => (a.nivellCriteri.punts >= b.nivellCriteri.punts ? a : b))
    const diu = (id, d = 0) => tria(FRASES_CRITERI[id] ?? [id], sembra, index + d)

    // Si el trimestre anterior ja destacava els MATEIXOS dos criteris, no
    // es torna a dir: el banc de frases ho diria amb altres paraules i
    // semblaria informació nova quan no ho és. El que ha canviat (o que
    // s'ha mantingut tot el curs) ja es resumeix més avall.
    if (parell === parellAnterior) {
      criteriMesFluix = pitjor.criteri.id
      return { text: frases.join(' '), criteriMesFluix, global, parell, globalId: global.id }
    }

    if (millor.criteri.id !== pitjor.criteri.id && pitjor.nivellCriteri.punts - millor.nivellCriteri.punts >= 2) {
      frases.push(`${tria(PUNT_FORT, sembra, index)(diu(millor.criteri.id))}, mentre que ${tria(PUNT_A_MILLORAR, sembra, index)(diu(pitjor.criteri.id, 1))}.`)
      criteriMesFluix = pitjor.criteri.id
    } else if (millor.nivellCriteri.punts <= 2) {
      frases.push(tria(EQUILIBRI, sembra, index)(diu(millor.criteri.id)))
    } else if (pitjor.nivellCriteri.punts >= 3) {
      frases.push(`${majuscula(tria(PUNT_A_MILLORAR, sembra, index)(diu(pitjor.criteri.id)))}.`)
      criteriMesFluix = pitjor.criteri.id
    }
  }
  return { text: frases.join(' '), criteriMesFluix, global, parell, globalId: global.id }
}

/** Paràgraf de lectura d'UN moment. */
function paragrafLectura(registre, moment, noms, index, vlAnterior, clAnterior, mantingut = false) {
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
    } else if (vlAnterior === null || vlAnterior === undefined) {
      frases.push(`${majuscula(aLa(moment?.label, 'següent avaluació'))} el ritme és de ${registre.vl} paraules per minut (nivell ${nivell}).`)
    } else if (!mantingut) {
      // Només es diu que es manté LA PRIMERA vegada: dir-ho a cada moment
      // era repetir la mateixa frase amb el mateix número.
      frases.push(`${majuscula(aLa(moment?.label, 'següent avaluació'))} el ritme es manté en ${registre.vl} paraules per minut.`)
    }
    vlBaix = /baix|insuficient|inicial/i.test(String(registre.nivellVl ?? ''))
  }

  if (moment?.teCL && registre.cl !== null && registre.cl !== undefined) {
    const nivell = registre.nivellCl ?? 'sense classificar'
    // La comprensió també evoluciona, i abans no se'n deia res: sortia
    // sempre com una foto fixa, encara que hagués canviat de nivell.
    const teAnterior = clAnterior !== null && clAnterior !== undefined
    if (teAnterior && registre.cl > clAnterior) {
      frases.push(`La comprensió lectora ha guanyat terreny i se situa en un nivell ${nivell}.`)
    } else if (teAnterior && registre.cl < clAnterior) {
      frases.push(`La comprensió lectora queda en un nivell ${nivell}, una mica per sota de la lectura anterior.`)
    } else if (!teAnterior) {
      frases.push(vlBaix
        ? `La comprensió del que llegeix es troba en un nivell ${nivell}, i és bon senyal que la lectura tingui sentit més enllà del ritme.`
        : `La comprensió lectora es troba en un nivell ${nivell}.`)
    }
    // Si la comprensió no ha canviat, no es diu res: repetir "es troba en
    // un nivell mitjà" a cada moment omplia el paràgraf de frases
    // idèntiques. Que s'ha mantingut ja s'entén de la resta del text.
    clBaix = /baix|insuficient/i.test(String(registre.nivellCl ?? ''))
  }

  return frases.length > 0 || registre.vl !== null
    ? {
        text: frases.join(' '), vlBaix, clBaix,
        vl: registre.vl ?? null, cl: registre.cl ?? null,
        // Perquè el bucle sàpiga que ja s'ha dit que el ritme es manté.
        esManté: vlAnterior !== null && vlAnterior !== undefined && registre.vl === vlAnterior,
      }
    : null
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
  noms: comptadorExtern = null,
}) {
  const nomCurt = primerNom(nom)
  const sembra = llavor(nom)
  // Si ve de fora, ja porta comptats els usos del paràgraf de matemàtiques.
  const noms = comptadorExtern ?? comptadorDeNom(nomCurt)
  const paragrafs = []
  let criteriMesFluixDarrer = null
  let vlBaixDarrer = false
  let clBaixDarrer = false

  const resultatsTee = []
  let anterior = {}
  for (const [i, t] of trimestres.entries()) {
    const r = paragrafTEE(teePerTrimestre[t], criterisTee, nivellsCicle, noms, i, sembra, anterior)
    if (!r) continue
    anterior = { parell: r.parell ?? anterior.parell, globalId: r.globalId }
    resultatsTee.push(r)
  }

  if (resultatsTee.length > 0) {
    // Els trimestres que no aporten res tornen text buit: filtrar-los
    // evita espais dobles enmig del paràgraf.
    const textos = resultatsTee.map((r) => r.text).filter(Boolean)
    if (textos.length > 0) paragrafs.push(textos.join(' '))

    if (resultatsTee.length > 1) {
      const primer = resultatsTee[0].global
      const darrer = resultatsTee[resultatsTee.length - 1].global
      if (primer && darrer && primer.id !== darrer.id) {
        paragrafs.push(darrer.punts < primer.punts
          ? tria(EVOLUCIO_POSITIVA, sembra)(primer.label, darrer.label)
          : tria(EVOLUCIO_A_SEGUIR, sembra)(primer.label, darrer.label))
      } else if (darrer) {
        paragrafs.push(tria(ESTABLE, sembra)(darrer.label))
      }
    }
    criteriMesFluixDarrer = resultatsTee[resultatsTee.length - 1].criteriMesFluix

    // El que ha passat AL LLARG del curs, no només al darrer trimestre.
    const { persistent, millorat } = tendenciaCriteris(trimestres, teePerTrimestre, criterisTee, nivellsCicle)
    const diu = (id) => tria(FRASES_CRITERI[id] ?? [id], sembra, 2)
    const extres = []
    if (millorat) extres.push(tria(CRITERI_MILLORAT, sembra)(diu(millorat)))
    if (persistent) {
      extres.push(tria(FLUIX_PERSISTENT, sembra)(diu(persistent)))
      // Un criteri fluix tot l'any pesa més que el del darrer trimestre a
      // l'hora de decidir què es proposa treballar.
      criteriMesFluixDarrer = persistent
    }
    if (extres.length > 0) paragrafs.push(extres.join(' '))
  }

  const resultatsLectura = []
  let vlAnterior = null
  let clAnterior = null
  let jaDitQueEsManté = false
  for (const m of momentsLectura) {
    const r = paragrafLectura(lecturaPerMoment[m.id], m, noms, resultatsLectura.length, vlAnterior, clAnterior, jaDitQueEsManté)
    if (!r) continue
    if (r.esManté) jaDitQueEsManté = true
    if (r.vl !== null) vlAnterior = r.vl
    if (r.cl !== null && r.cl !== undefined) clAnterior = r.cl
    resultatsLectura.push(r)
  }

  if (resultatsLectura.length > 0) {
    const textosLectura = resultatsLectura.map((r) => r.text).filter(Boolean)
    if (textosLectura.length > 0) paragrafs.push(textosLectura.join(' '))
    const darrer = resultatsLectura[resultatsLectura.length - 1]
    vlBaixDarrer = darrer.vlBaix
    clBaixDarrer = darrer.clBaix
  }

  if (paragrafs.length === 0) {
    return 'Encara no hi ha prou dades introduïdes (TEE o Lectura) per generar cap informe qualitatiu.'
  }

  const propostes = []
  if (criteriMesFluixDarrer && PROPOSTES_CRITERI[criteriMesFluixDarrer]) {
    propostes.push(tria(PROPOSTES_CRITERI[criteriMesFluixDarrer], sembra))
  }
  if (vlBaixDarrer) propostes.push(tria(PROPOSTA_VL, sembra))
  if (clBaixDarrer) propostes.push(tria(PROPOSTA_CL, sembra))

  const obertura = tria(OBERTURA_PROPOSTA, sembra)
  const tancament = tria(TANCAMENT, sembra)

  if (propostes.length > 0) {
    const llista = propostes.length === 1
      ? propostes[0]
      : `${propostes.slice(0, -1).join('; ')}; i ${propostes[propostes.length - 1]}`
    paragrafs.push(`${obertura} ${llista}. ${tancament}`)
  } else {
    paragrafs.push(`${obertura} ${tria(SENSE_PROPOSTA, sembra)}. ${tancament}`)
  }

  return paragrafs.join('\n\n')
}

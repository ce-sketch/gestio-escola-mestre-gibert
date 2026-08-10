import { GRUPS, objectiuFestaBuit } from './festesDetall'

// Text real dels objectius (i, quan es coneixen, les activitats
// d'Educació Infantil / Cicle Inicial) de cada festa, tal com surten a les
// plantilles del curs 2026-27. Nomès s'utilitza com a punt de partida la
// primera vegada que s'obre aquella festa en aquest curs concret — després
// tot és lliurement editable.

export const CURS_AMB_PLANTILLA = '2026-27'

function act(text) {
  return { id: crypto.randomUUID(), text, grau: '' }
}

// [objectiuIndex]: llista d'activitats — nomès pels grups on tenim el text
// real (Educació Infantil i Cicle Inicial, majoritàriament).
export const FESTES_PLANTILLES_26_27 = {
  castanyada: {
    activitat: 'Festa de la Castanyada',
    objectiusText: [
      { text: 'Fomentar la cohesió entre tots els nens i nenes de l’escola i millorar el sentit de pertinença i autoestima de la comunitat escolar.', pes: 30 },
      { text: 'Arrelar culturalment l’alumnat. Donar a conèixer la tradició de la castanyada i la festa de Halloween.', pes: 30 },
      { text: 'Elaborar, comunicar i difondre la celebració.', pes: 40 },
    ],
    activitatsPerGrup: {
      'Educació Infantil': [
        [act('Exposició de carbasses, moniatos i castanyes'), act('Espai compartit per menjar castanyes, panellets...'), act("Ball conjunt de tota l'escola")],
        [act('Manualitats, contes... de tardor, Castanyada i Halloween'), act('Disfresses de castanyera i Halloween'), act("Activitats d'aula per conèixer cançons, tradicions... relacionades amb la celebració")],
        [act("Reunions de cicle i/o delegats/es per concretar l'estructura de la celebració"), act('Comunicació famílies a través de Dinàntia'), act('Article de nivell/cicle publicat a la web')],
      ],
      'Cicle Inicial': [
        [act('Exposició de carbasses, moniatos i castanyes'), act('Espai compartit per menjar castanyes, panellets...'), act("Ball conjunt de tota l'escola")],
        [act('Manualitats, contes... de tardor, Castanyada i Halloween'), act('Disfresses de castanyera i Halloween'), act("Activitats d'aula per conèixer cançons, tradicions... relacionades amb la celebració")],
        [act("Reunions de cicle i/o delegats/es per concretar l'estructura de la celebració"), act('Comunicació famílies a través de Dinàntia'), act('Article de nivell/cicle publicat a la web')],
      ],
    },
  },
  nadal: {
    activitat: 'Festa de Nadal',
    objectiusText: [
      { text: 'Arrelar culturalment l’alumnat. Donar a conèixer la tradició del Nadal.', pes: 50 },
      { text: 'Preparar un concert de Nadal.', pes: 50 },
    ],
    activitatsPerGrup: {
      'Educació Infantil': [
        [act('Concert de Nadal'), act('Tió'), act('Calendari advent')],
        [act('Coneix la lletra de la cançó'), act('Actuació del dia de concert'), act('Feedback dels alumnes')],
      ],
      'Cicle Inicial': [
        [act('Tió'), act("El calendari de l'Avent"), act('Elaborar la tapa de l’àlbum en motius nadalencs')],
        [act('Coneix la lletra de la cançó'), act('Actuació del dia de concert'), act('Feedback dels alumnes')],
      ],
    },
  },
  carnestoltes: {
    activitat: 'Festa de Carnestoltes',
    objectiusText: [
      { text: 'Promoure la creativitat, expressió corporal i identitat a través de les consignes i disfresses.', pes: 50 },
      { text: 'Afavorir el sentiment de comunitat i cohesió d’escola mitjançant activitats compartides.', pes: 50 },
    ],
    activitatsPerGrup: {
      'Educació Infantil': [
        [act('Grau de participació amb les consignes'), act('Bona implicació en la disfressa')],
        [act('Participació en les activitats comunes de centre (activitat de divendres tarda) — desfilada per nivells a la pista'), act('Show del Rei Carnestoltes com a activitat dinamitzadora'), act('Gimcanes')],
      ],
      'Cicle Inicial': [
        [act('Grau de participació amb les consignes'), act('Bona implicació en la disfressa')],
        [act('Participació en les activitats comunes de centre — desfilada per nivells a la pista'), act('Música i dinamització (Reina Carnestoltes / mestre de cerimònies)'), act('Participació al matí en dinàmiques de cicle vinculades a activitats compartides de Carnestoltes')],
      ],
    },
  },
  mona: {
    activitat: 'Festa de la Mona',
    objectiusText: [
      { text: 'Promoure la creativitat, l’autonomia i la motricitat fina mitjançant l’elaboració i decoració de les mones.', pes: 50 },
      { text: 'Fomentar la convivència i la cohesió d’escola mitjançant activitats compartides, adaptades a l’organització de cada cicle.', pes: 50 },
    ],
    activitatsPerGrup: {
      'Educació Infantil': [
        [act('Elaboració de la mona seguint consignes bàsiques (untar, decorar, muntar)'), act('Decoració creativa i personalitzada de la mona')],
        [act('Establiment i desenvolupament de la relació padrins–fillols mitjançant accions de suport, acompanyament i ajuda durant l’elaboració i la compartició de la mona'), act('Participació en dinàmiques de grup del cicle: cooperació i implicació (matí)'), act('Participació en activitats compartides de centre (rotllanes, berenar, espais comuns) (tarda)')],
      ],
      'Cicle Inicial': [
        [act('Elaboració de la mona seguint consignes bàsiques (untar, decorar, muntar)'), act('Decoració creativa i personalitzada de la mona')],
        [act('Participació en dinàmiques de grup del cicle: cooperació i implicació (matí)'), act("Queda l'espai en ordre"), act('Participació en activitats compartides de centre (rotllanes, berenar, espais comuns) (tarda)')],
      ],
    },
  },
  santjordi: {
    activitat: 'Festa de Sant Jordi',
    objectiusText: [
      { text: 'Fomentar la cohesió entre tots els nens i nenes de l’escola i millorar el sentit de pertinença i autoestima de la comunitat escolar.', pes: 30 },
      { text: 'Arrelar culturalment l’alumnat. Donar a conèixer la tradició de la festa de Sant Jordi.', pes: 30 },
      { text: "Preparar l'espectacle de dansa de Sant Jordi / Projecte de 6è.", pes: 40 },
    ],
    activitatsPerGrup: {
      'Educació Infantil': [
        [act('Visita de les paradetes de Sant Jordi'), act('Acta de lliurament de premis de Sant Jordi'), act('Ball de les dances de Sant Jordi')],
        [act("Treball a l'aula (elaboració de textos)"), act("Visita a l'exposició literària"), act('Ambientació (vestíbul, passadís...) amb motiu de la Diada')],
        [act('Ball de la Sardana'), act("Preparació dansa per l'espectacle"), act('Feedback dels alumnes')],
      ],
      'Cicle Inicial': [
        [act('Visita de les paradetes de Sant Jordi'), act('Acta de lliurament de premis de Sant Jordi'), act('Ball de la sardana a la pista')],
        [act("Treball a l'aula (elaboració de textos)"), act("Visita a l'exposició literària"), act('Ambientació (vestíbul, passadís...) amb motiu de la Diada')],
        [act('Ball de la Sardana'), act("Preparació dansa per l'espectacle"), act('Feedback dels alumnes')],
      ],
    },
  },
  gimcana: {
    activitat: 'Festa de Gimcana i comiat final de curs',
    objectiusText: [
      { text: 'Fomentar la cohesió entre tots els nens i nenes de l’escola i millorar el sentit de pertinença i autoestima de la comunitat escolar.', pes: 30 },
      { text: 'Organitzar el comiat dels alumnes de 6è.', pes: 30 },
      { text: "Organitzar la gimcana d'educació infantil i primària.", pes: 40 },
    ],
    activitatsPerGrup: {
      'Educació Infantil': [
        [act('Padrins i fillols (Gimcana)'), act('Acte de comiat'), act('Activitats últim dia')],
        [act('Ball de 6è'), act('Acte de lliurament dels diplomes i birrets'), act('Cançó de comiat')],
        [act('Grau de satisfacció del funcionament de la gimcana'), act('Grau de satisfacció del recull informatiu'), act('Feedback dels alumnes')],
      ],
      'Cicle Inicial': [
        [act('Acte de comiat'), act('Activitats últim dia (esmorzar)')],
        [act('Actuació de 6è'), act('Acte de lliurament dels diplomes i birrets'), act('Cançó de comiat')],
        [act('Grau de satisfacció del funcionament de la gimcana'), act('Grau de satisfacció del recull informatiu'), act('Feedback dels alumnes')],
      ],
    },
  },
}

/** Converteix les dades de plantilla d'una festa (text pla) en l'estructura
 *  real que fa servir l'app (amb ids i comentaris buits), llesta per
 *  editar. Els grups sense text real (Cicle Mitjà, Cicle Superior, Equip
 *  Directiu) es deixen buits — el mestre hi pot afegir activitats igual. */
export function construeixFestaAmbPlantilla(plantilla) {
  const objectius = plantilla.objectiusText.map((o) => objectiuFestaBuit(o.pes))
  objectius.forEach((o, i) => { o.text = plantilla.objectiusText[i].text })

  const grups = {}
  for (const g of GRUPS) {
    grups[g] = {}
    objectius.forEach((o, oi) => {
      const activitatsText = plantilla.activitatsPerGrup[g]?.[oi] ?? []
      grups[g][o.id] = {
        activitats: activitatsText.map((a) => ({ id: crypto.randomUUID(), text: a.text, grau: '' })),
        comentaris: '',
      }
    })
  }

  return {
    activitat: plantilla.activitat,
    data: '',
    objectius,
    pesCicles: 80,
    pesEquipDirectiu: 20,
    grups,
  }
}

import { senseAccents } from './text'
// Índex de coses que es poden buscar des de l'Inici.
//
// Els mòduls surten sols del menú, però dins de cada mòdul hi ha pestanyes
// i eines que no es veuen des de fora: qui busca "festes" o "ajuts menjador"
// no sap que ha d'entrar a Valoracions o a Alumnes. Aquesta llista fa de
// pont entre el que la gent té al cap i on és a l'app.
//
// Per afegir-hi coses noves: `modul` ha de ser un id del registre de
// mòduls (Dashboard.jsx), i a `paraules` s'hi posen els sinònims i els
// termes que algú escriuria realment a la caixa de cerca.

export const DESTINACIONS = [
  // ── Avaluació ──────────────────────────────────────────────────────
  { modul: 'avaluacio', nom: 'Text escrit (TEE)', on: 'Avaluació',
    paraules: ['tee', 'text escrit', 'expressió escrita', 'redacció', 'ortografia', 'rúbrica'] },
  { modul: 'avaluacio', nom: 'Lectura: velocitat i comprensió', on: 'Avaluació',
    paraules: ['lectura', 'velocitat lectora', 'vl', 'comprensió lectora', 'cl', 'paraules per minut'] },
  { modul: 'avaluacio', nom: 'Matemàtiques (ConMat i COSMOS)', on: 'Avaluació',
    paraules: ['matemàtiques', 'conmat', 'cosmos', 'innovamat', 'càlcul', 'numeració'] },
  { modul: 'avaluacio', nom: "Nota d'àrea de Català", on: 'Avaluació',
    paraules: ['nota àrea', 'català', 'llengua catalana', 'qualificació'] },
  { modul: 'avaluacio', nom: 'Notes generals', on: 'Avaluació',
    paraules: ['notes', 'qualificacions', 'butlletí', 'àrees'] },
  { modul: 'avaluacio', nom: "Informe de l'alumne", on: 'Avaluació',
    // "informe per alumne" es manté a les paraules: era el nom d'abans i
    // hi haurà qui el continuï buscant així una temporada.
    paraules: ['informe', 'informe per alumne', 'informe qualitatiu', 'redactat', 'acta', 'comentari'] },
  { modul: 'avaluacio', nom: 'Resum COSMOS (1r i 2n)', on: 'Avaluació',
    paraules: ['resum cosmos', 'cosmos', 'innovamat', 'rendiment', 'primer', 'segon', 'cicle inicial'] },
  { modul: 'avaluacio', nom: 'Resum ConMat (3r a 6è)', on: 'Avaluació',
    paraules: ['resum conmat', 'conmat', 'innovamat', 'nivells', 'franges'] },
  { modul: 'avaluacio', nom: 'Resum de resultats', on: 'Avaluació',
    paraules: ['resum', 'resultats', 'estadístiques'] },

  // ── Valoracions ────────────────────────────────────────────────────
  { modul: 'documentacio', nom: 'Valoració de cicles', on: 'Valoracions',
    paraules: ['cicle', 'cicles', 'infantil', 'inicial', 'mitjà', 'superior', 'objectius de cicle'] },
  { modul: 'documentacio', nom: 'Comissions i equips', on: 'Valoracions',
    paraules: ['comissió', 'comissions', 'equip', 'tac', 'biblioteca', 'anglès', 'material',
      'espais', 'diversitat', 'riscos laborals', 'lic', 'equip directiu'] },
  { modul: 'documentacio', nom: 'Comissions mixtes', on: 'Valoracions',
    paraules: ['afa', 'famílies', 'comunicació', 'migdia', 'menjador', 'patis', 'arep', 'jardins'] },
  { modul: 'documentacio', nom: 'Festes i celebracions', on: 'Valoracions',
    paraules: ['festa', 'festes', 'castanyada', 'nadal', 'carnestoltes', 'mona', 'sant jordi', 'gimcana'] },
  { modul: 'documentacio', nom: 'Activitats complementàries', on: 'Valoracions',
    paraules: ['sortides', 'activitats complementàries', 'excursions', 'colònies'] },
  { modul: 'documentacio', nom: 'Aprenentatge cooperatiu', on: 'Valoracions',
    paraules: ['cooperatiu', 'aprenentatge cooperatiu', 'treball en equip', 'projectes de classe'] },

  // ── Alumnes ────────────────────────────────────────────────────────
  { modul: 'alumnes', nom: "Importar la llista d'alumnes", on: 'Alumnes',
    paraules: ['importar alumnes', 'esfera', 'llista', 'matrícula', 'altes'] },
  { modul: 'alumnes', nom: 'Ajuts de menjador', on: 'Alumnes',
    paraules: ['ajuts', 'ajut menjador', 'beques', 'nese'] },
  { modul: 'alumnes', nom: 'Zona perillosa: esborrar dades de proves', on: 'Alumnes',
    paraules: ['esborrar', 'netejar', 'dades de proves', 'zona perillosa'] },

  // ── La resta ───────────────────────────────────────────────────────
  { modul: 'assistencia', nom: "Passar llista", on: 'Assistència',
    paraules: ['assistència', 'passar llista', 'faltes', 'retards', 'absències'] },
  { modul: 'absentisme', nom: "Índex d'absències i avisos", on: 'Absentisme',
    paraules: ['absentisme', 'índex absències', '10%', '25%', 'avisos', 'famílies'] },
  { modul: 'economia', nom: 'Quotes i pressupost', on: 'Economia',
    paraules: ['economia', 'quotes', 'pressupost', 'preus', 'material', 'socialització', 'ceb'] },
  { modul: 'calendari', nom: 'Calendari i dies lectius', on: 'Calendari',
    paraules: ['calendari', 'dies lectius', 'trimestres', 'festius', 'vacances'] },
  { modul: 'pgac', nom: 'Objectius i indicadors del PGAC', on: 'PGAC',
    paraules: ['pgac', 'pga', 'objectius estratègics', 'operatius', 'indicadors', 'projecte de direcció'] },
  { modul: 'sic', nom: 'Indicadors de centre (SIC)', on: 'SIC',
    paraules: ['sic', 'indicadors de centre', 'sistema d\'indicadors', 'escolarització', 'complexitat',
      'mobilitat', 'ràtio', 'nese', 'memòria anual', 'context', 'recursos'] },
  { modul: 'matriu', nom: 'Quadre de comandament', on: 'Quadre de comandament',
    paraules: ['quadre de comandament', 'matriu general', 'visió global', 'plantilles'] },
  { modul: 'backup', nom: 'Còpia de seguretat completa', on: 'Backup',
    paraules: ['backup', 'còpia de seguretat', 'exportar tot', 'zip'] },
  { modul: 'comprovacions', nom: 'Comprovacions dels càlculs', on: 'Comprovacions',
    paraules: ['comprovacions', 'proves', 'tests', 'verificar càlculs'] },
]

/** Treu accents i majúscules per poder comparar sense manies. */
function normalitza(text) {
  return senseAccents(text).toLowerCase().trim()
}

/**
 * Busca dins dels mòduls visibles i de l'índex de destinacions.
 *
 * @param {string} consulta
 * @param {Array} moduls  els mòduls que aquest usuari pot veure
 * @returns {Array<{id, titol, subtitol, modul}>}
 */
export function cerca(consulta, moduls = []) {
  const q = normalitza(consulta)
  if (q.length < 2) return []

  // Es busca paraula a paraula i totes hi han de ser: així "ajuts menjador"
  // troba una entrada que té "ajuts" en una paraula clau i "menjador" en una
  // altra. Buscant la frase sencera no trobaria res.
  const mots = q.split(/\s+/).filter(Boolean)
  const conte = (paller) => {
    const net = normalitza(paller)
    return mots.every((m) => net.includes(m))
  }

  const permesos = new Set(moduls.map((m) => m.id))
  const resultats = []

  // Primer els mòduls, que és el que la gent busca més sovint.
  for (const m of moduls) {
    if (conte(m.label)) {
      resultats.push({ id: `modul-${m.id}`, titol: m.label, subtitol: 'Mòdul', modul: m.id })
    }
  }

  for (const d of DESTINACIONS) {
    if (!permesos.has(d.modul)) continue
    if (!conte(`${d.nom} ${d.on} ${d.paraules.join(' ')}`)) continue
    // Si ja hi surt com a mòdul, no el repetim.
    if (resultats.some((r) => r.id === `modul-${d.modul}` && normalitza(r.titol) === normalitza(d.nom))) continue
    resultats.push({ id: `${d.modul}-${d.nom}`, titol: d.nom, subtitol: d.on, modul: d.modul })
  }

  return resultats.slice(0, 12)
}

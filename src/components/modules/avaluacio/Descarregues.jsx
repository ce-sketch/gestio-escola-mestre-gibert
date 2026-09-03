// "Descàrregues" — un únic lloc per baixar-ho tot de cop: les notes de
// totes les classes, el resum global per àrea (els quatre moments) i les
// àrees no superades, en un sol Excel (un full per bloc) o un sol PDF.
//
// Abans això vivia escampat: "totes les classes" era un botó dins de
// l'entrada de notes (una pantalla d'introduir dades, no de generar
// informes), i el resum global i les àrees no superades cadascun amb el
// seu propi botó a la seva pestanya. Aquesta pestanya no substitueix
// aquells botons — hi continuen sent, per baixar només un bloc concret —
// és el lloc per quan es vol tot alhora.
//
// Abast: ho inclou TOT el que es resumeix del curs — les notes per àrea,
// els resums de TEE i VL/CL, la lectoescriptura d'Infantil i les proves
// d'Innovamat (COSMOS i ConMat). Cada pestanya conserva el seu botó per
// baixar només el seu bloc; aquesta és per quan es vol el document
// sencer, típicament per a la memòria del centre.
//
// Els fulls es construeixen amb les MATEIXES funcions que pinten cada
// pantalla (resumProvesTaules, lectoescripturaEI, innovamatExport): si es
// recalculessin aquí, un canvi de criteri en una pantalla deixaria
// l'exportació dient una altra cosa sense que ningú se n'adonés.

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, areaAplicaAClasse, notaFinalArea, notaFinalAmbCorreccio } from '../../../lib/notesArea'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { taulesNotesClasse } from '../../../lib/notesTaules'
import { useNotesAreaDades } from './useNotesAreaDades'
import { fullsTee, fullsLectura } from '../../../lib/resumProvesTaules'
import { esClasseEI4o5, comptaNivells, fullResumEI } from '../../../lib/lectoescripturaEI'
import { classesActives } from '../../../lib/provesActives'
import { slug } from '../../../lib/slug'
import {
  entradesHistoric, distribucioPerNivell, entradesCosmos, distribucioCosmos,
  NIVELLS_COSMOS, MOMENTS_COSMOS, MOMENTS,
} from '../../../lib/historicInnovamat'
import { NIVELLS_CONMAT } from '../../../lib/conmatParser'
import { fullResumCurs } from '../../../lib/innovamatExport'

const NIVELLS_CM = NIVELLS_CONMAT.map((n) => n.label)

const NIVELLS_RESUM = [
  { id: 'no_assoliment', label: 'No Assoliment' },
  { id: 'assoliment_satisfactori', label: 'Assoliment Satisfactòri' },
  { id: 'assoliment_notable', label: 'Assoliment Notable' },
  { id: "assoliment_excel·lent", label: "Assoliment Excel·lent" },
]
const MOMENTS_RESUM = [...TRIMESTRES, 'Final']

export default function Descarregues() {
  const { alumnesTots, registres, carregant, missatge } = useNotesAreaDades()
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [generant, setGenerant] = useState(null) // 'excel' | 'pdf' | null
  const [missatgeDescarrega, setMissatgeDescarrega] = useState(null)

  // Les altres proves viuen a col·leccions diferents de les notes per
  // àrea, i el hook de dades només carrega aquelles. Es carreguen aquí
  // perquè el document complet les pugui incloure.
  const [teeRegistres, setTeeRegistres] = useState([])
  const [lecturaRegistres, setLecturaRegistres] = useState([])
  const [docsEI, setDocsEI] = useState([])
  const [configProves, setConfigProves] = useState(null)
  const [registresMates, setRegistresMates] = useState([])
  const [errorExtra, setErrorExtra] = useState(null)

  useEffect(() => {
    let viu = true
    async function carregaExtra() {
      try {
        const [snapAval, snapEI, snapMates, snapConfig] = await Promise.all([
          getDocs(query(collection(db, 'avaluacio'), where('cursEscolar', '==', cursEscolarId))),
          getDocs(query(collection(db, 'lectoescripturaEI'), where('cursEscolar', '==', cursEscolarId))),
          getDocs(query(collection(db, 'matematiques'), where('cursEscolar', '==', cursEscolarId))),
          getDoc(doc(db, 'provesActives', cursEscolarId)),
        ])
        if (!viu) return
        const totes = snapAval.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTeeRegistres(totes.filter((r) => r.tipus === 'tee'))
        setLecturaRegistres(totes.filter((r) => r.tipus === 'lectura'))
        setDocsEI(snapEI.docs.map((d) => ({ id: d.id, ...d.data() })))
        setRegistresMates(snapMates.docs.map((d) => ({ id: d.id, ...d.data() })))
        setConfigProves(snapConfig.exists() ? snapConfig.data() : null)
      } catch (err) {
        // No atura la resta: si falla una prova, el document es genera
        // igualment amb el que sí que s'hagi pogut llegir.
        if (viu) setErrorExtra(err.message)
      }
    }
    carregaExtra()
    return () => { viu = false }
  }, [cursEscolarId])

  const vigentsTotes = useMemo(
    () => redueixVigents(
      registres.filter((r) => (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => `${r.alumneId}__${r.area}__${r.trimestre}`
    ),
    [registres, cursEscolarId]
  )

  function notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, trim) {
    const existent = vigentsTotes.find((r) => r.curs === classeAlumne && r.alumneId === alumneId && r.area === areaId && r.trimestre === trim)
    return existent?.nota ?? ''
  }

  function notaFinalAlumneAreaDe(classeAlumne, alumneId, areaId) {
    return notaFinalAmbCorreccio((t) => notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, t))
  }

  const totesLesClasses = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )

  if (carregant) return <p>Carregant…</p>

  /** Un full per classe amb les notes tal com surten a "Entrada de notes"
   *  (1r/2n/3r/Final per àrea) — el que abans era el botó "totes les
   *  classes" de dins de l'entrada. */
  function taulaTotesLesClassesExportable() {
    return totesLesClasses.map((cl) => {
      const areesCl = AREES.filter((a) => areaAplicaAClasse(a.id, cl))
      const alumnesCl = alumnesTots.filter((a) => a.curs === cl)
      const capçalera = ['Núm.', 'Alumne', ...areesCl.flatMap(() => ['1r', '2n', '3r', 'Final'])]
      const grups = areesCl.map((a) => ({ label: a.label, span: 4 }))
      const files = alumnesCl.map((alumne) => [
        alumne.numLlista ?? '',
        alumne.nom,
        ...areesCl.flatMap((a) => [
          ...TRIMESTRES.map((t) => (a.calculada ? '' : notaAlumneTrimestreDe(cl, alumne.id, a.id, t))),
          (a.calculada
            ? notaFinalArea(a.deArees.map((id) => notaFinalAlumneAreaDe(cl, alumne.id, id)))
            : notaFinalAlumneAreaDe(cl, alumne.id, a.id)) ?? '',
        ]),
      ])
      return { nom: `Notes ${cl}`, files: [capçalera, ...files], grups }
    })
  }

  /** Un full per àrea amb el resum global, els quatre moments junts —
   *  el mateix que "Resum per àrea" amb l'agrupació per classe i el
   *  selector de moment a "Totes". */
  function taulesResumGlobalExportables() {
    return AREES.filter((a) => !a.calculada).map((a) => {
      const files = totesLesClasses.map((cl) => {
        const perMoment = Object.fromEntries(MOMENTS_RESUM.map((m) => {
          const comptes = Object.fromEntries(NIVELLS_RESUM.map((n) => [n.id, 0]))
          let avaluats = 0
          if (m === 'Final') {
            for (const alumne of alumnesTots) {
              if (alumne.curs !== cl) continue
              const final = notaFinalAlumneAreaDe(cl, alumne.id, a.id)
              if (final === null) continue
              const nivell = nivellDe(final)
              if (nivell) comptes[nivell.id] += 1
              avaluats += 1
            }
          } else {
            const notes = vigentsTotes.filter((r) => r.area === a.id && r.trimestre === m && r.curs === cl)
            for (const r of notes) {
              const nivell = nivellDe(r.nota)
              if (nivell) comptes[nivell.id] += 1
            }
            avaluats = notes.length
          }
          return [m, { comptes, avaluats }]
        }))
        return { etiqueta: cl, perMoment }
      })
      const total = Object.fromEntries(MOMENTS_RESUM.map((m) => [m, { comptes: Object.fromEntries(NIVELLS_RESUM.map((n) => [n.id, 0])), avaluats: 0 }]))
      files.forEach((f) => {
        for (const m of MOMENTS_RESUM) {
          for (const n of NIVELLS_RESUM) total[m].comptes[n.id] += f.perMoment[m].comptes[n.id]
          total[m].avaluats += f.perMoment[m].avaluats
        }
      })

      const capçaleraSup = ['', ...MOMENTS_RESUM.flatMap((m) => [m, '', '', '', ''])]
      const capçaleraInf = ['Classe', ...MOMENTS_RESUM.flatMap(() => [...NIVELLS_RESUM.map((n) => n.label), 'Avaluats'])]
      return {
        nom: `Resum ${a.label}`,
        files: [
          capçaleraSup,
          capçaleraInf,
          ...files.map((f) => [f.etiqueta, ...MOMENTS_RESUM.flatMap((m) => [...NIVELLS_RESUM.map((n) => f.perMoment[m].comptes[n.id]), f.perMoment[m].avaluats])]),
          ['TOTAL', ...MOMENTS_RESUM.flatMap((m) => [...NIVELLS_RESUM.map((n) => total[m].comptes[n.id]), total[m].avaluats])],
        ],
      }
    }).filter((full) => full.files.slice(2, -1).some((fila) => fila.slice(1).some((v) => Number(v) > 0)))
  }

  /** El full "Àrees no superades", igual que la seva pestanya pròpia. */
  function taulaAreesNoSuperadesExportable() {
    const areesNoCalculades = AREES.filter((a) => !a.calculada)
    const files = totesLesClasses.map((cl) => {
      const alumnesCl = alumnesTots.filter((a) => a.curs === cl)
      const comptes = {}
      for (const a of areesNoCalculades) {
        comptes[a.id] = alumnesCl.filter((alumne) => {
          const final = notaFinalAlumneAreaDe(cl, alumne.id, a.id)
          return final !== null && nivellDe(final)?.id === 'no_assoliment'
        }).length
      }
      return { classe: cl, comptes, totalAlumnes: alumnesCl.length }
    })
    const total = { comptes: {}, totalAlumnes: 0 }
    for (const a of areesNoCalculades) total.comptes[a.id] = 0
    files.forEach((f) => {
      for (const a of areesNoCalculades) total.comptes[a.id] += f.comptes[a.id]
      total.totalAlumnes += f.totalAlumnes
    })
    return [{
      nom: 'Àrees no superades',
      files: [
        ['Classe', ...areesNoCalculades.map((a) => a.label), 'Total alumnes'],
        ...files.map((f) => [f.classe, ...areesNoCalculades.map((a) => f.comptes[a.id]), f.totalAlumnes]),
        ['TOTAL', ...areesNoCalculades.map((a) => total.comptes[a.id]), total.totalAlumnes],
      ],
    }]
  }

  /** Els resums de TEE i de lectura, els tres trimestres del TEE inclosos.
   *  Les seves pantalles en mostren un de sol perquè hi ha un selector;
   *  al document complet hi han de sortir tots. */
  function fullsProves() {
    const cursos = totesLesClasses.filter((c) => grauPrimaria(c))
    const opcions = { cursos, cursEscolarId }
    return [
      ...TRIMESTRES.flatMap((trimestre) => fullsTee(teeRegistres, { ...opcions, trimestre })),
      ...fullsLectura(lecturaRegistres, opcions),
    ]
  }

  /** El resum de lectoescriptura d'Infantil, una fila per classe. */
  function fullsLectoescriptura() {
    // Només les que passen la prova: si no, el document lliurat inclouria
    // classes a zero que en realitat no la fan, i semblaria que hi
    // falten dades.
    const classes = classesActives(
      configProves, 'lectoescriptura', 'curs',
      [...new Set(alumnesTots.map((a) => a.curs))].filter(esClasseEI4o5).sort()
    )
    if (classes.length === 0) return []
    const perClasse = classes.map((classe) => {
      const ids = alumnesTots.filter((a) => a.curs === classe).map((a) => a.id)
      const doc = docsEI.find((d) => d.id === `${cursEscolarId}__${slug(classe)}`)
      return { classe, total: ids.length, comptes: comptaNivells(ids, doc?.alumnes ?? {}) }
    })
    return [fullResumEI(perClasse)]
  }

  /** Els resums d'Innovamat: COSMOS (1r i 2n) i ConMat (3r a 6è), amb un
   *  full per moment. Per ordre de nivell, com a la resta de l'app. */
  function fullsInnovamatResums() {
    const fulls = []

    const cosmos = entradesCosmos(registresMates)
    for (const moment of MOMENTS_COSMOS) {
      const dels = cosmos.filter((e) => e[moment.id] != null || e.noAvaluat)
      if (dels.length === 0) continue
      fulls.push(fullResumCurs(dels, {
        prova: 'COSMOS', nivells: NIVELLS_COSMOS,
        distribucio: (llista) => distribucioCosmos(llista, moment.id),
        moment: moment.label, curs: cursEscolarId,
      }))
    }

    const conmat = entradesHistoric(registresMates)
    for (const moment of MOMENTS) {
      const dels = conmat.filter((e) => e.moment === moment.id)
      if (dels.length === 0) continue
      fulls.push(fullResumCurs(dels, {
        prova: 'ConMat', nivells: NIVELLS_CM,
        distribucio: distribucioPerNivell,
        moment: moment.label, curs: cursEscolarId,
      }))
    }

    return fulls
  }

  /** Tots els resums del curs, en el mateix ordre que les pestanyes:
   *  primer Infantil, després les proves de llengua, després Innovamat i
   *  al final les notes per àrea. */
  function totsElsFulls() {
    return [
      ...fullsLectoescriptura(),
      ...fullsProves(),
      ...fullsInnovamatResums(),
      ...taulaTotesLesClassesExportable(),
      ...taulesResumGlobalExportables(),
      ...taulaAreesNoSuperadesExportable(),
    ]
  }

  /**
   * La versió per imprimir: per cada classe, una taula per moment amb una
   * sola columna per àrea. L'Excel es queda amb el detall complet (4
   * columnes per àrea), que és un document de treball i té desplaçament
   * lateral; el PDF s'ha de poder llegir en paper.
   */
  function totsElsFullsPerImprimir() {
    return [
      ...fullsLectoescriptura(),
      ...fullsProves(),
      ...fullsInnovamatResums(),
      ...totesLesClasses.flatMap((cl) => taulesNotesClasse(
        cl,
        alumnesTots.filter((a) => a.curs === cl),
        (alumneId, areaId, trim) => notaAlumneTrimestreDe(cl, alumneId, areaId, trim)
      )),
      ...taulesResumGlobalExportables(),
      ...taulaAreesNoSuperadesExportable(),
    ]
  }

  async function descarrega(quin, fes) {
    setGenerant(quin)
    setMissatgeDescarrega(null)
    try {
      await fes()
    } catch (err) {
      setMissatgeDescarrega({ type: 'error', text: `No s'ha pogut generar la descàrrega: ${err.message}` })
    } finally {
      setGenerant(null)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Tot el que hi ha a &quot;Notes per àrea&quot; en un sol lloc: les notes de totes les
        classes, el resum global per àrea i les àrees no superades. Cada pestanya té també el
        seu propi botó, per baixar només un bloc.
      </p>

      <label className="field" style={{ minWidth: 120, marginTop: 20 }}>
        <span>Curs escolar</span>
        <input
          type="text"
          value={cursEscolarId}
          onChange={(e) => setCursEscolarId(e.target.value)}
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontWeight: 600 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          style={{ maxWidth: 280 }}
          onClick={() => descarrega('excel', () => exportaExcel(`Avaluacio-complet-${cursEscolarId}`, { cursEscolarId, fulls: totsElsFulls(), etiqueta: 'Avaluació' }))}
          disabled={generant !== null}
          type="button"
        >
          {generant === 'excel' ? 'Generant…' : '📥 Descarrega-ho tot en Excel'}
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 280 }}
          onClick={() => descarrega('pdf', () => exportaPDF('Notes per àrea', {
            cursEscolarId,
            fulls: totsElsFullsPerImprimir(),
            etiqueta: 'Avaluació',
            subtitol: 'Annex de la Memòria Anual de centre',
          }))}
          disabled={generant !== null}
          type="button"
        >
          {generant === 'pdf' ? 'Generant…' : '📄 Descarrega-ho tot en PDF'}
        </button>
      </div>

      {missatgeDescarrega && (
        <p style={{ marginTop: 8, fontSize: 13, color: missatgeDescarrega.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatgeDescarrega.text}
        </p>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 16 }}>
        Inclou tot el que es resumeix del curs: la lectoescriptura d&apos;Infantil, els resums de
        TEE (els tres trimestres) i de CL i VL, els d&apos;Innovamat (COSMOS i ConMat, per moment),
        un full per classe amb les seves notes, un full per àrea amb el resum global dels quatre
        moments, i el full d&apos;àrees no superades. Els blocs que no tinguin dades no hi surten.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          {missatge.text}
        </p>
      )}

      {errorExtra && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          No s&apos;han pogut carregar algunes proves ({errorExtra}). El document es generarà
          igualment, però potser hi faltaran fulls.
        </p>
      )}
    </div>
  )
}

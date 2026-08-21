// "Històric" — l'evolució del centre a les proves internes, curs rere curs.
//
// Ajunta dues coses que fins ara vivien separades:
//   · el PASSAT, que ve de les pestanyes "Resultats TEE" i "Resultats VLCL"
//     de l'Eina d'avaluació (fitxer `historicProves.js`, intocable);
//   · el CURS EN MARXA, que es calcula sol a partir del que hi ha desat a
//     Firestore i s'enganxa al capdamunt de la sèrie.
//
// Així no cal copiar res a mà cada any: el curs actual hi surt sempre al
// dia, i quan s'acaba i ja no canviarà, es congela a `historicProves.js`.

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { esAdmin } from '../../../lib/roles'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { redueixVigents } from '../../../lib/avaluacioCatala'
import { aEscalaComuna } from '../../../lib/rubricaTEE'
import { clAEscalaComuna, vlAEscalaComuna, grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import {
  NIVELLS_HISTORIC, percentatges, avisosHistoric, ordenaPerCurs, cursCurtDe,
} from '../../../lib/historicProves'

// L'escala comuna de l'app fa servir uns identificadors llargs; l'històric,
// els curts del full. Aquesta és la correspondència entre les dues.
const COMU_A_HISTORIC = {
  no_assoliment: 'na',
  assoliment_satisfactori: 'asat',
  assoliment_notable: 'anot',
  'assoliment_excel·lent': 'aexc',
}

/** Una cel·la amb el recompte gran i el percentatge petit a sota. */
function Cel·la({ n, pct }) {
  if (n === null || n === undefined) return <td style={{ padding: '5px 10px', textAlign: 'center', color: 'var(--ink-soft)' }}>—</td>
  return (
    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
      <strong>{n}</strong>
      {pct !== null && pct !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}> ({pct}%)</span>
      )}
    </td>
  )
}

function TaulaHistoric({ titol, files, nota }) {
  if (files.length === 0) return null
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', margin: '0 0 2px' }}>{titol}</p>
      {nota && <p className="nota" style={{ marginTop: 0 }}>{nota}</p>}
      <div className="taula-scroll" style={{ marginTop: 6 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '5px 10px', textAlign: 'left' }}>Curs</th>
              {NIVELLS_HISTORIC.map((n) => (
                <th key={n.id} style={{ padding: '5px 10px' }} title={n.label}>{n.label}</th>
              ))}
              <th style={{ padding: '5px 10px' }}>Avaluats</th>
              <th style={{ padding: '5px 10px', textAlign: 'left' }}>Nivells</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f, i) => {
              const pct = percentatges(f.dades, f.dades.total)
              return (
                <tr key={i} style={{
                  borderBottom: '1px solid var(--line)',
                  background: f.esActual ? 'var(--sand)' : undefined,
                  fontWeight: f.esActual ? 600 : 400,
                }}>
                  <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                    {f.curs}{f.esActual && <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}> · en curs</span>}
                  </td>
                  {NIVELLS_HISTORIC.map((n) => (
                    <Cel·la key={n.id} n={f.dades[n.id]} pct={pct[n.id]} />
                  ))}
                  <td style={{ padding: '5px 10px', textAlign: 'center' }}>{f.dades.total ?? '—'}</td>
                  <td style={{ padding: '5px 10px', fontSize: 10, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{f.cursos}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Historic() {
  // Restringit a direcció: l'històric és el registre del centre sencer,
  // curs rere curs, i no forma part del que necessita el professorat per
  // fer la seva feina. La pestanya ja no surt al menú si no ets admin;
  // això és la segona barrera, per si s'hi arriba per una altra via.
  const potVeure = esAdmin(auth.currentUser)

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [teeRegistres, setTeeRegistres] = useState([])
  const [lecturaRegistres, setLecturaRegistres] = useState([])
  // L'històric ve de Firestore (col·lecció `historicProves`), no del codi.
  const [historicTee, setHistoricTee] = useState([])
  const [historicVlcl, setHistoricVlcl] = useState([])
  const [importat, setImportat] = useState(false)
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)
  const [generant, setGenerant] = useState(null)

  useEffect(() => {
    if (!potVeure) { setCarregant(false); return }
    async function carrega() {
      setCarregant(true)
      try {
        const [snapAvaluacio, docTee, docVlcl] = await Promise.all([
          getDocs(query(collection(db, 'avaluacio'), where('cursEscolar', '==', cursEscolarId))),
          getDoc(doc(db, 'historicProves', 'tee')),
          getDoc(doc(db, 'historicProves', 'vlcl')),
        ])
        setHistoricTee(docTee.exists() ? (docTee.data().registres ?? []) : [])
        setHistoricVlcl(docVlcl.exists() ? (docVlcl.data().registres ?? []) : [])
        const totes = snapAvaluacio.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTeeRegistres(totes.filter((r) => r.tipus === 'tee'))
        setLecturaRegistres(totes.filter((r) => r.tipus === 'lectura'))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades del curs actual: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [cursEscolarId, potVeure, importat])

  const cursCurt = cursCurtDe(cursEscolarId)

  /** Quins nivells de primària tenen alguna dada, per posar-ho a la
   *  columna "Nivells" igual que al full ("2-3-4-5-6"). */
  function etiquetaNivells(registres) {
    const graus = [...new Set(registres.map((r) => grauPrimaria(r.curs)).filter((g) => g !== null))]
    return graus.sort((a, b) => a - b).join('-')
  }

  /** El TEE del curs actual, comptat com al full: un registre per alumne i
   *  trimestre (el més recent de cada un), passat a l'escala comuna. */
  const teeActual = useMemo(() => {
    return ['1r', '3r'].map((trim) => {
      const etiqueta = `${trim} trimestre`
      const delTrimestre = teeRegistres.filter((r) => r.trimestre === etiqueta)
      const vigents = redueixVigents(delTrimestre, (r) => `${r.alumneId}-${r.trimestre}`)
      const dades = Object.fromEntries(NIVELLS_HISTORIC.map((n) => [n.id, 0]))
      for (const r of vigents) {
        const clau = COMU_A_HISTORIC[aEscalaComuna(r.global)]
        if (clau) dades[clau] += 1
      }
      const total = NIVELLS_HISTORIC.reduce((t, n) => t + dades[n.id], 0)
      return { trimestre: trim, curs: cursCurt, cursos: etiquetaNivells(vigents), esActual: true, dades: { ...dades, total } }
    }).filter((f) => f.dades.total > 0)
  }, [teeRegistres, cursCurt])

  /** VL i CL del curs actual. Els moments del full són l'Avaluació
   *  Inicial (1r trimestre) i la Final (3r trimestre). */
  const vlclActual = useMemo(() => {
    const perMoment = [{ moment: 'inicial', trim: '1r' }, { moment: 'final', trim: '3r' }]
    return perMoment.map(({ moment, trim }) => {
      const vigents = redueixVigents(
        lecturaRegistres.filter((r) => r.moment === moment),
        (r) => `${r.alumneId}-${moment}`
      )
      // Les mateixes conversions que fa servir "Resums de proves": la VL
      // es compara amb el propi curs de l'alumne, i la CL té la seva
      // pròpia escala (BAIX/M.BAIX/M.ALT/ALT).
      const compta = (comuDe) => {
        const dades = Object.fromEntries(NIVELLS_HISTORIC.map((n) => [n.id, 0]))
        let total = 0
        for (const r of vigents) {
          const clau = COMU_A_HISTORIC[comuDe(r)]
          if (clau) { dades[clau] += 1; total += 1 }
        }
        return { ...dades, total }
      }
      const vl = compta((r) => (r.vl === null || r.vl === undefined
        ? null
        : vlAEscalaComuna(r.vl, r.nivellVl, r.curs)))
      const cl = compta((r) => (r.nivellCl ? clAEscalaComuna(r.nivellCl) : null))
      return { trimestre: trim, curs: cursCurt, cursos: etiquetaNivells(vigents), esActual: true, vl, cl }
    }).filter((f) => f.vl.total > 0 || f.cl.total > 0)
  }, [lecturaRegistres, cursCurt])

  /** Passat + present, per prova i trimestre. */
  function serieTee(trim) {
    const passat = ordenaPerCurs(historicTee.filter((r) => r.trimestre === trim))
      .map((r) => ({ curs: r.curs, cursos: r.cursos, dades: r, esActual: false }))
    return [...teeActual.filter((f) => f.trimestre === trim), ...passat]
  }
  function serieVlcl(trim, prova) {
    const passat = ordenaPerCurs(historicVlcl.filter((r) => r.trimestre === trim))
      .map((r) => ({ curs: r.curs, cursos: r.cursos, dades: r[prova], esActual: false }))
    return [
      ...vlclActual.filter((f) => f.trimestre === trim).map((f) => ({ ...f, dades: f[prova] })),
      ...passat,
    ]
  }

  const avisos = useMemo(() => avisosHistoric({ tee: historicTee, vlcl: historicVlcl }), [historicTee, historicVlcl])

  if (!potVeure) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
        L&apos;històric de proves només és accessible des del compte de direcció.
      </p>
    )
  }

  /** Els mateixos fulls per a l'Excel i el PDF. */
  function fullsExportables() {
    const capçalera = ['Curs', ...NIVELLS_HISTORIC.map((n) => n.label), 'Avaluats', 'Nivells']
    const aFiles = (serie) => serie.map((f) => {
      const pct = percentatges(f.dades, f.dades.total)
      return [
        f.curs,
        ...NIVELLS_HISTORIC.map((n) => (f.dades[n.id] === null || f.dades[n.id] === undefined
          ? ''
          : `${f.dades[n.id]} (${pct[n.id] ?? '—'}%)`)),
        f.dades.total ?? '',
        f.cursos,
      ]
    })
    return [
      { nom: 'TEE 1r trimestre', files: [capçalera, ...aFiles(serieTee('1r'))] },
      { nom: 'TEE 3r trimestre', files: [capçalera, ...aFiles(serieTee('3r'))] },
      { nom: 'VL 1r trimestre', files: [capçalera, ...aFiles(serieVlcl('1r', 'vl'))] },
      { nom: 'CL 1r trimestre', files: [capçalera, ...aFiles(serieVlcl('1r', 'cl'))] },
      { nom: 'VL 3r trimestre', files: [capçalera, ...aFiles(serieVlcl('3r', 'vl'))] },
      { nom: 'CL 3r trimestre', files: [capçalera, ...aFiles(serieVlcl('3r', 'cl'))] },
    ].filter((f) => f.files.length > 1)
  }

  /**
   * Primera càrrega: puja el JSON de l'històric a Firestore. Es fa amb un
   * fitxer que tria l'usuari i no amb dades incrustades al codi, perquè
   * si fossin al codi tornarien a viatjar al navegador de tothom.
   */
  async function importaJson(e) {
    const fitxer = e.target.files?.[0]
    if (!fitxer) return
    setMissatge(null)
    try {
      const contingut = JSON.parse(await fitxer.text())
      const tee = contingut?.tee?.registres
      const vlcl = contingut?.vlcl?.registres
      if (!Array.isArray(tee) || !Array.isArray(vlcl)) {
        throw new Error('el fitxer no té la forma esperada (hi falta "tee.registres" o "vlcl.registres")')
      }
      await Promise.all([
        setDoc(doc(db, 'historicProves', 'tee'), { registres: tee, origen: contingut.origen ?? '', llegitEl: contingut.llegitEl ?? '' }),
        setDoc(doc(db, 'historicProves', 'vlcl'), { registres: vlcl, origen: contingut.origen ?? '', llegitEl: contingut.llegitEl ?? '' }),
      ])
      setMissatge({ type: 'ok', text: `Històric importat: ${tee.length} registres de TEE i ${vlcl.length} de VL/CL.` })
      setImportat((n) => !n)
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut importar l'històric: ${err.message}` })
    }
  }

  async function descarrega(quin, fes) {
    setGenerant(quin)
    try {
      await fes()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut generar la descàrrega: ${err.message}` })
    } finally {
      setGenerant(null)
    }
  }

  return (
    <div>
      <p className="module-lead">
        L&apos;evolució del centre a les proves internes, curs rere curs. Els cursos passats
        vénen de les pestanyes &quot;Resultats TEE&quot; i &quot;Resultats VLCL&quot; de
        l&apos;Eina d&apos;avaluació; el curs en marxa es calcula sol i surt marcat a dalt de tot
        de cada taula.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
        </label>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => descarrega('excel', () => exportaExcel(`Historic-proves-${cursEscolarId}`, { cursEscolarId, etiqueta: 'Avaluació', fulls: fullsExportables() }))}
          disabled={generant !== null}
          type="button"
        >
          {generant === 'excel' ? 'Generant l\'Excel…' : '📥 Descarrega Excel'}
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => descarrega('pdf', () => exportaPDF('Històric de proves (TEE i VL/CL)', {
            cursEscolarId,
            etiqueta: 'Avaluació',
            fulls: fullsExportables(),
            subtitol: 'Annex de la Memòria Anual de centre',
          }))}
          disabled={generant !== null}
          type="button"
        >
          {generant === 'pdf' ? 'Generant el PDF…' : '📄 Descarrega PDF'}
        </button>
      </div>

      {carregant && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-soft)' }}>Carregant…</p>}

      {!carregant && historicTee.length === 0 && historicVlcl.length === 0 && (
        <div className="placeholder-box" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', margin: '0 0 4px' }}>
            Encara no hi ha l&apos;històric
          </p>
          <p className="nota" style={{ marginTop: 0 }}>
            Les xifres dels cursos passats no van dins de l&apos;app: viuen a Firestore, protegides
            perquè només les pugui llegir el compte de direcció. Importa-les un sol cop amb el
            fitxer <code>historic-proves.json</code>.
          </p>
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginTop: 8 }}>
            📤 Importa l&apos;històric (JSON)
            <input type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={(e) => { importaJson(e); e.target.value = '' }} />
          </label>
        </div>
      )}

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      <h3 style={{ fontSize: 14, marginTop: 24, marginBottom: 0 }}>TEE — Text Escrit</h3>
      <TaulaHistoric titol="1r trimestre" files={serieTee('1r')} />
      <TaulaHistoric titol="3r trimestre" files={serieTee('3r')} />

      <h3 style={{ fontSize: 14, marginTop: 28, marginBottom: 0 }}>VL — Velocitat Lectora</h3>
      <TaulaHistoric titol="1r trimestre (Avaluació Inicial)" files={serieVlcl('1r', 'vl')} />
      <TaulaHistoric titol="3r trimestre (Avaluació Final)" files={serieVlcl('3r', 'vl')} />

      <h3 style={{ fontSize: 14, marginTop: 28, marginBottom: 0 }}>CL — Comprensió Lectora</h3>
      <TaulaHistoric titol="1r trimestre (Avaluació Inicial)" files={serieVlcl('1r', 'cl')} />
      <TaulaHistoric titol="3r trimestre (Avaluació Final)" files={serieVlcl('3r', 'cl')} />

      {avisos.length > 0 && (
        <div className="caixa-discreta" style={{ marginTop: 24 }}>
          <strong style={{ fontSize: 12 }}>Files a revisar</strong>
          <p className="nota">
            En aquestes files els recomptes no sumen el total que hi ha apuntat. No s&apos;han
            corregit automàticament — l&apos;històric es deixa tal com és al document del centre —
            però val la pena mirar-les. Els percentatges d&apos;aquesta pantalla es calculen sobre
            la suma dels recomptes.
          </p>
          <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, marginTop: 4 }}>
            {avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <p className="nota" style={{ marginTop: 20 }}>
        Encara no hi ha l&apos;històric d&apos;Innovamat (ConMat i COSMOS): a la carpeta del Drive
        no hi ha una taula de resultats per curs, sinó els informes originals de cada classe.
        S&apos;anirà construint a mesura que es pugin des de la pestanya &quot;Matemàtiques&quot;.
      </p>
    </div>
  )
}

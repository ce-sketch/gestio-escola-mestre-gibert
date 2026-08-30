import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import {
  ETAPES_TEBEROSKY, NIVELLS_TEBEROSKY, historicEI, fullHistoricEI,
} from '../../../lib/lectoescripturaEI'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { llegeixResumEI } from '../../../lib/lectoescripturaImport'
import { slug } from '../../../lib/slug'
import BotoDrive from '../../BotoDrive'

/**
 * L'evolució de la lectoescriptura d'Educació Infantil al llarg dels
 * cursos: una fila per curs escolar i classe.
 *
 * Va al grup "Històric" i no a "Resums" perquè aquí no hi ha el curs en
 * marxa sinó la sèrie sencera — el mateix criteri que separa "Resum
 * ConMat" de "Històric (Innovamat)".
 *
 * ⚠️ La columna "Amb dades" no és el nombre d'alumnes de la classe: és
 * quants en tenen alguna casella marcada. Mirant enrere no es pot saber
 * quants alumnes tenia una classe de fa tres cursos, perquè la llista
 * d'alumnes només conté els actius d'ara.
 */
export default function HistoricLectoescriptura() {
  const [documents, setDocuments] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [exportant, setExportant] = useState(false)
  const [proposta, setProposta] = useState(null)
  const [llegint, setLlegint] = useState(false)
  const [desant, setDesant] = useState(false)

  // Fora de l'efecte perquè la puguin tornar a cridar el desat i el
  // desfer: si no, la taula es quedaria mostrant el que hi havia abans.
  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      // Sense filtre de curs: aquí es volen tots. La col·lecció té un
      // document per classe i curs (una vintena l'any), així que
      // llegir-la sencera no és cap problema.
      const snap = await getDocs(collection(db, 'lectoescripturaEI'))
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  useEffect(() => {
    carrega()
  }, [])

  const files = useMemo(() => historicEI(documents), [documents])
  const cursos = [...new Set(files.map((f) => f.cursEscolar))]

  /** Llegeix la graella d'un curs passat, sense desar res encara. */
  async function pujaFull(e) {
    const fitxer = e?.target?.files?.[0] ?? e
    if (!fitxer) return
    setLlegint(true)
    setError(null)
    try {
      const resultat = await llegeixResumEI(await fitxer.arrayBuffer())
      setProposta({ ...resultat, fitxer: fitxer.name, curs: resultat.cursEscolar ?? '' })
    } catch (err) {
      setError(err.message)
      setProposta(null)
    } finally {
      setLlegint(false)
    }
  }

  /** Desa la proposta: un document per classe, com fa la pantalla
   *  d'entrada de dades. Així l'històric no ha de saber d'on ve cada
   *  curs. */
  async function desaProposta() {
    if (!proposta?.curs?.trim()) {
      setError('Falta el curs escolar del fitxer.')
      return
    }
    setDesant(true)
    setError(null)
    try {
      const curs = proposta.curs.trim()
      await Promise.all(proposta.classes.map((c) => setDoc(
        doc(db, 'lectoescripturaEI', `${curs}__${slug(c.classe)}`),
        {
          classe: c.classe,
          cursEscolar: curs,
          alumnes: c.alumnes,
          importatDe: proposta.fitxer ?? null,
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        }
      )))
      setProposta(null)
      await carrega()
    } catch (err) {
      setError(`No s'ha pogut desar: ${err.message}`)
    } finally {
      setDesant(false)
    }
  }

  /** Desfà la càrrega d'un curs sencer. */
  async function desfesCurs(cursEscolar) {
    setDesant(true)
    setError(null)
    try {
      const afectats = documents.filter((d) => d.cursEscolar === cursEscolar)
      await Promise.all(afectats.map((d) => deleteDoc(doc(db, 'lectoescripturaEI', d.id))))
      await carrega()
    } catch (err) {
      setError(`No s'ha pogut desfer: ${err.message}`)
    } finally {
      setDesant(false)
    }
  }

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const dades = {
        cursEscolarId: cursos.length === 1 ? cursos[0] : `${cursos[cursos.length - 1]} a ${cursos[0]}`,
        etiqueta: 'Avaluació',
        subtitol: "Històric de lectoescriptura · Educació Infantil",
        fulls: [fullHistoricEI(files)],
      }
      if (format === 'excel') exportaExcel('historic-lectoescriptura-EI.xlsx', dades)
      else exportaPDF('Històric de lectoescriptura — Educació Infantil', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com ha evolucionat la lectoescriptura d&apos;Educació Infantil (I4 i I5) al llarg dels
        cursos. La foto del curs en marxa, classe per classe, és a &quot;Resum
        Lectoescriptura&quot;.
      </p>

      {/* ── Afegir un curs passat ──────────────────────────────────── */}
      <div className="caixa-discreta" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 14 }}>Afegeix un curs passat</strong>
        <p className="nota">
          Puja la graella de lectoescriptura d&apos;aquell any (.xlsx). Ha de tenir un full per
          classe, anomenat com la classe (&quot;I4A&quot;, &quot;I5B&quot;), amb una fila per
          alumne i una columna per nivell.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <BotoDrive
            onFitxer={pujaFull}
            onError={(text) => setError(text)}
            disabled={llegint}
            tipus="fulls"
            etiqueta="Tria la graella del Drive"
          />
          <label className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: llegint ? 'wait' : 'pointer' }}>
            {llegint ? 'Llegint…' : '📤 Puja l\'Excel'}
            <input type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }} disabled={llegint}
              onChange={(e) => { pujaFull(e); e.target.value = '' }} />
          </label>
        </div>

        {proposta && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13 }}>
              {proposta.classes.length} classes de &quot;{proposta.fitxer}&quot;
              <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                {' '}— {proposta.classes.map((c) => `${c.classe} (${c.noms.length})`).join(', ')}
              </span>
            </strong>
            {proposta.avisos.map((a, i) => <p key={i} className="nota nota-avis">{a}</p>)}
            <label className="field" style={{ maxWidth: 140, marginTop: 8 }}>
              <span>Curs escolar</span>
              <input type="text" value={proposta.curs} className="camp camp-petit"
                onChange={(e) => setProposta({ ...proposta, curs: e.target.value })} />
            </label>
            {cursos.includes(proposta.curs) && (
              <p className="nota nota-avis">
                El curs {proposta.curs} ja hi és: les classes que coincideixin se substituiran.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={desaProposta} disabled={desant} className="btn-primary" style={{ maxWidth: 220 }}>
                {desant ? 'Desant…' : 'Desa aquest curs'}
              </button>
              <button type="button" onClick={() => setProposta(null)} className="btn-ghost">Cancel·la</button>
            </div>
          </div>
        )}

        {cursos.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13 }}>Cursos carregats</strong>
            <p className="nota">
              Desfer un curs se n&apos;emporta totes les classes. El curs en marxa s&apos;omple
              des de &quot;Lectoescriptura EI&quot;, no cal carregar-lo.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {cursos.map((c) => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--line)', borderRadius: 6, padding: '3px 8px', fontSize: 12 }}>
                  {c}
                  <button
                    type="button"
                    onClick={() => desfesCurs(c)}
                    disabled={desant}
                    title={`Treu el curs ${c} de l'històric`}
                    style={{ background: 'none', border: 'none', color: 'var(--red, #b03030)', cursor: 'pointer', fontSize: 13, padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Descarrega l&apos;històric:</span>
          <button type="button" onClick={() => descarrega('excel')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            {exportant ? 'Generant…' : '⬇ Excel'}
          </button>
          <button type="button" onClick={() => descarrega('pdf')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            ⬇ PDF
          </button>
        </div>
      )}

      {error && <p className="nota nota-error">{error}</p>}
      {carregant && <p className="nota">Carregant l&apos;històric…</p>}

      {!carregant && files.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          Encara no hi ha cap dada de lectoescriptura desada. S&apos;introdueixen a la pestanya
          &quot;Lectoescriptura EI&quot; d&apos;entrada de dades.
        </p>
      )}

      {!carregant && files.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 14 }}>
            {files.length} càrregues, de {cursos.length} curs{cursos.length === 1 ? '' : 'os'}
            {cursos.length > 0 && ` (${cursos.join(', ')})`}.
          </p>

          <div className="taula-scroll" style={{ marginTop: 10 }}>
            <table className="taula-dades" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Curs</th>
                  <th rowSpan={2}>Classe</th>
                  <th rowSpan={2} className="num">Amb dades</th>
                  {ETAPES_TEBEROSKY.map((e) => (
                    <th key={e.id} colSpan={e.nivells.length} style={{ textAlign: 'center' }}>{e.titol}</th>
                  ))}
                </tr>
                <tr>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <th key={n.id} className="num" style={{ fontWeight: 400, fontSize: 10 }} title={n.label}>
                      {n.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={`${f.cursEscolar}__${f.classe}`}>
                    <td>{f.cursEscolar}</td>
                    <td>{f.classe}</td>
                    <td className="num">{f.ambDades}</td>
                    {NIVELLS_TEBEROSKY.map((n) => (
                      <td key={n.id} className="num">{f.comptes[n.id] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="nota" style={{ marginTop: 10 }}>
            <strong>Amb dades</strong> és quants alumnes tenen alguna casella marcada, no quants
            n&apos;hi havia a la classe: dels cursos passats, la fitxa d&apos;alumnat ja no els
            conté. Recorda també que un mateix alumne pot tenir diversos nivells assolits, així que
            les columnes no sumen el total.
          </p>
        </>
      )}
    </div>
  )
}

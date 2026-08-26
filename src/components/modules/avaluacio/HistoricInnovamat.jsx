import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, deleteField, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual, NIVELLS_ESCOLARS } from '../../../lib/cursEscolar'
import { entradesHistoric, entradesCosmos, momentLabel, MOMENTS } from '../../../lib/historicInnovamat'
import Matematiques from './Matematiques'
import HistoricConmat from './HistoricConmat'
import HistoricCosmos from './HistoricCosmos'

/** Els quatre nivells del ConMat, l'escala de les referències que es
 *  copien a mà de la pàgina 4 de l'informe. */
const NIVELLS = ['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt']

/**
 * Històric d'Innovamat: l'evolució del centre a les proves de ConMat i
 * COSMOS al llarg dels cursos.
 *
 * Va a part de la pestanya "Matemàtiques" (entrada de dades) a posta:
 * allà s'hi carreguen només els informes del curs en marxa, mentre que
 * aquí s'hi poden pujar els de qualsevol curs passat per reconstruir
 * l'històric, i consultar-ne els resultats acumulats.
 *
 * Aquest fitxer és només el contenidor: hi ha el que comparteixen les
 * dues proves (la càrrega d'informes i l'esborrat d'un curs sencer, que
 * afecta totes dues) i les subpestanyes. Els resultats de cadascuna són
 * a HistoricConmat.jsx i HistoricCosmos.jsx.
 *
 * La col·lecció "matematiques" es llegeix UNA vegada aquí i es passa als
 * fills per props: si cada pestanya la carregués pel seu compte, canviar
 * de pestanya tornaria a llegir-la sencera.
 */
export default function HistoricInnovamat() {
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [cursCarrega, setCursCarrega] = useState(cursEscolarActual())
  // Referències d'Innovamat (pàgina 4 de l'informe). No es poden llegir
  // del PDF perquè hi són dins d'un gràfic, així que s'introdueixen a mà.
  const [refs, setRefs] = useState({})
  const [refForm, setRefForm] = useState({ curs: cursEscolarActual(), moment: 'final', nivell: '', ambit: 'catalunya', Baix: '', 'Mitjà-baix': '', 'Mitjà-alt': '', Alt: '' })
  const [desantRef, setDesantRef] = useState(false)
  const [llistaRefs, setLlistaRefs] = useState([])
  // Quina referència s'està editant. Editar-les és imprescindible: es
  // copien a mà d'un gràfic i una xifra mal transcrita, sense poder-la
  // tocar, obligaria a refer-la des de zero.
  const [refEditant, setRefEditant] = useState(null)
  const [esborrant, setEsborrant] = useState(false)
  // "Esborra tot un curs" esborra TOTES les classes i TOTS dos moments
  // d'un cop, sense manera de desfer-ho des de l'app. Un window.confirm()
  // normal és massa fàcil de prémer sense voler (per exemple, buscant el
  // "Desfés" d'un informe concret que hi ha just a sota). Per això cal
  // escriure el curs exacte abans que el botó s'activi — el mateix
  // patró que ja fa servir "Backup" per restaurar-hi.
  const [cursPerEsborrar, setCursPerEsborrar] = useState(null)
  const [confirmaEsborraCurs, setConfirmaEsborraCurs] = useState('')
  // Quina de les dues proves s'està mirant. Van separades perquè tenen
  // escales diferents (quatre nivells el ConMat, tres el COSMOS) i
  // alumnat diferent (3r-6è contra 1r-2n); en una sola pàgina, per veure
  // el COSMOS calia passar de llarg tot el ConMat.
  const [prova, setProva] = useState('conmat')

  useEffect(() => { carrega() }, [])

  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'matematiques'))
      const tots = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setRegistres(tots.filter((r) => r.tipus !== 'referencia'))
      const mapa = {}
      const llista = []
      for (const r of tots.filter((r) => r.tipus === 'referencia')) {
        mapa[`${r.cursEscolar}__${r.moment}__${r.nivell}__${r.ambit}`] = r.valors
        llista.push(r)
      }
      setRefs(mapa)
      // La llista sencera, per poder-les repassar i corregir. El mapa de
      // dalt només serveix per pintar-les a les taules de resultats.
      llista.sort((a, b) =>
        String(b.cursEscolar).localeCompare(String(a.cursEscolar))
        || String(a.nivell).localeCompare(String(b.nivell), 'ca')
        || String(a.ambit).localeCompare(String(b.ambit)))
      setLlistaRefs(llista)
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  async function desaReferencia() {
    const { curs, moment, nivell, ambit } = refForm
    // Abans, si faltava el curs o el nivell, la funció sortia en silenci
    // i el botó semblava no fer res. Ara ho diu.
    if (!curs.trim() || !nivell.trim()) {
      setError('Falta el curs escolar o el nivell.')
      return
    }
    setError(null)
    setDesantRef(true)
    try {
      const valors = {}
      for (const n of ['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt']) {
        valors[n] = refForm[n] === '' ? null : Number(refForm[n])
      }
      await setDoc(doc(db, 'matematiques', `referencia__${curs}__${moment}__${nivell}__${ambit}`), {
        tipus: 'referencia',
        cursEscolar: curs, moment, nivell, ambit, valors,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      }, { merge: true })
      // Es buiden només els percentatges: curs, moment i nivell solen
      // repetir-se en introduir-ne unes quantes seguides.
      setRefForm((f) => ({ ...f, Baix: '', 'Mitjà-baix': '', 'Mitjà-alt': '', Alt: '' }))
      setRefEditant(null)
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setDesantRef(false)
    }
  }

  /** Carrega una referència ja desada al formulari per corregir-la. Es
   *  desa amb la mateixa clau (curs + moment + nivell + àmbit), així que
   *  tornar a desar-la la substitueix en comptes de duplicar-la. */
  function editaReferencia(r) {
    setRefForm({
      curs: r.cursEscolar ?? '',
      moment: r.moment ?? 'final',
      nivell: r.nivell ?? '',
      ambit: r.ambit ?? 'catalunya',
      Baix: r.valors?.Baix ?? '',
      'Mitjà-baix': r.valors?.['Mitjà-baix'] ?? '',
      'Mitjà-alt': r.valors?.['Mitjà-alt'] ?? '',
      Alt: r.valors?.Alt ?? '',
    })
    setRefEditant(r.id)
    setError(null)
  }

  async function esborraReferencia(r) {
    setDesantRef(true)
    try {
      await deleteDoc(doc(db, 'matematiques', r.id))
      if (refEditant === r.id) setRefEditant(null)
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setDesantRef(false)
    }
  }

  /**
   * Desfà la càrrega del COSMOS d'una classe i un curs.
   *
   * Igual que amb el ConMat: un mateix document d'alumne pot portar el
   * COSMOS i el ConMat alhora, així que només s'esborra el camp `cosmos`;
   * el document sencer només desapareix si no hi queda res més.
   */
  async function esborraCosmos(cursEscolar, classe) {
    const afectats = registres.filter((r) =>
      r.cursEscolar === cursEscolar && r.cosmos && (r.cosmos.classe ?? null) === classe)
    if (afectats.length === 0) return
    setEsborrant(true)
    try {
      const MAX = 450
      for (let i = 0; i < afectats.length; i += MAX) {
        const lot = writeBatch(db)
        for (const r of afectats.slice(i, i + MAX)) {
          if (!r.conmat) lot.delete(doc(db, 'matematiques', r.id))
          else lot.update(doc(db, 'matematiques', r.id), { cosmos: deleteField() })
        }
        await lot.commit()
      }
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setEsborrant(false)
    }
  }

  /**
   * Desfà la càrrega d'un informe (una classe i un moment concrets).
   *
   * Compte: un mateix document d'alumne pot contenir el ConMat d'inici I
   * el de final, i a més les dades de COSMOS. Per això només s'esborra el
   * moment que toca; el document sencer només desapareix si no hi queda
   * res més a dins.
   */
  async function esborraInforme(cursEscolar, classe, moment) {
    const afectats = registres.filter((r) =>
      r.tipus !== 'informe' && r.tipus !== 'referencia'
      && r.cursEscolar === cursEscolar
      && r.conmat?.[moment]?.classe === classe)

    if (!window.confirm(
      `Esborrar el ConMat de ${classe} (${momentLabel(moment)}, curs ${cursEscolar})?\n\n`
      + `Afecta ${afectats.length} alumnes. La resta de dades (l'altre moment i el COSMOS) es mantenen.`
    )) return

    setEsborrant(true)
    try {
      // En lots: amb 25 alumnes per informe, fer-ho un per un és lent i
      // podria quedar-se a mitges si es talla la connexió.
      const lot = writeBatch(db)
      for (const r of afectats) {
        const restaConmat = Object.keys(r.conmat ?? {}).filter((m) => m !== moment)
        if (restaConmat.length === 0 && !r.cosmos) {
          lot.delete(doc(db, 'matematiques', r.id))
        } else {
          lot.update(doc(db, 'matematiques', r.id), { [`conmat.${moment}`]: deleteField() })
        }
      }
      await lot.commit()
      await deleteDoc(doc(db, 'matematiques', `informe__${cursEscolar}__${classe}__${moment}`)).catch(() => {})
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setEsborrant(false)
    }
  }

  /** Esborra tots els resultats d'Innovamat d'un curs escolar sencer.
   *  Les referències introduïdes a mà es mantenen.
   *
   *  Ja no demana confirmació aquí: la crida només arriba quan qui
   *  truca (el botó de sota) ha comprovat que l'usuari ha escrit el curs
   *  exacte. Fer-ho amb un window.confirm() sol era massa fàcil de
   *  prémer per error. */
  async function esborraCurs(cursEscolar) {
    const afectats = registres.filter((r) => r.cursEscolar === cursEscolar && r.tipus !== 'referencia')
    setEsborrant(true)
    try {
      const MAX = 450
      for (let i = 0; i < afectats.length; i += MAX) {
        const lot = writeBatch(db)
        for (const r of afectats.slice(i, i + MAX)) lot.delete(doc(db, 'matematiques', r.id))
        await lot.commit()
      }
      setCursPerEsborrar(null)
      setConfirmaEsborraCurs('')
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setEsborrant(false)
    }
  }

  const entrades = entradesHistoric(registres)
  const entradesCos = entradesCosmos(registres)
  // Els cursos d'on es pot esborrar: de qualsevol de les dues proves, ja
  // que l'esborrat d'un curs se les emporta totes dues.
  const totsElsCursos = [...new Set([
    ...entrades.map((e) => e.cursEscolar),
    ...entradesCos.map((e) => e.cursEscolar),
  ])].sort().reverse()

  const PESTANYES = [
    { id: 'conmat', label: 'ConMat', subLabel: '(3r a 6è)', quants: entrades.length },
    { id: 'cosmos', label: 'COSMOS', subLabel: '(1r i 2n)', quants: entradesCos.length },
  ]

  // La caixa de referències va dins de la pestanya de ConMat: els seus
  // quatre nivells (Baix/Mitjà-baix/Mitjà-alt/Alt) són els del ConMat i
  // al COSMOS, que en té tres i amb altres noms, no hi encaixen.
  const caixaReferencies = (
    <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 20 }}>
      <strong>Referències d'Innovamat</strong>
      <p style={{ marginTop: 6, fontSize: 13 }}>
        Els percentatges de Catalunya i del total de centres surten a la pàgina 4 de l'informe,
        però hi són dins d'un gràfic: no es poden llegir del PDF i cal copiar-los aquí a mà.
        Un cop desats, surten al costat dels resultats del centre per comparar-los.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
        <label className="field" style={{ maxWidth: 110 }}>
          <span>Curs</span>
          <input type="text" value={refForm.curs} onChange={(e) => setRefForm({ ...refForm, curs: e.target.value })}
            className="camp camp-petit" />
        </label>
        <label className="field" style={{ maxWidth: 130 }}>
          <span>Moment</span>
          <select value={refForm.moment} onChange={(e) => setRefForm({ ...refForm, moment: e.target.value })}
            className="camp camp-petit">
            {MOMENTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ maxWidth: 110 }}>
          <span>Nivell</span>
          {/* Abans era text lliure amb "3r" com a exemple en gris, i
              costava veure que el camp era buit: el botó de desar no
              feia res i no s'entenia per què. Amb un desplegable no es
              pot deixar a mitges ni escriure'l de dues maneres
              ("3r" / "3er"), que trencaria l'agrupació per nivell.
              Les ConMat només es passen de 3r a 6è. */}
          <select value={refForm.nivell} onChange={(e) => setRefForm({ ...refForm, nivell: e.target.value })}
            className="camp camp-petit">
            <option value="">— Tria'l —</option>
            {NIVELLS_ESCOLARS.filter((n) => Number(n.id) >= 3).map((n) => (
              <option key={n.id} value={n.label}>{n.label}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ maxWidth: 130 }}>
          <span>Àmbit</span>
          <select value={refForm.ambit} onChange={(e) => setRefForm({ ...refForm, ambit: e.target.value })}
            className="camp camp-petit">
            <option value="catalunya">Catalunya</option>
            <option value="total">Total centres</option>
          </select>
        </label>
        {NIVELLS.map((n) => (
          <label key={n} className="field" style={{ maxWidth: 85 }}>
            <span>{n} %</span>
            <input type="number" value={refForm[n]} onChange={(e) => setRefForm({ ...refForm, [n]: e.target.value })}
              className="camp camp-petit" style={{ width: 70 }} />
          </label>
        ))}
        <button type="button" className="btn-ghost" onClick={desaReferencia} disabled={desantRef}>
          {desantRef ? 'Desant…' : (refEditant ? 'Desa els canvis' : 'Desa la referència')}
        </button>
        {refEditant && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setRefEditant(null); setRefForm((f) => ({ ...f, Baix: '', 'Mitjà-baix': '', 'Mitjà-alt': '', Alt: '' })) }}
            disabled={desantRef}
          >
            Cancel·la
          </button>
        )}
      </div>

      {/* Les referències desades, per curs i nivell. Sense aquesta
          llista no hi havia manera de saber quines s'havien introduït
          ni de corregir-ne cap xifra mal copiada del gràfic. */}
      {llistaRefs.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 13 }}>Referències desades</strong>
          <table className="taula-dades" style={{ fontSize: 12, marginTop: 6 }}>
            <thead>
              <tr style={{ color: 'var(--ink-soft)' }}>
                <th>Curs</th>
                <th>Moment</th>
                <th>Nivell</th>
                <th>Àmbit</th>
                <th style={{ textAlign: 'right' }}>Baix</th>
                <th style={{ textAlign: 'right' }}>Mitjà-baix</th>
                <th style={{ textAlign: 'right' }}>Mitjà-alt</th>
                <th style={{ textAlign: 'right' }}>Alt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {llistaRefs.map((r) => (
                <tr key={r.id} style={{ background: refEditant === r.id ? 'var(--wash)' : undefined }}>
                  <td>{r.cursEscolar}</td>
                  <td>{momentLabel(r.moment)}</td>
                  <td><strong>{r.nivell}</strong></td>
                  <td style={{ color: 'var(--ink-soft)' }}>
                    {r.ambit === 'catalunya' ? 'Catalunya' : 'Total de centres'}
                  </td>
                  {['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt'].map((n) => (
                    <td key={n} className="num">
                      {r.valors?.[n] != null ? `${r.valors[n]}%` : '—'}
                    </td>
                  ))}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => editaReferencia(r)}
                      disabled={desantRef}
                      style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Edita
                    </button>
                    {' '}
                    <button
                      type="button"
                      onClick={() => esborraReferencia(r)}
                      disabled={desantRef}
                      title="Esborra aquesta referència"
                      style={{ background: 'none', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <p className="module-lead">
        L'evolució del centre a les proves d'Innovamat al llarg dels cursos. Aquí pots pujar els
        informes de cursos passats per reconstruir l'històric — els del curs en marxa es carreguen
        des de la pestanya "Matemàtiques" d'entrada de dades.
      </p>

      {/* ── Càrrega d'informes d'un curs qualsevol ─────────────────── */}
      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 20 }}>
        <strong>Carrega informes d'un curs</strong>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Tria el curs escolar al qual pertanyen els informes i puja'ls. Pots pujar-ne diversos de
          cop. Els alumnes que ja no consten al centre es desen igualment, amb el nom que surti a
          l'informe.
        </p>
        <label className="field" style={{ maxWidth: 140, marginTop: 10 }}>
          <span>Curs escolar dels informes</span>
          <input
            type="text"
            value={cursCarrega}
            onChange={(e) => setCursCarrega(e.target.value)}
            className="camp camp-destacat"
          />
        </label>
        <Matematiques cursEscolarFixat={cursCarrega} nomesCarrega onDesat={carrega} />
      </div>



      {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{error}</p>}
      {carregant && <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>Carregant l&apos;històric…</p>}

      {!carregant && (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 20 }}>
            {entrades.length + entradesCos.length} resultats desats, de{' '}
            {totsElsCursos.length} curs{totsElsCursos.length === 1 ? '' : 'os'}
            {totsElsCursos.length > 0 && ` (${totsElsCursos.join(', ')})`}.
          </p>

      {totsElsCursos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Esborra tot un curs:</span>
            {totsElsCursos.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCursPerEsborrar(c); setConfirmaEsborraCurs('') }}
                disabled={esborrant}
                style={{ background: 'none', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Segon pas obligatori: cal escriure el curs exacte. Esborrar
              un curs sencer no es pot desfer des de l'app (a diferència
              del "Desfés" d'un informe concret), així que aquí no n'hi
              ha prou amb un simple clic de confirmació. */}
          {cursPerEsborrar && (
            <div className="caixa-discreta" style={{ marginTop: 8, borderColor: 'var(--red, #b03030)' }}>
              <strong style={{ fontSize: 12, color: 'var(--red, #b03030)' }}>
                Esborrar TOTS els resultats d'Innovamat del curs {cursPerEsborrar}?
              </strong>
              <p className="nota">
                Afecta totes les classes i tots dos moments (ConMat i COSMOS) —{' '}
                {registres.filter((r) => r.cursEscolar === cursPerEsborrar && r.tipus !== 'referencia').length} registres.
                Les referències d'Innovamat es mantenen. <strong>Aquesta acció no es pot desfer des de l'app.</strong>
                {' '}Escriu <strong>{cursPerEsborrar}</strong> per confirmar-ho.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={confirmaEsborraCurs}
                  onChange={(e) => setConfirmaEsborraCurs(e.target.value)}
                  placeholder={cursPerEsborrar}
                  className="camp camp-petit"
                  style={{ maxWidth: 120 }}
                />
                <button
                  type="button"
                  onClick={() => esborraCurs(cursPerEsborrar)}
                  disabled={esborrant || confirmaEsborraCurs !== cursPerEsborrar}
                  style={{
                    background: confirmaEsborraCurs === cursPerEsborrar ? 'var(--red, #b03030)' : 'var(--line)',
                    color: confirmaEsborraCurs === cursPerEsborrar ? '#fff' : 'var(--ink-soft)',
                    border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11,
                    cursor: confirmaEsborraCurs === cursPerEsborrar ? 'pointer' : 'not-allowed',
                  }}
                >
                  {esborrant ? 'Esborrant…' : 'Esborra definitivament'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCursPerEsborrar(null); setConfirmaEsborraCurs('') }}
                  disabled={esborrant}
                  style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                >
                  Cancel·la
                </button>
              </div>
            </div>
          )}
        </div>
      )}

          {/* ── Subpestanyes ────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 4, marginTop: 26, borderBottom: '1px solid var(--line)' }}>
            {PESTANYES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProva(p.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 16px', fontSize: 14,
                  fontWeight: prova === p.id ? 700 : 400,
                  color: prova === p.id ? 'var(--navy)' : 'var(--ink-soft)',
                  borderBottom: prova === p.id ? '2px solid var(--navy)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {p.label}
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 5 }}>{p.subLabel}</span>
                {p.quants > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)' }}> · {p.quants}</span>
                )}
              </button>
            ))}
          </div>

          {prova === 'conmat' ? (
            <HistoricConmat
              registres={registres}
              refs={refs}
              esborrant={esborrant}
              onEsborraInforme={esborraInforme}
              capcalera={caixaReferencies}
            />
          ) : (
            <HistoricCosmos
              registres={registres}
              esborrant={esborrant}
              onEsborraCosmos={esborraCosmos}
            />
          )}
        </>
      )}
    </div>
  )
}

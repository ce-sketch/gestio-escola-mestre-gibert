import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { llegeixConmat, casaAmbAlumnes, distribucio, NIVELLS_CONMAT } from '../../../lib/conmatParser'
import { llegeixCosmos, resumClasse } from '../../../lib/cosmosParser'
import BotoDrive from '../../BotoDrive'

/**
 * Avaluació referencial de matemàtiques.
 *
 * Les dades no s'entren a mà: es pugen els informes que envia l'Innovamat.
 *   · ConMat  → PDF, un informe per classe amb el nivell de cada alumne
 *   · COSMOS  → CSV, amb la prova inicial i la final i el detall per dimensió
 *
 * El que se'n desa és el resultat per alumne, que després pot alimentar
 * l'informe individual i el quadre de comandament.
 */
export default function Matematiques() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [alumnes, setAlumnes] = useState([])
  const [llegint, setLlegint] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [conmat, setConmat] = useState(null)   // { classe, moment, casats, sensCasar, avisos }
  const [cosmos, setCosmos] = useState(null)   // { alumnes, dimensions, avisos }
  const [desats, setDesats] = useState([])

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carrega() {
    try {
      const [snapAlumnes, snapDesats] = await Promise.all([
        getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
        getDocs(query(collection(db, 'matematiques'), where('cursEscolar', '==', cursEscolarId))),
      ])
      setAlumnes(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
      setDesats(snapDesats.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    }
  }

  // ── ConMat (PDF) ────────────────────────────────────────────────────
  async function pujaConmat(e) {
    const fitxer = e.target.files?.[0]
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    setConmat(null)
    try {
      const resultat = await llegeixConmat(await fitxer.arrayBuffer())
      const { casats, sensCasar } = casaAmbAlumnes(resultat.alumnes, alumnes)
      setConmat({ ...resultat, casats, sensCasar, fitxer: fitxer.name })
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setLlegint(false)
    }
  }

  // ── COSMOS (CSV) ────────────────────────────────────────────────────
  async function pujaCosmos(e) {
    const fitxer = e.target.files?.[0]
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    setCosmos(null)
    try {
      const resultat = llegeixCosmos(await fitxer.text())
      const { casats, sensCasar } = casaAmbAlumnes(
        resultat.alumnes.map((a) => ({ ...a, clau: clauDe(a.nomComplet) })),
        alumnes
      )
      setCosmos({ ...resultat, casats, sensCasar, fitxer: fitxer.name })
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setLlegint(false)
    }
  }

  const clauDe = (t) => String(t ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

  async function desaConmat() {
    if (!conmat?.casats.length) return
    setDesant(true)
    try {
      for (const a of conmat.casats) {
        const id = `${cursEscolarId}__${a.alumneId}`
        await setDoc(doc(db, 'matematiques', id), {
          cursEscolar: cursEscolarId,
          alumneId: a.alumneId,
          nom: a.nom,
          conmat: {
            classe: conmat.classe,
            moment: conmat.moment,
            nivell: a.nivell,
            percentatge: a.percentatge,
            respostes: a.respostes,
            preguntes: a.preguntes,
          },
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        }, { merge: true })
      }
      setMissatge({ type: 'ok', text: `${conmat.casats.length} resultats de ConMat desats.` })
      setConmat(null)
      carrega()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  async function desaCosmos() {
    if (!cosmos?.casats.length) return
    setDesant(true)
    try {
      for (const a of cosmos.casats) {
        const id = `${cursEscolarId}__${a.alumneId}`
        await setDoc(doc(db, 'matematiques', id), {
          cursEscolar: cursEscolarId,
          alumneId: a.alumneId,
          nom: a.nom,
          cosmos: {
            intervencio: a.intervencio ?? null,
            sessionsSetmanals: a.sessionsSetmanals ?? null,
            moments: a.moments,
          },
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        }, { merge: true })
      }
      setMissatge({ type: 'ok', text: `${cosmos.casats.length} resultats de COSMOS desats.` })
      setCosmos(null)
      carrega()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  const repartiment = useMemo(
    () => (conmat ? distribucio(conmat.alumnes) : null),
    [conmat]
  )
  const resumCosmos = useMemo(
    () => (cosmos ? resumClasse(cosmos.alumnes) : null),
    [cosmos]
  )

  return (
    <div>
      <p className="module-lead">
        Els resultats de matemàtiques no s'entren a mà: es pugen els informes que envia
        l'Innovamat. El <strong>ConMat</strong> arriba en PDF i en surt el nivell de cada alumne;
        el <strong>COSMOS</strong> arriba en CSV i en surt el detall de la prova inicial i la final.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
        </label>
        {(llegint || desant) && (
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {llegint ? 'Llegint el fitxer…' : 'Desant…'}
          </span>
        )}
      </div>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      {/* ── ConMat ───────────────────────────────────────────────────── */}
      <div className="caixa" style={{ marginTop: 20 }}>
        <strong style={{ fontSize: 14 }}>ConMat</strong>
        <p className="nota" style={{ maxWidth: '100%' }}>
          L'informe en PDF, un per classe i moment. Se n'obté el <strong>nivell global</strong> de
          cada alumne i les preguntes respostes. Els resultats per bloc (Numeració, Espai i
          forma…) hi són com a gràfics i no es poden llegir.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <BotoDrive
            onFitxer={pujaConmat}
            tipus="documents"
            etiqueta="Tria l'informe del Drive"
            onError={(t) => setMissatge({ type: 'error', text: t })}
            disabled={llegint}
          />
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            📤 Puja el PDF del ConMat
            <input type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={(e) => { pujaConmat(e); e.target.value = '' }} />
          </label>
        </div>

        {conmat && (
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>
              {conmat.classe ?? 'Classe desconeguda'} — {conmat.moment ?? 'moment desconegut'}
              {' '}· {conmat.alumnes.length} alumnes
            </strong>

            {conmat.avisos.map((a, i) => (
              <p key={i} className="nota nota-avis">{a}</p>
            ))}

            <div className="taula-scroll" style={{ marginTop: 10 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {NIVELLS_CONMAT.map((n) => (
                      <th key={n.id} style={{ padding: '4px 12px', background: 'var(--sand)' }}>{n.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {NIVELLS_CONMAT.map((n) => (
                      <td key={n.id} style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <strong>{repartiment.recompte[n.id]}</strong>
                        <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                          {' '}({repartiment.percentatges[n.id]}%)
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {conmat.sensCasar.length > 0 && (
              <div className="caixa-discreta" style={{ marginTop: 10 }}>
                <strong style={{ fontSize: 12 }}>
                  {conmat.sensCasar.length} alumnes de l'informe no s'han pogut relacionar amb cap fitxa
                </strong>
                <p className="nota">
                  Els noms del PDF venen enganxats i en ordre invers. Aquests no els he sabut
                  casar; els seus resultats no es desaran.
                </p>
                <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, marginTop: 4 }}>
                  {conmat.sensCasar.map((a, i) => <li key={i}>{a.nomPdf} — {a.nivell}</li>)}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={desaConmat}
              disabled={desant || conmat.casats.length === 0}
              className="btn-primary"
              style={{ marginTop: 12, maxWidth: 280 }}
            >
              Desa els {conmat.casats.length} resultats
            </button>
          </div>
        )}
      </div>

      {/* ── COSMOS ───────────────────────────────────────────────────── */}
      <div className="caixa" style={{ marginTop: 18 }}>
        <strong style={{ fontSize: 14 }}>COSMOS</strong>
        <p className="nota" style={{ maxWidth: '100%' }}>
          El CSV amb la prova inicial i la final. Se n'obté la puntuació d'habilitats numèriques,
          el rendiment i el percentil de cada dimensió.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            📤 Puja el CSV del COSMOS
            <input type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => { pujaCosmos(e); e.target.value = '' }} />
          </label>
        </div>

        {cosmos && (
          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 13 }}>
              {cosmos.alumnes.length} alumnes · {cosmos.dimensions.length} dimensions
            </strong>
            {cosmos.avisos.map((a, i) => (
              <p key={i} className="nota nota-avis">{a}</p>
            ))}
            <p style={{ fontSize: 13, marginTop: 8 }}>
              {resumCosmos.ambTotesDues} alumnes tenen les dues proves, i{' '}
              <strong>{resumCosmos.milloren}</strong> milloren la puntuació
              {resumCosmos.guanyMitja !== null && <> (guany mitjà: {resumCosmos.guanyMitja} punts)</>}.
            </p>
            <p className="nota">
              Dimensions llegides: {cosmos.dimensions.map((d) => d.nom).join(' · ')}
            </p>

            {cosmos.sensCasar.length > 0 && (
              <p className="nota nota-avis">
                {cosmos.sensCasar.length} alumnes del CSV no s'han pogut relacionar amb cap fitxa
                i no es desaran.
              </p>
            )}

            <button
              type="button"
              onClick={desaCosmos}
              disabled={desant || cosmos.casats.length === 0}
              className="btn-primary"
              style={{ marginTop: 12, maxWidth: 280 }}
            >
              Desa els {cosmos.casats.length} resultats
            </button>
          </div>
        )}
      </div>

      {/* ── Què hi ha desat ──────────────────────────────────────────── */}
      <div style={{ marginTop: 22 }}>
        <strong style={{ fontSize: 14 }}>Resultats desats del curs {cursEscolarId}</strong>
        {desats.length === 0 ? (
          <p className="nota">Encara no hi ha cap resultat desat.</p>
        ) : (
          <div className="taula-scroll" style={{ marginTop: 8 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 12px 4px 0' }}>Alumne</th>
                  <th style={{ padding: '4px 12px' }}>ConMat</th>
                  <th style={{ padding: '4px 12px' }}>COSMOS inicial</th>
                  <th style={{ padding: '4px 12px' }}>COSMOS final</th>
                </tr>
              </thead>
              <tbody>
                {desats.map((d) => (
                  <tr key={d.id}>
                    <td style={{ padding: '4px 12px 4px 0' }}>{d.nom}</td>
                    <td style={{ padding: '4px 12px', textAlign: 'center' }}>{d.conmat?.nivell ?? '—'}</td>
                    <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                      {d.cosmos?.moments?.inicial?.rendiment ?? '—'}
                    </td>
                    <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                      {d.cosmos?.moments?.final?.rendiment ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

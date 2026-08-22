import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { llegeixConmat, casaAmbAlumnes, distribucio, NIVELLS_CONMAT } from '../../../lib/conmatParser'
import { llegeixCosmos, resumClasse } from '../../../lib/cosmosParser'
import BotoDrive from '../../BotoDrive'
import {
  momentId, momentLabel, entradesHistoric, distribucioPerNivell, agrupaPerProva,
} from '../../../lib/historicInnovamat'

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
  const [totsRegistres, setTotsRegistres] = useState([]) // tots els cursos, per a l'històric
  const [veureHistoric, setVeureHistoric] = useState(false)

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
      // L'històric va a part: recorre TOTS els cursos, no només el triat.
      const snapTot = await getDocs(collection(db, 'matematiques'))
      setTotsRegistres(snapTot.docs.map((d) => ({ id: d.id, ...d.data() })))
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
      // El resultat es desa DINS del moment de la prova ("inici"/"final"),
      // no directament a `conmat`. Així, pujar l'informe de final de curs
      // ja no esborra el d'inici del mateix alumne, i queda històric.
      const idMoment = momentId(conmat.moment)
      for (const a of conmat.casats) {
        const id = `${cursEscolarId}__${a.alumneId}`
        await setDoc(doc(db, 'matematiques', id), {
          cursEscolar: cursEscolarId,
          alumneId: a.alumneId,
          nom: a.nom,
          conmat: {
            [idMoment]: {
              classe: conmat.classe,
              moment: conmat.moment,
              nivell: a.nivell,
              percentatge: a.percentatge,
              respostes: a.respostes,
              preguntes: a.preguntes,
            },
          },
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        }, { merge: true })
      }
      // Registre de l'informe carregat, per poder consultar després què
      // s'ha pujat, quan i qui ho va fer. Va a la mateixa col·lecció amb
      // un `tipus` que el distingeix dels registres d'alumne.
      await setDoc(doc(db, 'matematiques', `informe__${cursEscolarId}__${conmat.classe}__${idMoment}`), {
        tipus: 'informe',
        cursEscolar: cursEscolarId,
        classe: conmat.classe,
        moment: idMoment,
        momentText: conmat.moment ?? null,
        alumnesCasats: conmat.casats.length,
        alumnesSenseCasar: conmat.sensCasar?.length ?? 0,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      }, { merge: true })
      setMissatge({ type: 'ok', text: `${conmat.casats.length} resultats de ConMat desats (${conmat.classe} · ${momentLabel(idMoment)}).` })
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
        l'Innovamat. El <strong>ConMat</strong> es llegeix en PDF (el CSV encara no) i en surt el
        nivell de cada alumne; el <strong>COSMOS</strong> es llegeix en CSV (el PDF encara no) i en
        surt el detall de la prova inicial i la final.
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
          {/* El lector del CSV encara no hi és: cal una mostra real del fitxer
              per saber quines columnes porta, com el del COSMOS. El botó ja
              hi és preparat perquè només calgui connectar-lo. */}
          <label className="btn-ghost" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}
            title="Encara no llegim el ConMat en CSV: falta una mostra del fitxer per fer el lector.">
            📤 Puja el CSV del ConMat <span style={{ fontSize: 10, marginLeft: 6 }}>(pròximament)</span>
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
          <BotoDrive
            onFitxer={pujaCosmos}
            tipus="csv"
            etiqueta="Tria el CSV del Drive"
            onError={(t) => setMissatge({ type: 'error', text: t })}
            disabled={llegint}
          />
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            📤 Puja el CSV del COSMOS
            <input type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => { pujaCosmos(e); e.target.value = '' }} />
          </label>
          {/* Igual que el ConMat en CSV: falta una mostra del PDF per saber
              si és una pàgina per alumne o un resum de classe. */}
          <label className="btn-ghost" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}
            title="Encara no llegim el COSMOS en PDF: falta una mostra del fitxer per fer el lector.">
            📤 Puja el PDF del COSMOS <span style={{ fontSize: 10, marginLeft: 6 }}>(pròximament)</span>
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
                {desats.filter((d) => d.tipus !== 'informe').map((d) => {
                  // El ConMat pot venir en format antic (pla) o nou (per
                  // moment): es mostra sempre el més recent que hi hagi.
                  const ultim = entradesHistoric([d])[0]
                  return (
                    <tr key={d.id}>
                      <td style={{ padding: '4px 12px 4px 0' }}>{d.nom}</td>
                      <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                        {ultim?.nivell ?? '—'}
                        {ultim && <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}> ({momentLabel(ultim.moment)})</span>}
                      </td>
                      <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                        {d.cosmos?.moments?.inicial?.rendiment ?? '—'}
                      </td>
                      <td style={{ padding: '4px 12px', textAlign: 'center' }}>
                        {d.cosmos?.moments?.final?.rendiment ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Històric d'Innovamat ─────────────────────────────────── */}
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 28 }}>
          <strong>Històric d'Innovamat</strong>
          <p style={{ marginTop: 6, fontSize: 13 }}>
            Cada informe que puges queda desat per curs i moment de la prova, sense esborrar els
            anteriors. Per recuperar cursos passats, tria el curs a dalt i puja'n els PDFs del Drive.
          </p>
          <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setVeureHistoric((v) => !v)}>
            {veureHistoric ? 'Amaga l\'històric' : `Mostra l'històric (${entradesHistoric(totsRegistres).length} resultats)`}
          </button>

          {veureHistoric && (
            <div style={{ marginTop: 14 }}>
              <strong style={{ fontSize: 13 }}>Informes carregats</strong>
              {totsRegistres.filter((r) => r.tipus === 'informe').length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Encara no consta cap informe carregat. Els que hagis pujat abans d'aquesta millora no
                  hi surten, però els resultats dels alumnes sí que hi són a l'històric de sota.
                </p>
              ) : (
                <table style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 6 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                      <th style={{ padding: '4px 12px 4px 0' }}>Curs</th>
                      <th style={{ padding: '4px 12px' }}>Classe</th>
                      <th style={{ padding: '4px 12px' }}>Moment</th>
                      <th style={{ padding: '4px 12px' }}>Alumnes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totsRegistres.filter((r) => r.tipus === 'informe')
                      .sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
                      .map((r) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '4px 12px 4px 0' }}>{r.cursEscolar}</td>
                          <td style={{ padding: '4px 12px' }}>{r.classe}</td>
                          <td style={{ padding: '4px 12px' }}>{momentLabel(r.moment)}</td>
                          <td style={{ padding: '4px 12px' }}>
                            {r.alumnesCasats}
                            {r.alumnesSenseCasar > 0 && (
                              <span style={{ color: 'var(--red, #b03030)' }}> (+{r.alumnesSenseCasar} sense casar)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}

              <strong style={{ fontSize: 13, display: 'block', marginTop: 16 }}>Resultats per prova</strong>
              {agrupaPerProva(entradesHistoric(totsRegistres)).map((grup) => {
                const dist = distribucioPerNivell(grup.entrades)
                return (
                  <div key={`${grup.cursEscolar}-${grup.moment}`} style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, margin: '0 0 4px' }}>
                      {grup.cursEscolar} · {momentLabel(grup.moment)}
                      <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> — {dist.total} alumnes</span>
                    </p>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                      <tbody>
                        {dist.files.map((f) => (
                          <tr key={f.nivell}>
                            <td style={{ padding: '2px 12px 2px 0' }}>{f.nivell}</td>
                            <td style={{ padding: '2px 12px', textAlign: 'right' }}>{f.alumnes}</td>
                            <td style={{ padding: '2px 12px', textAlign: 'right', color: 'var(--ink-soft)' }}>{f.percentatge}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { comptaDiesLectius } from '../../lib/calendar'
import { carregaRegistresPeriode, calculaIndexos, nivellAlerta } from '../../lib/absentisme'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { enviaAvis, WORKER_AVISOS_URL } from '../../lib/email'

const CURS_ESCOLAR = cursEscolarActual()

// Correus dels tutors/es per classe, extrets del document de personal del
// centre. Es fan servir només com a valors per defecte — es poden editar i
// desar des del mateix mòdul en qualsevol moment.
const CONTACTES_PER_DEFECTE = {
  cocobeEmail: 'coccobe@escolamestregibert.cat',
  tutors: {
    'I3 A': 'mariajose.casas@escolamestregibert.cat',
    'I3 B': 'nuria.cutillas@escolamestregibert.cat',
    'I4 A': 'eva.sanchez@escolamestregibert.cat',
    'I4 B': 'beatriz.leon@escolamestregibert.cat',
    'I5 A': 'nuria.balta@escolamestregibert.cat',
    'I5 B': 'silvia.riera@escolamestregibert.cat',
    'TEI': 'silvia.gil@escolamestregibert.cat',
    '1r A': 'lidia.soriano@escolamestregibert.cat',
    '1r B': 'anna.ruiz@escolamestregibert.cat',
    '2n A': 'noemi.calenzo@escolamestregibert.cat',
    '2n B': 'nuria.sabido@escolamestregibert.cat',
    '3r A': 'sara.fernandez@escolamestregibert.cat',
    '3r B': 'maria.castro@escolamestregibert.cat',
    '4t A': 'esther.mila@escolamestregibert.cat',
    '4t B': 'fatima.garcia@escolamestregibert.cat',
    '5è A': 'javier.linuesa@escolamestregibert.cat',
    '5è B': 'lua.oropesa@escolamestregibert.cat',
    '6è A': 'gemma.rue@escolamestregibert.cat',
    '6è B': 'ingrid.ferrer@escolamestregibert.cat',
  },
}

export default function Absentisme() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [curs, setCurs] = useState('')
  const [calendari, setCalendari] = useState(null)
  const [trimestreIdx, setTrimestreIdx] = useState(0)
  const [carregant, setCarregant] = useState(true)
  const [files, setFiles] = useState([])
  const [contactes, setContactes] = useState(CONTACTES_PER_DEFECTE)
  const [mostraContactes, setMostraContactes] = useState(false)
  const [textMassiuContactes, setTextMassiuContactes] = useState('')
  const [seleccionats, setSeleccionats] = useState(new Set())
  const [enviant, setEnviant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    async function carregaInicial() {
      try {
        const [snapAlumnes, snapCalendari, snapContactes] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDoc(doc(db, 'calendari', CURS_ESCOLAR)),
          getDoc(doc(db, 'configuracio', 'contactes')),
        ])
        const llista = snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0) setCurs((c) => c || llista[0].curs)
        if (snapCalendari.exists()) setCalendari(snapCalendari.data())
        if (snapContactes.exists()) setContactes(snapContactes.data())
        else setContactes(CONTACTES_PER_DEFECTE)
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carregaInicial()
  }, [])

  const cursos = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].sort(),
    [alumnesTots]
  )
  const alumnesClasse = useMemo(
    () => alumnesTots.filter((a) => a.curs === curs),
    [alumnesTots, curs]
  )
  const trimestre = calendari?.trimestres?.[trimestreIdx]

  useEffect(() => {
    async function calcula() {
      if (!curs || !trimestre?.inici || !trimestre?.fi) {
        setFiles([])
        return
      }
      setCarregant(true)
      try {
        const registres = await carregaRegistresPeriode(curs, trimestre.inici, trimestre.fi)
        const diesLectius = comptaDiesLectius(trimestre.inici, trimestre.fi, calendari.diesNoLectius ?? [])
        const resultat = calculaIndexos(alumnesClasse, registres, diesLectius)
        resultat.sort((a, b) => b.indexInjustificat - a.indexInjustificat)
        setFiles(resultat)
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut calcular l'absentisme: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    calcula()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs, trimestreIdx, calendari, alumnesClasse])

  const diesLectius = trimestre ? comptaDiesLectius(trimestre.inici, trimestre.fi, calendari?.diesNoLectius ?? []) : 0
  const enAlerta = files.filter((f) => nivellAlerta(f.indexInjustificat))
  const greus = files.filter((f) => nivellAlerta(f.indexInjustificat) === 'greu')

  function toggleSeleccio(alumneId) {
    setSeleccionats((prev) => {
      const nou = new Set(prev)
      if (nou.has(alumneId)) nou.delete(alumneId)
      else nou.add(alumneId)
      return nou
    })
  }

  function updateTutorEmail(cursNom, valor) {
    setContactes((prev) => ({ ...prev, tutors: { ...prev.tutors, [cursNom]: valor } }))
  }

  function aplicaContactesMassiu() {
    const linies = textMassiuContactes.split('\n').map((l) => l.trim()).filter(Boolean)
    const nousTutors = {}
    let ignorades = 0
    for (const linia of linies) {
      const [cursNom, correu] = linia.split('\t').map((s) => s?.trim())
      if (!cursNom || !correu || !correu.includes('@')) {
        ignorades += 1
        continue
      }
      nousTutors[cursNom] = correu
    }
    setContactes((prev) => ({ ...prev, tutors: { ...prev.tutors, ...nousTutors } }))
    setTextMassiuContactes('')
    setMissatge({
      type: ignorades > 0 ? 'error' : 'ok',
      text: `${Object.keys(nousTutors).length} correus actualitzats.${ignorades > 0 ? ` ${ignorades} línies no s'han pogut interpretar (falta el correu o el format no és "Classe [tabulador] correu").` : ''} Recorda clicar "Desa contactes" per guardar-ho.`,
    })
  }

  async function desaContactes() {
    await setDoc(doc(db, 'configuracio', 'contactes'), { ...contactes, actualitzatEl: serverTimestamp() }, { merge: true })
    setMissatge({ type: 'ok', text: 'Contactes desats.' })
  }

  async function enviaAvisosSeleccionats() {
    setEnviant(true)
    setMissatge(null)
    const tutorEmail = contactes.tutors?.[curs]
    const destinatarisBase = [
      ...new Set([tutorEmail, contactes.cocobeEmail, 'ce@escolamestregibert.cat'].filter(Boolean)),
    ]

    if (destinatarisBase.length === 0) {
      setMissatge({ type: 'error', text: 'No hi ha cap destinatari configurat. Obre "Contactes" i afegeix com a mínim un correu.' })
      setEnviant(false)
      return
    }

    let enviats = 0
    let errors = 0
    for (const fila of files) {
      if (!seleccionats.has(fila.alumne.id)) continue
      try {
        await enviaAvis({
          destinataris: destinatarisBase,
          assumpte: `Avís d'absentisme — ${fila.alumne.nom} (${curs})`,
          cos: `
            <p>S'informa que l'alumne/a <strong>${fila.alumne.nom}</strong> (${curs}) ha superat
            el llindar d'absentisme durant el ${trimestre.nom}.</p>
            <p>Índex d'absentisme no justificat: <strong>${fila.indexInjustificat.toFixed(1)}%</strong>
            (${fila.absenciesInjust} absències no justificades sobre ${diesLectius * 2} sessions lectives).</p>
            <p>Aquest és un avís automàtic generat per l'eina de gestió del centre.</p>
          `,
        })
        enviats += 1
      } catch (err) {
        errors += 1
      }
    }
    setMissatge({
      type: errors > 0 ? 'error' : 'ok',
      text: `${enviats} avisos enviats correctament.${errors > 0 ? ` ${errors} han fallat.` : ''}`,
    })
    setEnviant(false)
  }

  return (
    <div className="module">
      <p className="module-eyebrow">Curs {CURS_ESCOLAR}</p>
      <h2>Absentisme</h2>
      <p className="module-lead">
        Resum trimestral dels índexs d'absentisme per classe, i avisos per als alumnes que
        superen el 10% o el 25% (calculat sobre absències i retards sense justificar).
      </p>

      {!WORKER_AVISOS_URL && (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16, borderColor: 'var(--amber-dark)' }}>
          <strong>El servei d'enviament de correus encara no està configurat.</strong> Pots consultar
          el resum igualment; per activar l'enviament d'avisos, segueix les instruccions del fitxer
          "worker-avisos/README.md" del projecte.
        </div>
      )}

      {!calendari && !carregant && (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
          No hi ha cap calendari desat per al curs {CURS_ESCOLAR}. Ves al mòdul "Calendari" i
          desa'l abans de consultar l'absentisme.
        </div>
      )}

      {calendari && (
        <>
          <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
            <label className="field" style={{ minWidth: 160 }}>
              <span>Classe</span>
              <select value={curs} onChange={(e) => setCurs(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field" style={{ minWidth: 160 }}>
              <span>Trimestre</span>
              <select value={trimestreIdx} onChange={(e) => setTrimestreIdx(Number(e.target.value))} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                {calendari.trimestres?.map((t, i) => <option key={i} value={i}>{t.nom}</option>)}
              </select>
            </label>
          </div>

          <div className="card-grid" style={{ marginTop: 24 }}>
            <div className="info-card">
              <h3>Dies lectius del trimestre</h3>
              <p>{diesLectius} dies ({diesLectius * 2} sessions)</p>
            </div>
            <div className="info-card" style={{ borderColor: enAlerta.length > 0 ? 'var(--amber-dark)' : undefined }}>
              <h3>Alumnes per sobre del 10%</h3>
              <p>{enAlerta.length}</p>
            </div>
            <div className="info-card" style={{ borderColor: greus.length > 0 ? 'var(--red)' : undefined }}>
              <h3>Alumnes per sobre del 25%</h3>
              <p>{greus.length}</p>
            </div>
          </div>

          {carregant ? (
            <p style={{ marginTop: 24 }}>Calculant…</p>
          ) : (
            <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '8px 6px', width: 32 }}></th>
                  <th style={{ padding: '8px 6px' }}>Alumne</th>
                  <th style={{ padding: '8px 6px' }}>Absències</th>
                  <th style={{ padding: '8px 6px' }}>No justif.</th>
                  <th style={{ padding: '8px 6px' }}>Índex total</th>
                  <th style={{ padding: '8px 6px' }}>Índex no justif.</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const nivell = nivellAlerta(f.indexInjustificat)
                  const color = nivell === 'greu' ? 'var(--red)' : nivell === 'atencio' ? 'var(--amber-dark)' : 'var(--ink)'
                  return (
                    <tr key={f.alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 6px' }}>
                        {nivell && (
                          <input
                            type="checkbox"
                            checked={seleccionats.has(f.alumne.id)}
                            onChange={() => toggleSeleccio(f.alumne.id)}
                          />
                        )}
                      </td>
                      <td style={{ padding: '8px 6px', fontWeight: nivell ? 600 : 400, color }}>{f.alumne.nom}</td>
                      <td style={{ padding: '8px 6px' }}>{f.absencies}</td>
                      <td style={{ padding: '8px 6px' }}>{f.absenciesInjust}</td>
                      <td style={{ padding: '8px 6px' }}>{f.indexAbsentisme.toFixed(1)}%</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600, color }}>{f.indexInjustificat.toFixed(1)}%</td>
                    </tr>
                  )
                })}
                {files.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '16px 6px', color: 'var(--ink-soft)' }}>No hi ha dades per a aquest període.</td></tr>
                )}
              </tbody>
            </table>
          )}

          <button
            className="btn-primary"
            style={{ marginTop: 20, maxWidth: 260 }}
            onClick={enviaAvisosSeleccionats}
            disabled={enviant || seleccionats.size === 0}
          >
            {enviant ? 'Enviant…' : `Envia avisos (${seleccionats.size} seleccionats)`}
          </button>

          <details style={{ marginTop: 28 }} open={mostraContactes} onToggle={(e) => setMostraContactes(e.target.open)}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Contactes per als avisos</summary>
            <div style={{ marginTop: 12 }}>
              <label className="field" style={{ maxWidth: 320 }}>
                <span>Correu del/de la coordinador/a COCOBE</span>
                <input
                  type="email"
                  value={contactes.cocobeEmail || ''}
                  onChange={(e) => setContactes((prev) => ({ ...prev, cocobeEmail: e.target.value }))}
                  placeholder="cocobe@escolamestregibert.cat"
                />
              </label>

              <p className="module-note" style={{ marginTop: 16, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
                Correu del tutor/a de cada classe
              </p>
              {cursos.map((c) => (
                <label key={c} className="field" style={{ maxWidth: 320, marginBottom: 8 }}>
                  <span>{c}</span>
                  <input
                    type="email"
                    value={contactes.tutors?.[c] || ''}
                    onChange={(e) => updateTutorEmail(c, e.target.value)}
                    placeholder="tutor@escolamestregibert.cat"
                  />
                </label>
              ))}

              <details style={{ marginTop: 12, marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--navy)' }}>
                  Actualitzar-ne diversos de cop (útil a l'inici de cada curs)
                </summary>
                <p className="module-note" style={{ marginTop: 8 }}>
                  Enganxa aquí les dues columnes "Classe" i "Correu" copiades del document de
                  personal del centre (per exemple, la taula "GRUP / EMAIL"). Mai enganxis
                  columnes amb DNI ni altres dades del personal — només classe i correu.
                </p>
                <textarea
                  value={textMassiuContactes}
                  onChange={(e) => setTextMassiuContactes(e.target.value)}
                  placeholder={'1r A\\tlidia.soriano@escolamestregibert.cat\\n1r B\\tanna.ruiz@escolamestregibert.cat'}
                  rows={5}
                  style={{
                    width: '100%', marginTop: 8, border: '1px solid var(--line)', borderRadius: 8, padding: 10,
                    fontFamily: 'monospace', fontSize: 13, resize: 'vertical',
                  }}
                />
                <button
                  className="btn-ghost"
                  style={{ marginTop: 8, color: 'var(--navy)', borderColor: 'var(--navy)' }}
                  onClick={aplicaContactesMassiu}
                  type="button"
                >
                  Aplica la llista
                </button>
              </details>

              <button className="btn-ghost" style={{ marginTop: 8, color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={desaContactes} type="button">
                Desa contactes
              </button>
            </div>
          </details>
        </>
      )}

      {missatge && (
        <p style={{ marginTop: 16, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}

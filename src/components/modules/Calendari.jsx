import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { comptaDiesLectius } from '../../lib/calendar'
import { fetchDocText, parseOfficialCalendarText } from '../../lib/officialCalendarDoc'
import { cursEscolarActual, cursSeguent } from '../../lib/cursEscolar'

// ID del document "HORARI I CALENDARI ESCOLAR" a Google Docs. Ha d'estar
// compartit com "Qualsevol persona amb l'enllaç" (lector) perquè el botó
// d'actualització el pugui llegir.
const DOC_CALENDARI_OFICIAL_ID = '1ymotZaFCfmfHmQdVP13Q50yF_0cG2W46bgSxdfmnDHw'

/** Suma un any (o el nombre indicat) a una data en format AAAA-MM-DD. */
function sumaAnys(dataIso, anys) {
  if (!dataIso) return ''
  const [y, m, d] = dataIso.split('-').map(Number)
  return `${y + anys}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const CURS_PER_DEFECTE = cursEscolarActual()

const TRIMESTRES_BUITS = [
  { nom: '1r trimestre', inici: '', fi: '' },
  { nom: '2n trimestre', inici: '', fi: '' },
  { nom: '3r trimestre', inici: '', fi: '' },
]

// Dades oficials del document "HORARI I CALENDARI ESCOLAR 26-27", només
// s'apliquen per defecte quan el curs seleccionat és el 2026-27.
const TRIMESTRES_2026_27 = [
  { nom: '1r trimestre', inici: '2026-09-08', fi: '2027-01-07' },
  { nom: '2n trimestre', inici: '2027-01-08', fi: '2027-03-29' },
  { nom: '3r trimestre', inici: '2027-03-30', fi: '2027-06-22' },
]

const DIES_NO_LECTIUS_2026_27 = [
  { data: '2026-09-11', motiu: 'Diada Nacional de Catalunya' },
  { data: '2026-09-24', motiu: 'Festa de la Mercè' },
  { data: '2026-10-30', motiu: 'Lliure disposició' },
  { data: '2026-12-07', motiu: 'Lliure disposició' },
  { data: '2026-12-08', motiu: 'Dia de la Immaculada Concepció' },
  { data: '2026-12-22', motiu: 'Vacances de Nadal' },
  { data: '2026-12-23', motiu: 'Vacances de Nadal' },
  { data: '2026-12-24', motiu: 'Vacances de Nadal' },
  { data: '2026-12-25', motiu: 'Vacances de Nadal (Nadal)' },
  { data: '2026-12-28', motiu: 'Vacances de Nadal' },
  { data: '2026-12-29', motiu: 'Vacances de Nadal' },
  { data: '2026-12-30', motiu: 'Vacances de Nadal' },
  { data: '2026-12-31', motiu: 'Vacances de Nadal' },
  { data: '2027-01-01', motiu: 'Vacances de Nadal (Cap d\'Any)' },
  { data: '2027-01-04', motiu: 'Vacances de Nadal' },
  { data: '2027-01-05', motiu: 'Vacances de Nadal' },
  { data: '2027-01-06', motiu: 'Vacances de Nadal (Reis)' },
  { data: '2027-01-07', motiu: 'Vacances de Nadal' },
  { data: '2027-02-08', motiu: 'Dilluns de Carnaval (lliure disposició)' },
  { data: '2027-03-22', motiu: 'Setmana Santa' },
  { data: '2027-03-23', motiu: 'Setmana Santa' },
  { data: '2027-03-24', motiu: 'Setmana Santa' },
  { data: '2027-03-25', motiu: 'Setmana Santa' },
  { data: '2027-03-26', motiu: 'Setmana Santa' },
  { data: '2027-03-29', motiu: 'Setmana Santa' },
  { data: '2027-05-01', motiu: 'Festa del Treball' },
  { data: '2027-05-14', motiu: 'Lliure disposició' },
  { data: '2027-05-17', motiu: 'Pasqua Granada (comprova l\'any: el document deia 2026)' },
]

function defectesPer(cursId) {
  if (cursId === '2026-27') {
    return {
      inici: '2026-09-08',
      fi: '2027-06-22',
      trimestres: TRIMESTRES_2026_27,
      diesNoLectius: DIES_NO_LECTIUS_2026_27,
    }
  }
  return { inici: '', fi: '', trimestres: TRIMESTRES_BUITS, diesNoLectius: [] }
}

export default function Calendari() {
  const [cursId, setCursId] = useState(CURS_PER_DEFECTE)
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [existeix, setExisteix] = useState(false)
  const [inici, setInici] = useState('')
  const [fi, setFi] = useState('')
  const [trimestres, setTrimestres] = useState(TRIMESTRES_BUITS)
  const [diesNoLectius, setDiesNoLectius] = useState([])
  const [novaData, setNovaData] = useState('')
  const [novMotiu, setNovMotiu] = useState('')
  const [textMassiu, setTextMassiu] = useState('')
  const [actualitzant, setActualitzant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    carregaCurs(cursId)
  }, [cursId])

  async function carregaCurs(curs) {
    setCarregant(true)
    setMissatge(null)
    try {
      const ref = doc(db, 'calendari', curs)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const dades = snap.data()
        setInici(dades.inici ?? '')
        setFi(dades.fi ?? '')
        setTrimestres(dades.trimestres?.length ? dades.trimestres : TRIMESTRES_BUITS)
        setDiesNoLectius(dades.diesNoLectius ?? [])
        setExisteix(true)
      } else {
        const defectes = defectesPer(curs)
        setInici(defectes.inici)
        setFi(defectes.fi)
        setTrimestres(defectes.trimestres)
        setDiesNoLectius(defectes.diesNoLectius)
        setExisteix(false)
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar el calendari: ${err.message}` })
    }
    setCarregant(false)
  }

  function updateTrimestre(index, field, value) {
    setTrimestres((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  function afegeixDiaNoLectiu() {
    if (!novaData) return
    setDiesNoLectius((prev) => [...prev, { data: novaData, motiu: novMotiu || 'Festiu' }].sort((a, b) => a.data.localeCompare(b.data)))
    setNovaData('')
    setNovMotiu('')
  }

  function treuDiaNoLectiu(index) {
    setDiesNoLectius((prev) => prev.filter((_, i) => i !== index))
  }

  function afegeixDiesMassiu() {
    const linies = textMassiu.split('\n').map((l) => l.trim()).filter(Boolean)
    const nous = []
    for (const linia of linies) {
      const [data, ...resta] = linia.split('\t')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.trim())) continue
      nous.push({ data: data.trim(), motiu: resta.join(' ').trim() || 'Festiu' })
    }
    if (nous.length === 0) return
    setDiesNoLectius((prev) => [...prev, ...nous].sort((a, b) => a.data.localeCompare(b.data)))
    setTextMassiu('')
  }

  async function actualitzaDesDelDocument() {
    setActualitzant(true)
    setMissatge(null)
    try {
      const text = await fetchDocText(DOC_CALENDARI_OFICIAL_ID)
      const resultat = parseOfficialCalendarText(text, cursId)

      if (resultat.inici) setInici(resultat.inici)
      if (resultat.fi) setFi(resultat.fi)
      if (resultat.diesNoLectius.length > 0) setDiesNoLectius(resultat.diesNoLectius)

      const avisText = resultat.avisos.length > 0
        ? ` Avisos: ${resultat.avisos.join(' ')}`
        : ''
      setMissatge({
        type: resultat.avisos.length > 0 ? 'warn' : 'ok',
        text: `Formulari omplert des del document oficial (${resultat.diesNoLectius.length} dies no lectius trobats). Revisa-ho abans de desar.${avisText}`,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setActualitzant(false)
    }
  }

  async function desa() {
    setDesant(true)
    setMissatge(null)
    try {
      await setDoc(
        doc(db, 'calendari', cursId),
        { inici, fi, trimestres, diesNoLectius, actualitzatEl: serverTimestamp() },
        { merge: true }
      )
      setExisteix(true)
      setMissatge({ type: 'ok', text: 'Calendari desat correctament.' })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  async function creaCursVinent() {
    const nouCurs = cursSeguent(cursId)
    const ref = doc(db, 'calendari', nouCurs)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      setCursId(nouCurs)
      setMissatge({ type: 'warn', text: `El curs ${nouCurs} ja existia — l'he obert per si el vols revisar.` })
      return
    }

    // Proposa les mateixes dates d'aquest curs, avançades un any, com a punt
    // de partida ràpid (mai toca ni esborra el curs actual).
    const trimestresNous = trimestres.map((t) => ({
      ...t,
      inici: sumaAnys(t.inici, 1),
      fi: sumaAnys(t.fi, 1),
    }))
    const diesNoLectiusNous = diesNoLectius.map((d) => ({ ...d, data: sumaAnys(d.data, 1) }))

    await setDoc(ref, {
      inici: sumaAnys(inici, 1),
      fi: sumaAnys(fi, 1),
      trimestres: trimestresNous,
      diesNoLectius: diesNoLectiusNous,
      actualitzatEl: serverTimestamp(),
    })

    setCursId(nouCurs)
    setMissatge({
      type: 'ok',
      text: `Calendari ${nouCurs} creat a partir del de ${cursId} (dates avançades un any). Revisa-les abans de donar-les per bones — els festius no cauen sempre el mateix dia cada any.`,
    })
  }

  return (
    <div className="module">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label className="field" style={{ minWidth: 140 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursId}
            onChange={(e) => setCursId(e.target.value)}
            style={{ fontWeight: 600 }}
          />
        </label>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', marginTop: 18 }}
          onClick={() => carregaCurs(cursId)}
          type="button"
        >
          Obre aquest curs
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--amber-dark)', borderColor: 'var(--amber-dark)', marginTop: 18 }}
          onClick={creaCursVinent}
          type="button"
          disabled={carregant}
        >
          + Crea el calendari del curs {cursSeguent(cursId)}
        </button>
      </div>

      <p className="module-eyebrow" style={{ marginTop: 20 }}>
        {existeix ? 'Calendari desat' : 'Encara no desat per a aquest curs'}
      </p>
      <h2>Calendari escolar</h2>
      <p className="module-lead">
        Cada curs escolar té el seu propi calendari, guardat per separat — mai se sobreescriu
        el d'un curs anterior. Quan comenci el curs vinent, usa el botó de dalt per crear-lo
        automàticament a partir d'aquest (avançant totes les dates un any) i després ajusta els
        festius, que no cauen sempre el mateix dia.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--green)', borderColor: 'var(--green)' }}
          onClick={actualitzaDesDelDocument}
          type="button"
          disabled={actualitzant}
        >
          {actualitzant ? 'Llegint el document…' : '↻ Actualitza des del document oficial'}
        </button>
        <a
          href={`https://docs.google.com/document/d/${DOC_CALENDARI_OFICIAL_ID}/export?format=pdf`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          📄 Descarrega el document manualment
        </a>
      </div>
      <p className="module-note" style={{ marginTop: 6 }}>
        Omple el formulari a partir del document "HORARI I CALENDARI ESCOLAR" — no desa res
        automàticament, revisa-ho i clica "Desa el calendari" tu mateix.
      </p>

      {carregant ? (
        <p style={{ marginTop: 24 }}>Carregant…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: 1, minWidth: 180 }}>
              <span>Inici del curs</span>
              <input type="date" value={inici} onChange={(e) => setInici(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 180 }}>
              <span>Final del curs</span>
              <input type="date" value={fi} onChange={(e) => setFi(e.target.value)} />
            </label>
          </div>

          <p className="module-note" style={{ marginTop: 28, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
            Trimestres
          </p>
          {trimestres.map((t, i) => {
            const diesLectius = comptaDiesLectius(t.inici, t.fi, diesNoLectius)
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <label className="field" style={{ minWidth: 140 }}>
                  <span>Nom</span>
                  <input type="text" value={t.nom} onChange={(e) => updateTrimestre(i, 'nom', e.target.value)} />
                </label>
                <label className="field" style={{ minWidth: 160 }}>
                  <span>Inici</span>
                  <input type="date" value={t.inici} onChange={(e) => updateTrimestre(i, 'inici', e.target.value)} />
                </label>
                <label className="field" style={{ minWidth: 160 }}>
                  <span>Fi</span>
                  <input type="date" value={t.fi} onChange={(e) => updateTrimestre(i, 'fi', e.target.value)} />
                </label>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)', paddingBottom: 10 }}>
                  {t.inici && t.fi ? `${diesLectius} dies lectius` : ''}
                </span>
              </div>
            )
          })}

          <p className="module-note" style={{ marginTop: 28, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
            Dies no lectius (festius, vacances)
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
            />
            <input
              type="text"
              placeholder="Motiu (p. ex. Nadal, Festa Major...)"
              value={novMotiu}
              onChange={(e) => setNovMotiu(e.target.value)}
              style={{ flex: 1, minWidth: 180, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
            />
            <button className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={afegeixDiaNoLectiu} type="button">
              + Afegeix
            </button>
          </div>

          <details style={{ marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--navy)' }}>
              Afegir-ne diversos de cop (enganxar una llista)
            </summary>
            <textarea
              value={textMassiu}
              onChange={(e) => setTextMassiu(e.target.value)}
              placeholder={'Un per línia, format: AAAA-MM-DD\\tMotiu\\n2026-12-22\\tVacances de Nadal'}
              rows={4}
              style={{
                width: '100%', marginTop: 8, border: '1px solid var(--line)', borderRadius: 8, padding: 10,
                fontFamily: 'monospace', fontSize: 13, resize: 'vertical',
              }}
            />
            <button
              className="btn-ghost"
              style={{ marginTop: 8, color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={afegeixDiesMassiu}
              type="button"
            >
              Afegeix la llista
            </button>
          </details>

          {diesNoLectius.length > 0 && (
            <ul className="roster">
              {diesNoLectius.map((d, i) => (
                <li key={i} className="roster-row">
                  <span className="roster-name">{formatData(d.data)} — {d.motiu}</span>
                  <button className="chip" onClick={() => treuDiaNoLectiu(i)} type="button">Treu</button>
                </li>
              ))}
            </ul>
          )}

          <button className="btn-primary" style={{ marginTop: 28, maxWidth: 200 }} onClick={desa} disabled={desant}>
            {desant ? 'Desant…' : 'Desa el calendari'}
          </button>
        </>
      )}

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : missatge.type === 'warn' ? 'var(--amber-dark)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}

function formatData(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

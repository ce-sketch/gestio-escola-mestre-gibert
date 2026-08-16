import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { CICLES, NOMS_AFA, FESTES, nomsActius, suggerimentsComissions } from '../../lib/valoracions'
import { carregaConfigValoracions } from '../../lib/valoracionsConfig'
import ValoracioObjectius from './valoracions/ValoracioObjectius'
import ValoracioFesta from './valoracions/ValoracioFesta'
import ValoracioActivitats from './valoracions/ValoracioActivitats'
import ValoracioCooperatiu from './valoracions/ValoracioCooperatiu'

/**
 * Mòdul "Valoracions". Aquest fitxer només fa de contenidor: el curs
 * escolar, les pestanyes i el selector de què es valora. Cada pestanya viu
 * al seu component, dins de ./valoracions/, i s'ocupa de carregar i desar
 * les seves pròpies dades.
 */
export default function Documentacio() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [tipus, setTipus] = useState('cicle') // cicle · comissio · afa · festa · activitats · cooperatiu
  const [nom, setNom] = useState('')
  const [festaId, setFestaId] = useState('')
  const [cicleActivitats, setCicleActivitats] = useState('')
  const [nomsExistents, setNomsExistents] = useState([])
  const [configActiva, setConfigActiva] = useState(null)

  useEffect(() => {
    carregaNomsExistents()
    carregaConfigValoracions(cursEscolarId).then(setConfigActiva).catch(() => setConfigActiva(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carregaNomsExistents() {
    try {
      // El filtre per curs es fa a Firestore, no aquí: així no es baixen
      // les valoracions de tots els cursos per quedar-se'n amb un.
      const snap = await getDocs(query(collection(db, 'valoracions'), where('cursEscolar', '==', cursEscolarId)))
      setNomsExistents([...new Set(snap.docs.map((d) => d.data().nom).filter(Boolean))])
    } catch {
      setNomsExistents([])
    }
  }

  return (
    <div className="module">
      <h2>Valoracions</h2>

      <div>
        <p className="module-lead" style={{ maxWidth: '100%' }}>
          Cicles, comissions i equips, comissions mixtes (amb l'AFA), festes i celebracions, i
          activitats complementàries — tria la pestanya que et correspongui. Mateixa estructura
          que els fulls "Valoració ..." de sempre: Responsable, Membres, Objectius (amb
          Gener/Juny), i — quan calgui — "Actuacions" dins de cada objectiu, cadascuna amb el
          seu indicador d'avaluació. Cada canvi es desa sol.
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
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setTipus('cicle'); setNom('') }}
            className={tipus === 'cicle' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'cicle' ? { maxWidth: 200 } : { maxWidth: 200, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Cicles
          </button>
          <button
            type="button"
            onClick={() => { setTipus('comissio'); setNom('') }}
            className={tipus === 'comissio' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'comissio' ? { maxWidth: 240 } : { maxWidth: 240, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Comissions i equips
          </button>
          <button
            type="button"
            onClick={() => { setTipus('afa'); setNom('') }}
            className={tipus === 'afa' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'afa' ? { maxWidth: 220 } : { maxWidth: 220, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Comissions mixtes
          </button>
          <button
            type="button"
            onClick={() => { setTipus('festa'); setNom(''); setFestaId('') }}
            className={tipus === 'festa' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'festa' ? { maxWidth: 240 } : { maxWidth: 240, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Festes i celebracions
          </button>
          <button
            type="button"
            onClick={() => { setTipus('activitats'); setNom(''); setCicleActivitats('') }}
            className={tipus === 'activitats' ? 'btn-primary' : 'btn-ghost'}
            style={tipus === 'activitats' ? { maxWidth: 220 } : { maxWidth: 220, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          >
            Activitats complementàries
          </button>
          <button
            type="button"
            onClick={() => { setTipus('cooperatiu'); setNom('') }}
            className={tipus === 'cooperatiu' ? 'btn-primary' : 'btn-ghost'}
            style={{ maxWidth: 220 }}
          >
            Aprenentatge cooperatiu
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {/* L'aprenentatge cooperatiu és un de sol per curs: no hi ha res
              a triar i el selector no hi pinta res. */}
          {tipus === 'cooperatiu' ? null : tipus === 'cicle' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Cicle</span>
              <select
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria un cicle…</option>
                {CICLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'afa' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Comissió</span>
              <select
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria una comissió…</option>
                {/* Només les que direcció hagi deixat actives aquest curs, des
                    del Quadre de comandament. */}
                {(configActiva ? nomsActius(configActiva.mixtes) : NOMS_AFA)
                  .map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'activitats' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Cicle</span>
              <select
                value={cicleActivitats}
                onChange={(e) => setCicleActivitats(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria un cicle…</option>
                {CICLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'comissio' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Nom de la comissió / equip</span>
              <input
                type="text"
                list="noms-valoracio"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="p. ex. Comissió TAC, Equip LIC..."
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
              />
              <datalist id="noms-valoracio">
                {/* Les comissions mixtes i els cicles es desen a la mateixa
                    col·lecció, i per això sortien també aquí. Es treuen: cada
                    pestanya ha de suggerir només el que li pertoca. */}
                {suggerimentsComissions(configActiva, nomsExistents)
                  .map((n) => <option key={n} value={n} />)}
              </datalist>
            </label>
          ) : (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Festa</span>
              <select
                value={festaId}
                onChange={(e) => setFestaId(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria una festa…</option>
                {(configActiva?.festes ?? FESTES.map((f) => ({ ...f, activa: true })))
                  .filter((f) => f.activa !== false)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label ?? FESTES.find((x) => x.id === f.id)?.label ?? f.id}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>


        {tipus === 'cooperatiu' ? (
          <ValoracioCooperatiu cursEscolarId={cursEscolarId} />
        ) : tipus === 'festa' ? (
          <ValoracioFesta
            cursEscolarId={cursEscolarId}
            festaId={festaId}
            etiquetaFesta={configActiva?.festes.find((f) => f.id === festaId)?.label}
          />
        ) : tipus === 'activitats' ? (
          <ValoracioActivitats cursEscolarId={cursEscolarId} cicleActivitats={cicleActivitats} />
        ) : (
          <ValoracioObjectius
            cursEscolarId={cursEscolarId}
            tipus={tipus}
            nom={nom}
            onDesat={carregaNomsExistents}
          />
        )}
      </div>
    </div>
  )
}

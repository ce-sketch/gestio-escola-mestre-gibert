import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import {
  PROVES, classesDeLaProva, classesActives, ambClasse, ambTotesLesClasses,
  copiaMoment, resumExclusions,
} from '../../../lib/provesActives'

/**
 * Quines classes passen cada prova, i en quin moment.
 *
 * Existeix perquè això canvia d'un curs a l'altre i no es pot deixar
 * escrit al codi: ara la lectoescriptura només la fa I5, a 1r no passen
 * les proves fins al tercer trimestre, i un any qualsevol una classe pot
 * quedar-se sense fer-ne una. Sense poder-ho dir, la matriu del PGA marca
 * en vermell coses que no s'han de fer, i el vermell deixa de voler dir
 * res.
 *
 * Es desa per curs escolar. Per defecte les passen TOTES les classes a
 * qui la prova s'adreça: qui no configuri res ho veurà tot.
 */
export default function ConfiguracioProves() {
  const [classes, setClasses] = useState([])
  const [config, setConfig] = useState(null)
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [error, setError] = useState(null)
  const [obert, setObert] = useState(null)

  const cursEscolarId = cursEscolarActual()

  useEffect(() => {
    async function carrega() {
      setCarregant(true)
      setError(null)
      try {
        const [snapAlumnes, snapConfig] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDoc(doc(db, 'provesActives', cursEscolarId)),
        ])
        setClasses([...new Set(snapAlumnes.docs.map((d) => d.data().curs).filter(Boolean))].sort(
          (a, b) => a.localeCompare(b, 'ca', { numeric: true })
        ))
        setConfig(snapConfig.exists() ? snapConfig.data() : { exclusions: {} })
      } catch (err) {
        setError(err.message)
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [cursEscolarId])

  /** Desa de seguida: és un clic i no té sentit demanar després un botó. */
  async function desa(nova) {
    const anterior = config
    setConfig(nova) // resposta immediata; si falla, es desfà
    setDesant(true)
    setError(null)
    try {
      await setDoc(doc(db, 'provesActives', cursEscolarId), {
        cursEscolar: cursEscolarId,
        exclusions: nova.exclusions ?? {},
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      }, { merge: true })
    } catch (err) {
      setConfig(anterior)
      setError(`No s'ha pogut desar: ${err.message}`)
    } finally {
      setDesant(false)
    }
  }

  const resum = useMemo(() => resumExclusions(config, classes), [config, classes])

  if (carregant) return <p className="nota">Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Quines classes passen cada prova aquest curs ({cursEscolarId}), i en quin moment.
        Una classe desmarcada <strong>no compta enlloc</strong>: ni als resums ni al quadre de
        comandament, i per tant no surt en vermell com si hi faltessin dades.
      </p>
      <p className="nota">
        Per defecte les passen totes les classes a qui la prova s&apos;adreça, així que només
        cal tocar-hi el que sigui una excepció. Els canvis es desen sols.
      </p>

      {error && <p className="nota nota-error">{error}</p>}

      {classes.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          No consta cap classe amb alumnes actius aquest curs.
        </p>
      )}

      {PROVES.map((prova) => {
        const candidates = classesDeLaProva(prova, classes)
        const r = resum.find((x) => x.prova.id === prova.id)
        const desplegat = obert === prova.id
        return (
          <div key={prova.id} style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
            <button
              type="button"
              onClick={() => setObert(desplegat ? null : prova.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 8,
                alignItems: 'center', fontSize: 13, fontWeight: 600,
              }}
            >
              <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{desplegat ? '▾' : '▸'}</span>
              {prova.nom}
              <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--ink-soft)' }}>
                {candidates.length === 0
                  ? 'cap classe d\'aquests nivells'
                  : r?.ambExclusions > 0
                    ? `${candidates.length} classes · ${r.ambExclusions} amb alguna excepció`
                    : `${candidates.length} classes · totes la passen`}
              </span>
            </button>

            {desplegat && candidates.length > 0 && (
              <div style={{ padding: '0 12px 12px' }}>
                {prova.moments.map((moment, i) => {
                  const actives = classesActives(config, prova.id, moment.id, classes)
                  return (
                    <div key={moment.id} style={{ marginTop: 10, paddingTop: 8, borderTop: i > 0 ? '1px dashed var(--line)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <strong style={{ fontSize: 12 }}>{moment.label}</strong>
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                          {actives.length} de {candidates.length}
                        </span>
                        <button type="button" disabled={desant} className="btn-ghost"
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => desa(ambTotesLesClasses(config, prova.id, moment.id, classes, true))}>
                          Totes
                        </button>
                        <button type="button" disabled={desant} className="btn-ghost"
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => desa(ambTotesLesClasses(config, prova.id, moment.id, classes, false))}>
                          Cap
                        </button>
                        {/* El cas més freqüent és que 1r no passi la prova
                            fins al tercer trimestre: marcar-ho moment per
                            moment seria repetitiu. */}
                        {i > 0 && (
                          <button type="button" disabled={desant} className="btn-ghost"
                            style={{ fontSize: 10, padding: '2px 8px' }}
                            onClick={() => desa(copiaMoment(config, prova.id, prova.moments[i - 1].id, moment.id))}>
                            Igual que «{prova.moments[i - 1].label}»
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {candidates.map((classe) => {
                          const laPassa = actives.includes(classe)
                          return (
                            <label key={classe} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={laPassa}
                                disabled={desant}
                                onChange={(e) => desa(ambClasse(config, prova.id, moment.id, classe, e.target.checked))}
                              />
                              {classe}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <p className="nota" style={{ marginTop: 18 }}>
        Cada prova fa servir el vocabulari del document d&apos;on surt, i no s&apos;unifica
        perquè no són el mateix: el <strong>TEE</strong> i les <strong>notes per àrea</strong> es
        qualifiquen per trimestres; la <strong>lectura (VL/CL)</strong> es mesura en tres moments
        de l&apos;any (Eina d&apos;avaluació); l&apos;<strong>Innovamat</strong> passa les proves
        a l&apos;inici i al final de curs.
      </p>
    </div>
  )
}

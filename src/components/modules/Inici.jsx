import { useEffect, useState } from 'react'
import { carregaVersions, desaVersio, restauraVersio } from '../../lib/versions'
import { nomAmbData } from '../../lib/cursEscolar'
import { cerca } from '../../lib/cercaApp'

export default function Inici({ onNavigate, admin, modulsVisibles }) {
  const today = new Date().toLocaleDateString('ca-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const [consulta, setConsulta] = useState('')
  const [nomVersio, setNomVersio] = useState('')
  const [versions, setVersions] = useState([])
  const [carregantVersions, setCarregantVersions] = useState(true)
  const [desant, setDesant] = useState(false)
  const [restaurant, setRestaurant] = useState(null)
  const [confirmaRestaura, setConfirmaRestaura] = useState({})
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    if (!admin) return
    carregaVersions().then(setVersions).finally(() => setCarregantVersions(false))
  }, [admin])

  async function guardaVersio() {
    setDesant(true)
    setMissatge(null)
    try {
      const n = await desaVersio(nomVersio)
      setNomVersio('')
      setVersions(await carregaVersions())
      setMissatge({ type: 'ok', text: `Còpia desada (${n} alumnes).` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  async function recuperaVersio(versio) {
    setRestaurant(versio.id)
    setMissatge(null)
    try {
      const n = await restauraVersio(versio)
      setConfirmaRestaura((prev) => ({ ...prev, [versio.id]: '' }))
      setMissatge({ type: 'ok', text: `Restaurat a "${versio.nom}" (${n} alumnes).` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut restaurar: ${err.message}` })
    } finally {
      setRestaurant(null)
    }
  }

  // Ordenats alfabèticament: amb una quinzena de mòduls, l'ordre en què
  // es van anar creant ja no ajuda ningú a trobar-los.
  const modulsPerTargetes = (modulsVisibles ?? [])
    .filter((m) => m.id !== 'inici')
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label, 'ca'))

  const resultats = cerca(consulta, modulsPerTargetes)

  return (
    <div className="module">
      <p className="module-eyebrow">{capitalize(today)}</p>
      <h2>Benvingut/da</h2>
      <p className="module-lead">
        Aquest és el punt de partida de l'eina de gestió del centre. Fes servir el menú, o els
        botons de sota, per moure't entre els mòduls.
      </p>

      <div style={{ marginTop: 20, maxWidth: 460 }}>
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Busca: festes, ajuts menjador, velocitat lectora…"
          aria-label="Busca dins de l'aplicació"
          style={{
            width: '100%', border: '1px solid var(--line)', borderRadius: 10,
            padding: '10px 14px', fontSize: 14,
          }}
        />
        {consulta.trim().length >= 2 && (
          resultats.length === 0 ? (
            <p className="nota">No hi ha res que coincideixi amb «{consulta}».</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
              {resultats.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => { onNavigate?.(r.modul); setConsulta('') }}
                    style={{
                      width: '100%', textAlign: 'left', background: 'transparent',
                      border: 'none', borderBottom: '1px solid var(--line)',
                      padding: '8px 4px', cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    {r.titol}
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>{r.subtitol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="card-grid" style={{ marginTop: 20 }}>
        {modulsPerTargetes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onNavigate?.(m.id)}
            className="info-card"
            style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: '#fff' }}
          >
            <h3>{m.label}</h3>
            <p>Obre el mòdul de {m.label.toLowerCase()}.</p>
          </button>
        ))}
      </div>

      {admin && (
        <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
          <p className="module-eyebrow" style={{ marginTop: 0 }}>Còpies ràpides</p>
          <h3 style={{ marginTop: 4, fontSize: 18 }}>Desa o recupera una versió</h3>
          <p className="module-lead">
            Desa una instantània de la llista d'alumnes (útil abans de fer proves) o recupera'n
            una d'anterior. Si no hi poses cap nom, es desa amb la data i l'hora d'aquest moment.
            Per a la còpia de seguretat completa (assistència, avaluació…), fes servir el mòdul
            "Backup".
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={nomVersio}
              onChange={(e) => setNomVersio(e.target.value)}
              placeholder={nomAmbData()}
              title="Si el deixes buit, la còpia es desa amb la data i l'hora d'ara"
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', minWidth: 220 }}
            />
            <button type="button" className="btn-primary" style={{ maxWidth: 200 }} onClick={guardaVersio} disabled={desant}>
              {desant ? 'Desant…' : '💾 Desa una còpia'}
            </button>
          </div>

          {missatge && (
            <p style={{ marginTop: 10, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
              {missatge.text}
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            {carregantVersions ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Carregant versions…</p>
            ) : versions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Encara no hi ha cap còpia desada.</p>
            ) : (
              <ul className="roster" style={{ marginTop: 0 }}>
                {versions.map((v) => (
                  <li key={v.id} className="roster-row" style={{ display: 'block', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span>
                        <strong>{v.nom}</strong>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>
                          {v.comptadors?.alumnes ?? '?'} alumnes
                          {v.creatEl?.seconds && (
                            <> · desada el {new Date(v.creatEl.seconds * 1000).toLocaleString('ca-ES', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}</>
                          )}
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={confirmaRestaura[v.id] ?? ''}
                          onChange={(e) => setConfirmaRestaura((prev) => ({ ...prev, [v.id]: e.target.value }))}
                          placeholder="RESTAURA"
                          style={{ border: '1px solid var(--red)', borderRadius: 6, padding: '4px 6px', fontSize: 12, width: 100 }}
                        />
                        <button
                          type="button"
                          onClick={() => recuperaVersio(v)}
                          disabled={confirmaRestaura[v.id] !== 'RESTAURA' || restaurant === v.id}
                          style={{
                            background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 6,
                            padding: '5px 10px', fontSize: 12, fontWeight: 600,
                            cursor: confirmaRestaura[v.id] === 'RESTAURA' ? 'pointer' : 'not-allowed',
                            opacity: confirmaRestaura[v.id] === 'RESTAURA' ? 1 : 0.5,
                          }}
                        >
                          {restaurant === v.id ? 'Restaurant…' : 'Restaura'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

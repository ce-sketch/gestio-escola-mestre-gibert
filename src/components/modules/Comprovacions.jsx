import { useMemo, useState } from 'react'
import { executaComprovacions } from '../../lib/comprovacions'

export default function Comprovacions() {
  const [torn, setTorn] = useState(0)
  // `torn` no s'usa dins d'executaComprovacions(): és a posta, només
  // perquè canviar-lo (el botó "Torna a comprovar") forci un recàlcul.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grups = useMemo(() => executaComprovacions(), [torn])

  const totes = grups.flatMap((g) => g.proves)
  const avisos = totes.filter((p) => p.avis)
  const reals = totes.filter((p) => !p.avis)
  const fallen = reals.filter((p) => !p.ok)

  return (
    <div className="module">
      <p className="module-eyebrow">Eina interna</p>
      <h2>Comprovacions</h2>
      <p className="module-lead">
        Els càlculs de l'app s'han de comportar igual que els fulls originals del centre. Aquesta
        pantalla ho verifica cada vegada que s'obre. Si algun dia una d'aquestes línies es posa
        vermella, vol dir que un canvi ha trencat un càlcul que abans anava bé.
      </p>

      <div
        style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 10,
          background: fallen.length === 0 ? 'var(--green-soft, #EAF5EE)' : '#FBEAEA',
          border: `1px solid ${fallen.length === 0 ? 'var(--green)' : 'var(--red)'}`,
        }}
      >
        <strong style={{ color: fallen.length === 0 ? 'var(--green)' : 'var(--red)' }}>
          {fallen.length === 0
            ? `Les ${reals.length} comprovacions passen.`
            : `${fallen.length} de ${reals.length} comprovacions fallen.`}
        </strong>
        {avisos.length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--amber-dark)', marginTop: 4 }}>
            I hi ha {avisos.length} punt{avisos.length === 1 ? '' : 's'} pendent
            {avisos.length === 1 ? '' : 's'} de confirmar amb els fulls del centre.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setTorn((t) => t + 1)}
        className="btn-ghost"
        style={{ marginTop: 12, color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 180, fontSize: 13 }}
      >
        Torna-les a passar
      </button>

      {grups.map((grup) => (
        <div key={grup.titol} style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 15 }}>{grup.titol}</h3>
          {grup.proves.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '8px 0', borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  fontSize: 14, lineHeight: '20px',
                  color: p.avis ? 'var(--amber-dark)' : p.ok ? 'var(--green)' : 'var(--red)',
                }}
              >
                {p.avis ? '!' : p.ok ? '✔' : '✘'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{p.nom}</div>
                {!p.ok && (
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    esperat: <strong>{JSON.stringify(p.esperat)}</strong> · obtingut:{' '}
                    <strong>{JSON.stringify(p.obtingut)}</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

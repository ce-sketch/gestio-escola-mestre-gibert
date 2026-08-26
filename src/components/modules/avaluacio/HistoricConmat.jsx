import {
  entradesHistoric, distribucioPerNivell, agrupaPerProva, momentLabel, MOMENTS,
} from '../../../lib/historicInnovamat'

/**
 * L'històric del ConMat: la prova d'Innovamat de 3r a 6è.
 *
 * Separat del COSMOS (vegeu HistoricCosmos.jsx) perquè són proves amb
 * escales diferents — quatre nivells aquí, tres allà — i alumnat
 * diferent. Aquí és on tenen sentit les "Referències d'Innovamat", que es
 * copien a mà de la pàgina 4 de l'informe: els seus quatre nivells són
 * els del ConMat i al COSMOS no hi encaixarien.
 *
 * Les dades les carrega el component pare (HistoricInnovamat) i les passa
 * per props, perquè la col·lecció "matematiques" es llegeixi una sola
 * vegada per a les dues pestanyes.
 */
const NIVELLS = ['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt']

export default function HistoricConmat({ registres, refs, esborrant, onEsborraInforme, capcalera }) {
  const entrades = entradesHistoric(registres)
  const informes = registres.filter((r) => r.tipus === 'informe')
  const cursos = [...new Set(entrades.map((e) => e.cursEscolar))].sort().reverse()

  if (entrades.length === 0) {
    return (
      <div>
        {capcalera}
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 20 }}>
          Encara no hi ha cap resultat de ConMat desat. Es carreguen des de la caixa de dalt,
          amb els PDF que envia l&apos;Innovamat (un per classe de 3r a 6è).
        </p>
      </div>
    )
  }

  return (
    <div>
      {capcalera}
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 20 }}>
        {entrades.length} resultats de ConMat desats, de {cursos.length} curs{cursos.length === 1 ? '' : 'os'}
        {cursos.length > 0 && ` (${cursos.join(', ')})`}.
      </p>


      {/* ── Informes carregats ─────────────────────────────────── */}
      <h3 style={{ fontSize: 15, marginTop: 24 }}>Informes carregats</h3>
      {informes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          No consta cap informe carregat des que es registren. Els resultats dels alumnes sí que
          hi són a l'històric de sota.
        </p>
      ) : (
        <table className="taula-dades" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Curs</th>
              <th>Classe</th>
              <th>Moment</th>
              <th>Alumnes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {informes
              .sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
              .map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td>{r.cursEscolar}</td>
                  <td>{r.classe}</td>
                  <td>{momentLabel(r.moment)}</td>
                  <td>
                    {r.alumnesCasats}
                    {r.alumnesSenseCasar > 0 && (
                      <span style={{ color: 'var(--ink-soft)' }}> (+{r.alumnesSenseCasar} amb nom de l'informe)</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onEsborraInforme(r.cursEscolar, r.classe, r.moment)}
                      disabled={esborrant}
                      style={{ background: 'none', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Desfés
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {/* ── Evolució del centre ────────────────────────────────────
          Una fila per curs, com a l'històric de TEE i VL/CL: és la
          vista que serveix per veure la tendència d'un cop d'ull. */}
      <h3 style={{ fontSize: 15, marginTop: 28 }}>Evolució del centre</h3>
      {MOMENTS.map((m) => {
        const delMoment = entrades.filter((e) => e.moment === m.id)
        if (delMoment.length === 0) return null
        const cursosDelMoment = [...new Set(delMoment.map((e) => e.cursEscolar))].sort().reverse()
        return (
          <div key={m.id} style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', margin: '0 0 6px' }}>
              {m.label}
            </p>
            <div className="taula-scroll">
              <table className="taula-dades">
                <thead>
                  <tr>
                    <th>Curs</th>
                    {NIVELLS.map((n) => <th key={n} className="num">{n}</th>)}
                    <th className="num">Avaluats</th>
                    <th>Nivells</th>
                  </tr>
                </thead>
                <tbody>
                  {cursosDelMoment.map((c) => {
                    const delCurs = delMoment.filter((e) => e.cursEscolar === c)
                    const dist = distribucioPerNivell(delCurs)
                    // Quins nivells de primària hi ha en aquell curs
                    // (3-4-5-6 si hi són tots), tret de la lletra de classe.
                    const nivells = [...new Set(delCurs
                      .map((e) => String(e.classe ?? '').replace(/[A-D]$/i, '').replace(/[^0-9]/g, ''))
                      .filter(Boolean))].sort().join('-')
                    return (
                      <tr key={c}>
                        <td>{c}</td>
                        {NIVELLS.map((n) => {
                          const f = dist.files.find((x) => x.nivell === n)
                          return (
                            <td key={n} className="num">
                              <strong>{f?.alumnes ?? 0}</strong>
                              <span style={{ color: 'var(--ink-soft)' }}> ({f?.percentatge ?? 0}%)</span>
                            </td>
                          )
                        })}
                        <td className="num">
                          {dist.total}
                          {dist.noAvaluats > 0 && (
                            <span style={{ color: 'var(--ink-soft)' }}> (+{dist.noAvaluats} sense fer la prova)</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--ink-soft)' }}>{nivells || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* ── Resultats per prova ────────────────────────────────── */}
      <h3 style={{ fontSize: 15, marginTop: 28 }}>Resultats per prova</h3>
      {agrupaPerProva(entrades).map((grup) => {
        const dist = distribucioPerNivell(grup.entrades)
        const nSense = grup.entrades.filter((e) => e.sensCasar).length
        return (
          <div key={`${grup.cursEscolar}-${grup.moment}`} style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
              {grup.cursEscolar} · {momentLabel(grup.moment)}
              <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                {' '}— {dist.total} avaluats
                {dist.noAvaluats > 0 && `, ${dist.noAvaluats} sense fer la prova`}
                {nSense > 0 && `, ${nSense} amb el nom de l'informe (ja no són al centre)`}
              </span>
            </p>
            {/* Una fila per classe, com al resum de TEE i VL/CL. Les
                classes surten de les dades: si un curs tenia altres
                grups, hi apareixen igualment. */}
            <table className="taula-dades" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Classe</th>
                  {NIVELLS.map((n) => <th key={n} className="num">{n}</th>)}
                  <th className="num">Total avaluats</th>
                </tr>
              </thead>
              <tbody>
                {[...new Set(grup.entrades.map((e) => e.classe).filter(Boolean))].sort().map((classe) => {
                  const dEls = distribucioPerNivell(grup.entrades.filter((e) => e.classe === classe))
                  return (
                    <tr key={classe}>
                      <td>{classe}</td>
                      {NIVELLS.map((n) => (
                        <td key={n} className="num">
                          {dEls.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                        </td>
                      ))}
                      <td className="num">
                        <strong>{dEls.total}</strong>
                        {dEls.noAvaluats > 0 && (
                          <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> (+{dEls.noAvaluats})</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td>ConMat — TOTAL</td>
                  {NIVELLS.map((n) => (
                    <td key={n} className="num">
                      {dist.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                    </td>
                  ))}
                  <td className="num">
                    {dist.total}
                    {dist.noAvaluats > 0 && (
                      <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> (+{dist.noAvaluats})</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="taula-dades">
              <thead>
                <tr style={{ color: 'var(--ink-soft)', textAlign: 'right' }}>
                  <th>Nivell</th>
                  <th>Alumnes</th>
                  <th>Centre</th>
                  <th>Catalunya</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {dist.files.map((f) => {
                  // Les referències es desen per nivell de primària (3r, 4t...),
                  // no per classe: es busca pel primer tros del nom de la classe.
                  const nivellCurs = String(grup.entrades[0]?.classe ?? '').replace(/[A-D]$/i, '')
                  const cat = refs[`${grup.cursEscolar}__${grup.moment}__${nivellCurs}__catalunya`]?.[f.nivell]
                  const tot = refs[`${grup.cursEscolar}__${grup.moment}__${nivellCurs}__total`]?.[f.nivell]
                  return (
                    <tr key={f.nivell}>
                      <td>{f.nivell}</td>
                      <td className="num">{f.alumnes}</td>
                      <td className="num">{f.percentatge}%</td>
                      <td className="num">
                        {cat != null ? `${cat}%` : '—'}
                      </td>
                      <td className="num">
                        {tot != null ? `${tot}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

import {
  entradesCosmos, distribucioCosmos, evolucioCosmos, NIVELLS_COSMOS, MOMENTS_COSMOS,
} from '../../../lib/historicInnovamat'

/**
 * L'històric del COSMOS: la prova d'Innovamat de 1r i 2n.
 *
 * Va separat del ConMat i no barrejat amb ell perquè són proves
 * diferents: el COSMOS es mesura amb TRES nivells de rendiment
 * (Baix/Mitjà/Alt) i el ConMat amb QUATRE, i no es passen al mateix
 * alumnat (COSMOS a cicle inicial, ConMat de 3r en amunt). Sumar-los
 * donaria xifres que no volen dir res.
 *
 * L'altra diferència que es nota aquí: al COSMOS el mateix alumne fa la
 * prova inicial i la final dins del mateix curs, així que té sentit
 * mesurar qui canvia de nivell entre l'una i l'altra — cosa que al
 * ConMat no es pot fer igual.
 *
 * Les dades les carrega el component pare (HistoricInnovamat) i les passa
 * per props: així la col·lecció "matematiques" es llegeix una sola vegada
 * per a les dues pestanyes.
 */
export default function HistoricCosmos({ registres, esborrant, onEsborraCosmos }) {
  const entradesCos = entradesCosmos(registres)
  const cursosCos = [...new Set(entradesCos.map((e) => e.cursEscolar))].sort().reverse()

  // A diferència del ConMat, el COSMOS no desa cap document d'"informe":
  // la llista de càrregues es dedueix dels mateixos resultats, agrupats
  // per curs i classe.
  const carreguesCos = []
  for (const curs of cursosCos) {
    const delCurs = entradesCos.filter((e) => e.cursEscolar === curs)
    for (const classe of [...new Set(delCurs.map((e) => e.classe))].sort()) {
      const dels = delCurs.filter((e) => e.classe === classe)
      carreguesCos.push({
        cursEscolar: curs,
        classe,
        total: dels.length,
        sensCasar: dels.filter((e) => e.sensCasar).length,
        noAvaluats: dels.filter((e) => e.noAvaluat).length,
      })
    }
  }

  if (entradesCos.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 20 }}>
        Encara no hi ha cap resultat de COSMOS desat. Es carreguen des de la caixa de dalt,
        amb els CSV que envia l&apos;Innovamat (un per classe de 1r i 2n).
      </p>
    )
  }

  return (
    <div>

      {/* ── Informes carregats ─────────────────────────────────── */}
      <h3 style={{ fontSize: 15, marginTop: 20 }}>Informes carregats</h3>
      <table className="taula-dades" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--ink-soft)' }}>
            <th>Curs</th>
            <th>Classe</th>
            <th>Alumnes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {carreguesCos.map((c) => (
            <tr key={`${c.cursEscolar}__${c.classe}`}>
              <td>{c.cursEscolar}</td>
              <td>{c.classe ?? <em style={{ color: 'var(--ink-soft)' }}>sense classe</em>}</td>
              <td>
                {c.total}
                {c.noAvaluats > 0 && (
                  <span style={{ color: 'var(--ink-soft)' }}> ({c.noAvaluats} sense fer la prova)</span>
                )}
                {c.sensCasar > 0 && (
                  <span style={{ color: 'var(--ink-soft)' }}> (+{c.sensCasar} amb nom del CSV)</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => onEsborraCosmos(c.cursEscolar, c.classe)}
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

      {/* ── Evolució del centre ────────────────────────────────── */}
      <h3 style={{ fontSize: 15, marginTop: 28 }}>Evolució del centre</h3>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
        El rendiment de la prova final de cada curs, i quants alumnes canvien de nivell
        entre la prova inicial i la final del mateix curs.
      </p>
      <table className="taula-dades" style={{ fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--ink-soft)' }}>
            <th>Curs</th>
            {NIVELLS_COSMOS.map((n) => <th key={n} style={{ textAlign: 'right' }}>{n}</th>)}
            <th style={{ textAlign: 'right' }}>Avaluats</th>
            <th style={{ textAlign: 'right' }}>Milloren</th>
            <th style={{ textAlign: 'right' }}>Es mantenen</th>
            <th style={{ textAlign: 'right' }}>Baixen</th>
          </tr>
        </thead>
        <tbody>
          {cursosCos.map((curs) => {
            const delCurs = entradesCos.filter((e) => e.cursEscolar === curs)
            const dist = distribucioCosmos(delCurs, 'final')
            const evo = evolucioCosmos(delCurs)
            return (
              <tr key={curs}>
                <td><strong>{curs}</strong></td>
                {NIVELLS_COSMOS.map((n) => {
                  const f = dist.files.find((x) => x.nivell === n)
                  return (
                    <td key={n} className="num">
                      {f.alumnes}
                      <span style={{ color: 'var(--ink-soft)' }}> ({f.percentatge}%)</span>
                    </td>
                  )
                })}
                <td className="num">
                  {dist.total}
                  {dist.noAvaluats > 0 && (
                    <span style={{ color: 'var(--ink-soft)' }}> (+{dist.noAvaluats} sense fer la prova)</span>
                  )}
                </td>
                <td className="num">{evo.milloren}</td>
                <td className="num">{evo.mantenen}</td>
                <td className="num">{evo.baixen}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── Resultats per prova ────────────────────────────────── */}
      <h3 style={{ fontSize: 15, marginTop: 28 }}>Resultats per prova</h3>
      {cursosCos.map((curs) => {
        const delCurs = entradesCos.filter((e) => e.cursEscolar === curs)
        const classes = [...new Set(delCurs.map((e) => e.classe))].sort()
        return MOMENTS_COSMOS.map((moment) => {
          const dist = distribucioCosmos(delCurs, moment.id)
          // Un moment sense cap resultat no aporta res: si encara no
          // s'ha fet la prova final, no cal ensenyar una taula de zeros.
          if (dist.total === 0) return null
          return (
            <div key={`${curs}__${moment.id}`} style={{ marginTop: 18 }}>
              <strong style={{ fontSize: 13 }}>
                {curs} · {moment.label}
                <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                  {' '}— {dist.total} avaluats
                  {dist.noAvaluats > 0 && `, ${dist.noAvaluats} sense fer la prova`}
                </span>
              </strong>
              <table className="taula-dades" style={{ fontSize: 12, marginTop: 6 }}>
                <thead>
                  <tr style={{ color: 'var(--ink-soft)' }}>
                    <th>Classe</th>
                    {NIVELLS_COSMOS.map((n) => <th key={n} style={{ textAlign: 'right' }}>{n}</th>)}
                    <th style={{ textAlign: 'right' }}>Total avaluats</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((classe) => {
                    const d = distribucioCosmos(delCurs.filter((e) => e.classe === classe), moment.id)
                    return (
                      <tr key={classe}>
                        <td>{classe ?? 'sense classe'}</td>
                        {NIVELLS_COSMOS.map((n) => (
                          <td key={n} className="num">
                            {d.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                          </td>
                        ))}
                        <td className="num">
                          <strong>{d.total}</strong>
                          {d.noAvaluats > 0 && (
                            <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> (+{d.noAvaluats})</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ fontWeight: 700 }}>
                    <td>COSMOS — TOTAL</td>
                    {NIVELLS_COSMOS.map((n) => (
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

              <table className="taula-dades" style={{ fontSize: 12, marginTop: 6, maxWidth: 320 }}>
                <thead>
                  <tr style={{ color: 'var(--ink-soft)' }}>
                    <th>Rendiment</th>
                    <th style={{ textAlign: 'right' }}>Alumnes</th>
                    <th style={{ textAlign: 'right' }}>Centre</th>
                  </tr>
                </thead>
                <tbody>
                  {dist.files.map((f) => (
                    <tr key={f.nivell}>
                      <td>{f.nivell}</td>
                      <td className="num">{f.alumnes}</td>
                      <td className="num">{f.percentatge}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      })}
    </div>
  )
}

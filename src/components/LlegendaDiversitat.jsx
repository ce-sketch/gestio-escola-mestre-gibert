import { LLEGENDA_DIVERSITAT } from '../lib/atencioDiversitat'

/** La llegenda de colors d'Atenció a la diversitat, per posar-la a sobre
 *  de qualsevol taula d'alumnes que faci servir `colorDiversitat()` per
 *  destacar les files (TEE, VL/CL, Lectoescriptura…). Un sol lloc perquè
 *  els colors i les etiquetes surtin sempre iguals, siguin quina siguin
 *  la pantalla. */
export default function LlegendaDiversitat() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, marginBottom: 4, fontSize: 12 }}>
      {LLEGENDA_DIVERSITAT.map((c) => (
        <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14, height: 14, borderRadius: 3, background: c.color,
              display: 'inline-block', border: '1px solid rgba(0,0,0,0.2)',
            }}
          />
          {c.label}
        </span>
      ))}
    </div>
  )
}

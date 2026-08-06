export default function Documentacio() {
  return (
    <div className="module">
      <p className="module-eyebrow">Mòdul en construcció</p>
      <h2>Documentació</h2>
      <p className="module-lead">
        Aquí es guardaran els documents de cada alumne (autoritzacions, informes, certificats).
        Els fitxers s'emmagatzemaran a Cloudflare R2, i cada document quedarà enllaçat a
        l'alumne corresponent sense afectar la resta de mòduls.
      </p>
      <div className="placeholder-box">
        Properament: pujada de documents, categorització per tipus i cerca per alumne.
      </div>
    </div>
  )
}

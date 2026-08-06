// URL del Cloudflare Worker que envia els correus d'avís. Queda buit fins que
// el desplegueu (vegeu worker-avisos/README.md al projecte). Mentre estigui
// buit, el botó d'enviar avisos mostrarà un missatge clar en lloc de fallar
// en sec.
export const WORKER_AVISOS_URL = 'https://avisos-escola-mestre-gibert.ce-723.workers.dev'

export async function enviaAvis({ destinataris, assumpte, cos }) {
  if (!WORKER_AVISOS_URL) {
    throw new Error(
      'Encara no s\'ha configurat el servei d\'enviament de correus (WORKER_AVISOS_URL a src/lib/email.js).'
    )
  }
  const res = await fetch(WORKER_AVISOS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: destinataris, subject: assumpte, html: cos }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`El servei de correu ha retornat un error (${res.status}). ${text}`)
  }
  return res.json().catch(() => ({}))
}

/**
 * Worker de Cloudflare que rep una petició de l'app amb els destinataris,
 * l'assumpte i el cos d'un correu, i el fa arribar fent servir Resend.
 *
 * La clau de Resend es guarda com a "secret" del Worker (mai al codi),
 * així que aquest fitxer es pot compartir sense por.
 */
export default {
  async fetch(request, env) {
    // Només accepta peticions POST amb JSON.
    if (request.method !== 'POST') {
      return new Response('Mètode no permès', { status: 405 })
    }

    // Restringeix qui pot cridar aquest Worker (evita que qualsevol pàgina
    // d'internet l'utilitzi per enviar correus en el vostre nom).
    const origen = request.headers.get('Origin') || ''
    if (env.ORIGEN_PERMES && origen !== env.ORIGEN_PERMES) {
      return new Response('Origen no autoritzat', { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response('JSON invàlid', { status: 400 })
    }

    const { to, subject, html } = body
    if (!Array.isArray(to) || to.length === 0 || !subject || !html) {
      return new Response('Falten camps (to, subject, html)', { status: 400 })
    }

    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.REMITENT || 'onboarding@resend.dev',
        to,
        subject,
        html,
      }),
    })

    if (!resposta.ok) {
      const errorText = await resposta.text()
      return new Response(`Error enviant el correu: ${errorText}`, { status: 502 })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

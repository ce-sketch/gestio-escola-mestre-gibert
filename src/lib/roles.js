// De moment, un únic compte administrador amb accés a tots els mòduls.
// Si més endavant calen més comptes amb aquest nivell d'accés, es pot
// convertir en una llista, o millor encara, en un camp a Firestore.
export const ADMIN_EMAIL = 'ce@escolamestregibert.cat'

export function esAdmin(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL
}

// El compte d'Educació Especial: no és administrador de tota l'app —no
// hauria de veure Economia, PGAC, Backup...—, però sí que necessita
// "Atenció a la diversitat". És una excepció puntual per a un sol mòdul,
// no un segon nivell d'administració.
export const EE_EMAIL = 'ee@escolamestregibert.cat'

export function esEE(user) {
  return user?.email?.toLowerCase() === EE_EMAIL
}

/** Comprova que el compte és de personal del centre: domini correcte i
 *  no és un compte d'alumnat (que comencen per "00", doble zero). */
export function esComptePersonal(user) {
  const email = user?.email ?? ''
  const [usuari, domini] = email.split('@')
  if (domini !== 'escolamestregibert.cat') return false
  if (usuari?.startsWith('00')) return false
  return true
}

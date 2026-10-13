/**
 * Le dernier membre à qui cet appareil a proposé un « vu à deux », par membre connecté : il vient en
 * premier dans le choix, et rien d'autre n'est mémorisé. Une commodité de l'appareil : illisible
 * (navigation privée, stockage bloqué), elle vaut « personne », et la liste garde l'ordre servi.
 */
const cle = (moi: string) => `journal.feuilleton.vu-a-deux.dernier.${moi}`

export function lireLeDernierChoisi(moi: string): string | null {
  try {
    return localStorage.getItem(cle(moi))
  } catch {
    return null
  }
}

export function noterLeDernierChoisi(moi: string, membre: string): void {
  try {
    localStorage.setItem(cle(moi), membre)
  } catch {
    // Sans stockage, le choix n'est pas retenu : rien d'autre ne change.
  }
}

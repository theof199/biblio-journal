/**
 * La dernière année en cours que cet appareil a montrée sur la carte, par membre : c'est d'elle
 * que l'avatar repart quand le ticket a été utilisé ailleurs (la fiche, un autre appareil). Une
 * commodité de l'appareil : illisible (navigation privée, stockage bloqué), elle vaut « jamais
 * vue », et la carte s'ouvre sans rejouer de marche.
 */
const cle = (membre: string) => `journal.carte.annee-vue.${membre}`

export function lireAnneeVue(membre: string): number | null {
  try {
    const brut = localStorage.getItem(cle(membre))
    const n = brut === null ? NaN : Number(brut)
    return Number.isInteger(n) ? n : null
  } catch {
    return null
  }
}

export function ecrireAnneeVue(membre: string, annee: number): void {
  try {
    localStorage.setItem(cle(membre), String(annee))
  } catch {
    // Sans stockage, la prochaine ouverture ne rejouera simplement pas la marche.
  }
}

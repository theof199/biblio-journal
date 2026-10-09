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

/**
 * Le réglage du son (plan 2d), par membre : vrai quand le membre l'a laissé allumé. Il ne rallume
 * rien de lui-même (seul le bouton « Son » crée le son) ; il dit seulement au bouton de proposer
 * de le reprendre. Illisible : coupé.
 */
const cleDuSon = (membre: string) => `journal.carte.son.${membre}`

export function lireSon(membre: string): boolean {
  try {
    return localStorage.getItem(cleDuSon(membre)) === 'allume'
  } catch {
    return false
  }
}

export function ecrireSon(membre: string, allume: boolean): void {
  try {
    localStorage.setItem(cleDuSon(membre), allume ? 'allume' : 'coupe')
  } catch {
    // Sans stockage, le son se coupe simplement au prochain chargement, comme par défaut.
  }
}

/**
 * Les bobines perdues trouvées sur cet appareil (plan 2d), par membre, par leur clé
 * (`BobinePerdue.cle`). Illisible ou abîmé : aucune, et elles se ramassent de nouveau. **Elles ne
 * font foi qu'en 1890** : là où la carte lit l'état du voyageur, le compte fait foi, et ce stockage
 * n'est plus que ce qui reste à lui verser (`voyage/bobines.ts`, seul lecteur de ces deux fonctions).
 */
const cleDesBobines = (membre: string) => `journal.carte.bobines.${membre}`

export function lireBobines(membre: string): string[] {
  try {
    const brut: unknown = JSON.parse(localStorage.getItem(cleDesBobines(membre)) ?? '[]')
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function ecrireBobines(membre: string, cles: readonly string[]): void {
  try {
    localStorage.setItem(cleDesBobines(membre), JSON.stringify(cles))
  } catch {
    // Sans stockage, la trouvaille vaut pour cette visite seulement.
  }
}

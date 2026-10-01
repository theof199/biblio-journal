/**
 * Ce que le membre a posé au guichet (la saisie, les années cochées), retenu sous l'entrée
 * d'historique qui l'affiche (`location.key`) : revenir d'une fiche de film par le geste « retour »
 * retrouve la même entrée, donc le même guichet, et la coque y repose la position
 * (`coque/defilement.ts`) ; une navigation nouvelle vers le guichet tire une clé neuve, donc un
 * guichet vide.
 *
 * Pourquoi pas l'adresse : chaque navigation, `replace` compris, tire une clé neuve, et la coque
 * ramène alors la page en haut ; une lettre tapée la ferait sauter. Pourquoi `sessionStorage` : il
 * survit au rechargement de l'onglet (Android tue une PWA en arrière-plan, l'historique et ses clés
 * restent), et meurt avec lui. Illisible ou refusé (navigation privée) : le guichet part vide.
 */
export interface EtatDuGuichet {
  saisie: string
  annees: number[]
}

const VIDE: EtatDuGuichet = { saisie: '', annees: [] }

const cle = (entree: string, decennie: number) => `journal:guichet:${decennie}:${entree}`

/** Le guichet retenu sous cette entrée, vide s'il n'y en a pas ou s'il ne se lit pas. */
export function relireLeGuichet(entree: string, decennie: number): EtatDuGuichet {
  try {
    const brut = window.sessionStorage.getItem(cle(entree, decennie))
    if (!brut) return VIDE
    const lu: unknown = JSON.parse(brut)
    if (typeof lu !== 'object' || lu === null) return VIDE
    const { saisie, annees } = lu as Record<string, unknown>
    return {
      saisie: typeof saisie === 'string' ? saisie : '',
      annees: Array.isArray(annees) ? annees.filter((a): a is number => Number.isInteger(a)) : [],
    }
  } catch {
    return VIDE
  }
}

/** Retient le guichet sous cette entrée ; un guichet vide n'occupe rien. */
export function noterLeGuichet(entree: string, decennie: number, etat: EtatDuGuichet): void {
  try {
    if (etat.saisie === '' && etat.annees.length === 0) window.sessionStorage.removeItem(cle(entree, decennie))
    else window.sessionStorage.setItem(cle(entree, decennie), JSON.stringify(etat))
  } catch {
    // Le stockage refusé : le guichet ne sera pas retrouvé, rien d'autre ne change.
  }
}

/**
 * Les vues du panneau de la télécommande, et leur écriture dans l'adresse : `?telecommande=<vue>` sur
 * l'adresse de l'espace ouvert. Rien d'autre ne dit que le panneau est ouvert, ni sur quelle vue.
 */
export type Vue =
  | { nom: 'telecommande' }
  | { nom: 'en-cours' }
  | { nom: 'ajouter' }
  | { nom: 'a-deux' }
  /** La fiche d'une série, par son identifiant (`media_id`). */
  | { nom: 'fiche'; serie: string }

export const PARAMETRE = 'telecommande'

export const VUE_D_OUVERTURE: Vue = { nom: 'telecommande' }

const SIMPLES = ['telecommande', 'en-cours', 'ajouter', 'a-deux'] as const
const PREFIXE_DE_FICHE = 'fiche-'
const IDENTIFIANT = /^[\w-]+$/

/** `telecommande`, `en-cours`, `ajouter`, `a-deux`, `fiche-<identifiant>`. */
export function ecrireLaVue(vue: Vue): string {
  return vue.nom === 'fiche' ? `${PREFIXE_DE_FICHE}${vue.serie}` : vue.nom
}

/**
 * La vue que porte une recherche d'adresse, ou `null` : le panneau est fermé. Une valeur inconnue (une
 * vue d'une version plus récente, une faute de frappe) ouvre la télécommande plutôt que rien.
 */
export function lireLaVue(search: string): Vue | null {
  const valeur = new URLSearchParams(search).get(PARAMETRE)
  if (valeur === null) return null
  const simple = SIMPLES.find((nom) => nom === valeur)
  if (simple) return { nom: simple }
  const serie = valeur.startsWith(PREFIXE_DE_FICHE) ? valeur.slice(PREFIXE_DE_FICHE.length) : ''
  return IDENTIFIANT.test(serie) ? { nom: 'fiche', serie } : VUE_D_OUVERTURE
}

/** La recherche d'adresse qui porte cette vue (ou aucune : `null`), les autres paramètres gardés. */
export function rechercheAvec(search: string, vue: Vue | null): string {
  const parametres = new URLSearchParams(search)
  if (vue) parametres.set(PARAMETRE, ecrireLaVue(vue))
  else parametres.delete(PARAMETRE)
  const texte = parametres.toString()
  return texte ? `?${texte}` : ''
}

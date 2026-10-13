/**
 * Les vues du panneau de la télécommande, et leur écriture dans l'adresse : `?telecommande=<vue>` sur
 * l'adresse de l'espace ouvert. Rien d'autre ne dit que le panneau est ouvert, ni sur quelle vue.
 */
export type Vue =
  /** La télécommande ; `serie` : **réglée sur cette série** (`media_id`), par la touche « ⋯ » d'une carte de la liste. */
  | { nom: 'telecommande'; serie?: string }
  | { nom: 'en-cours' }
  | { nom: 'ajouter' }
  /** Le « vu à deux » ; `serie` : pour le prochain épisode de cette série (sans elle, celle regardée en dernier). */
  | { nom: 'a-deux'; serie?: string }
  /** La fiche d'une série, par son identifiant (`media_id`). */
  | { nom: 'fiche'; serie: string }

export const PARAMETRE = 'telecommande'

export const VUE_D_OUVERTURE: Vue = { nom: 'telecommande' }

const SIMPLES = ['telecommande', 'en-cours', 'ajouter', 'a-deux'] as const
const PREFIXE_DE_FICHE = 'fiche-'
/** `serie-<identifiant>` : la télécommande réglée sur une série. Le retour du téléphone revient d'où l'on vient. */
const PREFIXE_DE_SERIE = 'serie-'
const PREFIXE_A_DEUX = 'a-deux-'
const IDENTIFIANT = /^[\w-]+$/

/** `telecommande`, `serie-<identifiant>`, `en-cours`, `ajouter`, `a-deux`, `a-deux-<identifiant>`, `fiche-<identifiant>`. */
export function ecrireLaVue(vue: Vue): string {
  if (vue.nom === 'fiche') return `${PREFIXE_DE_FICHE}${vue.serie}`
  if (vue.nom === 'telecommande' && vue.serie) return `${PREFIXE_DE_SERIE}${vue.serie}`
  if (vue.nom === 'a-deux' && vue.serie) return `${PREFIXE_A_DEUX}${vue.serie}`
  return vue.nom
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
  const apres = (prefixe: string) => (valeur.startsWith(prefixe) && IDENTIFIANT.test(valeur.slice(prefixe.length)) ? valeur.slice(prefixe.length) : null)
  const fiche = apres(PREFIXE_DE_FICHE)
  if (fiche) return { nom: 'fiche', serie: fiche }
  const reglee = apres(PREFIXE_DE_SERIE)
  if (reglee) return { nom: 'telecommande', serie: reglee }
  const aDeux = apres(PREFIXE_A_DEUX)
  return aDeux ? { nom: 'a-deux', serie: aDeux } : VUE_D_OUVERTURE
}

/** La recherche d'adresse qui porte cette vue (ou aucune : `null`), les autres paramètres gardés. */
export function rechercheAvec(search: string, vue: Vue | null): string {
  const parametres = new URLSearchParams(search)
  if (vue) parametres.set(PARAMETRE, ecrireLaVue(vue))
  else parametres.delete(PARAMETRE)
  const texte = parametres.toString()
  return texte ? `?${texte}` : ''
}

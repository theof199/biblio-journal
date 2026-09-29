/**
 * Le fronton de l'accueil (reprise de `HomeEtats.kt`) : le jour en toutes lettres, le compte de
 * l'année. Fonctions pures, testées sans réseau.
 */

const NOM_DU_JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' })
const NOM_DU_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

const capitaliser = (mot: string): string => (mot ? mot[0]!.toUpperCase() + mot.slice(1) : mot)

/** « Jeudi 24 septembre », mais « Jeudi 1er octobre » : le 1er du mois s'ordinalise, seul. */
export function formatJour(date: Date): string {
  const jour = date.getDate() === 1 ? '1er' : String(date.getDate())
  return `${capitaliser(NOM_DU_JOUR.format(date))} ${jour} ${NOM_DU_MOIS.format(date)}`
}

/**
 * « 12 films cette année », « 1 film cette année », « Aucun film encore » à zéro — jamais
 * « 0 film », qui sonnerait comme un reproche. `null` tant que `/stats` n'a pas répondu : rien ne
 * s'affiche alors, jamais un zéro provisoire.
 */
export function compteAccueil(cetteAnnee: number | null | undefined): string | null {
  if (cetteAnnee === null || cetteAnnee === undefined) return null
  if (cetteAnnee === 0) return 'Aucun film encore'
  if (cetteAnnee === 1) return '1 film cette année'
  return `${cetteAnnee} films cette année`
}

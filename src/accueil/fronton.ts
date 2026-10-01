import { candidatEnsuite, metaCandidat } from './ensuite'
import type { CarteEnsuite } from './ensuite'
import { lignesDeTitre } from './titre'
import { dateLocale } from '../ui/format'
import type { CandidatFilm } from '../formulaire/candidat'
import type { JournalItem } from '../api/journal'
import type { SeancePrise } from '../api/voyage'

/**
 * Le fronton de l'accueil (reprise de `HomeEtats.kt`) : le jour en toutes lettres, le compte de
 * l'année, et le panneau à lettres qui dit quoi voir ensuite. Fonctions pures, testées sans réseau.
 */

const NOM_DU_JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' })
const NOM_DU_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long' })

export const capitaliser = (mot: string): string => (mot ? mot[0]!.toUpperCase() + mot.slice(1) : mot)

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

/**
 * Où mène un élément de l'accueil : `to` et, quand la page d'arrivée en a besoin, l'`state` que
 * `<Link>` lui passe (le candidat du formulaire, ou l'entrée déjà connue du journal).
 */
export interface CibleAccueil {
  to: string
  state?: { candidat: CandidatFilm } | { item: JournalItem }
}

/** Le rôle d'une ligne du panneau : la taille et la couleur des lettres sont le choix du composant, pas d'ici. */
export type RoleLigneFronton = 'jour' | 'etiquette' | 'titre' | 'titreCompact' | 'detail' | 'accent'

export interface LigneFronton {
  role: RoleLigneFronton
  texte: string
}

/** Quel cas le panneau annonce, dans l'ordre de priorité où `etatFronton` les essaie. */
export type GenreFronton = 'seance' | 'prochainement' | 'derniere' | 'premiere'

/**
 * Les décennies qui ont leur enseigne : `theme.css` porte un bloc `[data-decennie='…']` par entrée et
 * `polices.ts` la police de son titre (`fronton.decennies.test.ts` y veille).
 */
export const DECENNIES = [1890, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const

export type Decennie = (typeof DECENNIES)[number]

/** L'enseigne de la maison : celle d'un film sans année, d'avant 1890, ou du journal vide. */
export const DECENNIE_PAR_DEFAUT: Decennie = 1940

const PREMIERE_DECENNIE = DECENNIES[0]
const DERNIERE_DECENNIE = DECENNIES[DECENNIES.length - 1]!

/**
 * La décennie dont le panneau prend l'enseigne. Une année inconnue ou d'avant 1890 retombe sur
 * l'enseigne de la maison ; une année d'après 2029 garde celle des années 2020, la dernière dessinée.
 */
export function decennieDeAnnee(annee: number | null | undefined): Decennie {
  if (annee === null || annee === undefined || !Number.isFinite(annee) || annee < PREMIERE_DECENNIE) return DECENNIE_PAR_DEFAUT
  return Math.min(Math.floor(annee / 10) * 10, DERNIERE_DECENNIE) as Decennie
}

export interface EtatFronton {
  genre: GenreFronton
  /** L'enseigne du film annoncé : ce que le cadre entoure change avec sa décennie, le cadre non. */
  decennie: Decennie
  lignes: LigneFronton[]
  cible: CibleAccueil
}

/** Au-delà, un titre ne tient plus sur une ligne en grandes lettres : il passe sur deux, plus petites. */
const LONGUEUR_TITRE_GRAND = 11

/** Le titre en lignes de panneau : le découpage est celui de `titre.ts`, le rôle dit la taille des lettres. */
const lignesDeTitreFronton = (titre: string): LigneFronton[] =>
  lignesDeTitre(titre, LONGUEUR_TITRE_GRAND).map(({ texte, compacte }) => ({ role: compacte ? 'titreCompact' : 'titre', texte }))

/** « Samedi 26 septembre », avec l'année quand ce n'est pas celle de `maintenant`. */
function jourDeVisionnage(iso: string, maintenant: Date): string {
  const date = dateLocale(iso)
  const jour = formatJour(date)
  return date.getFullYear() === maintenant.getFullYear() ? jour : `${jour} ${date.getFullYear()}`
}

function etatSeance(jour: LigneFronton, seance: SeancePrise): EtatFronton {
  const lignes: LigneFronton[] = [
    jour,
    { role: 'etiquette', texte: 'Ce soir' },
    ...lignesDeTitreFronton(seance.long.title),
  ]
  if (seance.court) lignes.push({ role: 'detail', texte: `+ ${seance.court.title} · court` })
  lignes.push({ role: 'detail', texte: `Voyage ${seance.annee}` })
  return { genre: 'seance', decennie: decennieDeAnnee(seance.annee), lignes, cible: { to: '/voyage' } }
}

function etatProchainement(jour: LigneFronton, carte: CarteEnsuite): EtatFronton {
  const { candidat } = candidatEnsuite(carte)
  const lignes: LigneFronton[] = [jour, { role: 'etiquette', texte: 'Prochainement' }, ...lignesDeTitreFronton(candidat.title)]
  const auteur = metaCandidat(candidat)
  if (auteur) lignes.push({ role: 'accent', texte: auteur })
  return { genre: 'prochainement', decennie: decennieDeAnnee(candidat.year), lignes, cible: { to: '/journal/nouveau', state: { candidat } } }
}

function etatDerniere(jour: LigneFronton, dernier: JournalItem, maintenant: Date): EtatFronton {
  const { entry, media } = dernier
  const vu = jourDeVisionnage(entry.finished_at, maintenant)
  const lignes: LigneFronton[] = [
    jour,
    { role: 'etiquette', texte: 'Dernière séance' },
    ...lignesDeTitreFronton(media.title),
    { role: 'detail', texte: entry.rating == null ? vu : `${vu} · ${entry.rating} sur 10` },
  ]
  return { genre: 'derniere', decennie: decennieDeAnnee(media.year), lignes, cible: { to: `/journal/${entry.id}`, state: { item: dernier } } }
}

function etatPremiere(jour: LigneFronton): EtatFronton {
  return {
    genre: 'premiere',
    decennie: DECENNIE_PAR_DEFAUT,
    lignes: [
      jour,
      { role: 'titre', texte: 'Ouverture' },
      { role: 'detail', texte: 'La vitrine attend' },
      { role: 'detail', texte: 'sa première affiche' },
    ],
    cible: { to: '/recherche' },
  }
}

/**
 * Ce que le panneau annonce et où il mène. Priorité : la séance prise dans le Voyage, sinon la
 * première carte « Ensuite », sinon la dernière entrée du journal (la plus récente d'abord, comme
 * l'API la rend), sinon — journal vide — l'invitation à ouvrir la vitrine. `maintenant` est
 * passé plutôt que lu ici, pour que le panneau se teste sans horloge.
 */
export function etatFronton(
  maintenant: Date,
  seance: SeancePrise | null | undefined,
  cartes: readonly CarteEnsuite[],
  dernier: JournalItem | null | undefined,
): EtatFronton {
  const jour: LigneFronton = { role: 'jour', texte: formatJour(maintenant) }
  if (seance) return etatSeance(jour, seance)
  const premiereCarte = cartes[0]
  if (premiereCarte) return etatProchainement(jour, premiereCarte)
  if (dernier) return etatDerniere(jour, dernier, maintenant)
  return etatPremiere(jour)
}

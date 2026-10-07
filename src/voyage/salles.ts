import type { DemandeSalle, EtatFilm, FilmDeSalle, Piste, Salle } from '../api/voyage'

/**
 * Les salles d'une année (plan 2b), sans rendu. Portées de `FicheVoyageEtats.kt`, `PisteEtats.kt` et
 * `VoyageEtats.kt` (`biblio-android`, `ui/frise/`). L'état d'un programme n'est pas redérivé ici :
 * l'API ne le dit `vu` que quand toutes ses bobines le sont, et la fiche se relit après chaque geste.
 */

/** Vu ou introuvable : les deux états qui ne demandent plus rien (la complétion d'une salle, le Lion). */
export const acquis = (f: Pick<FilmDeSalle, 'etat'>): boolean => f.etat === 'vu' || f.etat === 'introuvable'

/** Une salle complète : au moins un film, et tous acquis. Une salle vide ne l'est jamais. */
export const salleComplete = (s: Pick<Salle, 'films'>): boolean => s.films.length > 0 && s.films.every(acquis)

/** Les ampoules de l'auvent : une par film, allumée s'il est vu — un introuvable reste éteint. */
export const ampoules = (s: Pick<Salle, 'films'>): boolean[] => s.films.map((f) => f.etat === 'vu')

/**
 * Le numéro d'une salle : son rang dans l'année, que l'API garde unique par année et qui ne bouge plus
 * une fois la salle écrite. Jamais sa place dans la réponse : deux lectures dans un autre ordre, ou
 * une liste filtrée, donneraient deux numéros à la même salle. Écrit une fois, lu par qui numérote une
 * salle (la voie d'une gare, le tableau des départs).
 */
export const numeroDeLaSalle = (s: Pick<Salle, 'rang'>): number => s.rang

/** « 4 vus sur 5 ». */
export function compteDeLaSalle(s: Pick<Salle, 'films'>): string {
  const v = s.films.filter((f) => f.etat === 'vu').length
  return `${v} vu${v > 1 ? 's' : ''} sur ${s.films.length}`
}

/**
 * La porte au bout de l'étagère (portée d'`etiquetteEtagere`) : une salle qui se remplit prime sur
 * « épuisée », qui prime sur « En voir plus ». Hors IA, « En voir plus » n'existe pas (`403`) :
 * rien au bout d'une salle qui n'est ni épuisée ni en train de se remplir.
 */
export type Porte = { texte: string; geste: boolean } | null

export function porteDeLEtagere(s: Pick<Salle, 'epuisee' | 'fournee_en_cours'>, ia: boolean): Porte {
  if (s.fournee_en_cours) return { texte: 'La salle se remplit…', geste: false }
  if (s.epuisee) return { texte: 'Salle épuisée', geste: false }
  return ia ? { texte: 'En voir plus', geste: true } : null
}

/**
 * Le lien « Le contexte de la salle » : un contexte déjà écrit se lit toujours ; sinon, seul le
 * compte IA peut le demander (`403` pour un membre hors IA, `routes/voyage.ts`).
 */
export const contexteLisible = (s: Pick<Salle, 'contexte'>, ia: boolean): boolean => s.contexte !== null || ia

/** `POST …/contexte` ne part que si rien n'est encore écrit (portée de `doitAppelerContexteSalle`). */
export const doitDemanderContexte = (s: Pick<Salle, 'contexte'>): boolean => s.contexte === null

/**
 * L'étiquette d'un état sous une affiche (maquette 1890 : `ETIQ`). Le mot d'un introuvable est celui
 * du monde (« perdu » en 1890) ; « vu » se lit aussi sur l'affiche, à sa note ou à sa coche.
 */
export function etiquetteEtat(etat: EtatFilm, motIntrouvable: string): string {
  switch (etat) {
    case 'vu':
      return 'vu'
    case 'sur_le_plex':
      return 'sur ton Plex'
    case 'demande':
      return 'demandé'
    case 'a_demander':
      return 'à voir'
    case 'introuvable':
      return motIntrouvable
  }
}

/** La zone « Ouvrir une nouvelle salle » (portée d'`etatZoneSalleVoyage`) : le bouton, la salle qui s'écrit, ou le refus. */
export type ZoneNouvelleSalle = 'bouton' | 'fantome' | 'refus'

export function zoneNouvelleSalle(demande: Pick<DemandeSalle, 'statut'> | null): ZoneNouvelleSalle {
  if (demande?.statut === 'en_cours') return 'fantome'
  if (demande?.statut === 'refusee') return 'refus'
  return 'bouton'
}

/**
 * Les pistes après avoir ouvert une salle sur l'une d'elles (portée de `pistesApresUsage`) : celle-là
 * seule part ; une salle écrite à la main (`utilisee` nulle) n'en retire aucune.
 */
export const pistesApresUsage = (pistes: readonly Piste[], utilisee: string | null): Piste[] =>
  pistes.filter((p) => p.nom !== utilisee)

/** « D'autres pistes » n'apparaît que quand il n'en reste aucune (portée d'`autresPistesVisible`). */
export const autresPistes = (pistes: readonly Piste[]): boolean => pistes.length === 0

/**
 * La feuille « Nouvelle salle » (portée de `nouvelleSalleSuivant`) : toucher une piste remplit le
 * champ et la retient ; écrire change le texte sans jamais oublier la piste touchée — c'est elle que
 * l'envoi reprend comme `piste`.
 */
export interface Brouillon {
  texte: string
  piste: string | null
}

export type GesteNouvelleSalle = { type: 'piste'; piste: Piste } | { type: 'ecrire'; texte: string }

export function brouillonSuivant(b: Brouillon, geste: GesteNouvelleSalle): Brouillon {
  if (geste.type === 'piste') return { texte: geste.piste.nom, piste: geste.piste.nom }
  return { ...b, texte: geste.texte }
}

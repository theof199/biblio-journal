import type { AnneeCarte, EtatFilm, FichePrete } from '../api/voyage'
import { apercuLitLaFiche, decennieDe } from './regles'

/**
 * La recherche du Voyage (plan 2c ; maquette 1890, écran X : « au guichet, le catalogue des vues »),
 * sans rendu. Le catalogue est celui des salles déjà écrites de la décennie (décision D7) : aucun
 * appel au chroniqueur, aucune source externe, rien qui parte à chaque lettre tapée.
 */

/** Une vue du catalogue : un film d'une salle, ou une bobine d'un programme. */
export interface Vue {
  annee: number
  /** La ligne de salle qui ouvre la fiche (`/voyage/:annee/films/:filmId`) : le programme, pour une bobine. */
  filmId: string
  tmdbId: number
  titre: string
  /** Vide pour une bobine : le contrat ne lui donne pas de réalisateur. */
  realisateur: string
  etat: EtatFilm
  note: number | null
  /** De la salle « Les essentiels ». */
  essentiel: boolean
}

/**
 * Les années dont le catalogue se lit : celles de la décennie dont la fiche est déjà écrite et non
 * verrouillée — jumeau de l'aperçu de la carte (`apercuLitLaFiche`) : lire une année non visitée
 * enfilerait son ouverture chez le chroniqueur, sans geste du membre.
 */
export const anneesDuCatalogue = (annees: readonly AnneeCarte[], decennie: number): number[] =>
  annees.filter((a) => decennieDe(a.annee) === decennie && apercuLitLaFiche(a)).map((a) => a.annee)

/**
 * Les vues de fiches prêtes, année par année dans l'ordre donné, salle par salle : un film une
 * fois (le premier rencontré), une bobine après son programme.
 */
export function catalogue(fiches: readonly FichePrete[]): Vue[] {
  const vus = new Set<number>()
  const vues: Vue[] = []
  const ajouter = (v: Vue) => {
    if (vus.has(v.tmdbId)) return
    vus.add(v.tmdbId)
    vues.push(v)
  }
  for (const fiche of fiches) {
    for (const salle of fiche.salles) {
      const essentiel = salle.cle === 'essentiels'
      for (const f of salle.films) {
        ajouter({ annee: fiche.annee, filmId: f.id, tmdbId: f.tmdb_id, titre: f.title, realisateur: f.realisateur, etat: f.etat, note: f.note, essentiel })
        for (const b of f.programme?.bobines ?? []) {
          ajouter({ annee: fiche.annee, filmId: f.id, tmdbId: b.tmdb_id, titre: b.title, realisateur: '', etat: b.etat, note: null, essentiel })
        }
      }
    }
  }
  return vues
}

/** Le pliage d'un caractère : sans accent ni casse, l'apostrophe droite, les ligatures dépliées. */
function plierUn(c: string): string {
  if (c === '’' || c === '‘' || c === 'ʼ') return "'"
  const bas = c.toLowerCase()
  if (bas === 'œ') return 'oe'
  if (bas === 'æ') return 'ae'
  return bas.normalize('NFD').replace(/\p{M}/gu, '')
}

/**
 * Un texte plié pour la recherche, et, pour chaque unité UTF-16 du texte plié, où commence et finit
 * dans le texte d'origine le caractère dont elle vient : de quoi souligner le passage trouvé dans le
 * titre tel qu'il s'écrit (« Arrivée » trouvé par « arrivee »). Des unités, pas des caractères :
 * `indexOf` et `slice` comptent ainsi, et un emoji en occupe deux.
 */
export function plier(texte: string): { plie: string; debut: number[]; fin: number[] } {
  let plie = ''
  const debut: number[] = []
  const fin: number[] = []
  let i = 0
  for (const c of texte) {
    const p = plierUn(c)
    plie += p
    for (let u = 0; u < p.length; u += 1) {
      debut.push(i)
      fin.push(i + c.length)
    }
    i += c.length
  }
  return { plie, debut, fin }
}

/** Le passage d'un titre que trouve la saisie, à souligner ; nul si la saisie ne s'y trouve pas. */
export function passage(titre: string, saisie: string): { avant: string; trouve: string; apres: string } | null {
  const q = plier(saisie.trim()).plie
  if (!q) return null
  const { plie, debut, fin } = plier(titre)
  const k = plie.indexOf(q)
  if (k < 0) return null
  const a = debut[k]!
  const b = fin[k + q.length - 1]!
  return { avant: titre.slice(0, a), trouve: titre.slice(a, b), apres: titre.slice(b) }
}

/**
 * Les vues que trouve le guichet : le titre ou le réalisateur contient la saisie (pliée), dans les
 * années cochées (aucune cochée : toutes).
 */
export function chercher(vues: readonly Vue[], saisie: string, annees: ReadonlySet<number>): Vue[] {
  const q = plier(saisie.trim()).plie
  return vues.filter(
    (v) => (annees.size === 0 || annees.has(v.annee)) && (!q || plier(v.titre).plie.includes(q) || plier(v.realisateur).plie.includes(q)),
  )
}

export const A_L_AFFICHE = 6

/**
 * Sans saisie ni année cochée, « les plus demandées au guichet » : les essentiels pas encore vus, de
 * l'année la plus récente à la plus ancienne, six au plus.
 */
export function aLAffiche(vues: readonly Vue[]): Vue[] {
  return vues
    .filter((v) => v.essentiel && v.etat !== 'vu')
    .sort((x, y) => y.annee - x.annee)
    .slice(0, A_L_AFFICHE)
}

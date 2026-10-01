import type { JournalItem } from '../api/journal'
import type { AnneeCarte, Recompense, Voyage } from '../api/voyage'
import { decennieDe, etatDeCase, type EtatCase } from './regles'

/**
 * La page d'une décennie (plan 2c ; maquette 1890, écran IV : le manège, le passeport, la
 * palissade, le registre), sans rendu. Tout se lit sur la carte (`GET /me/voyage`) et sur mes
 * visionnages des films sortis dans la décennie : jamais une fiche d'année, qui enfilerait une
 * ouverture chez le chroniqueur sur une année non visitée.
 */

/** La première décennie du Voyage : ses années avant le départ (1890 à 1894) n'ont pas de page. */
export const PREMIERE_DECENNIE = 1890

/**
 * La décennie d'une adresse (`/voyage/decennies/:decennie`) : quatre chiffres, un multiple de dix,
 * de 1890 à la décennie de l'année civile ; nulle sinon, et la page ramène à la carte.
 */
export function decennieDeLAdresse(param: string | undefined, anneeCivile: number): number | null {
  if (!param || !/^\d{4}$/.test(param)) return null
  const d = Number(param)
  return d % 10 === 0 && d >= PREMIERE_DECENNIE && d <= decennieDe(anneeCivile) ? d : null
}

/**
 * L'année civile **à Paris**, celle du serveur qui borne la carte (`new Date().getFullYear()` de
 * l'API, sur le NAS) : jamais celle de l'appareil, qui, réglé ailleurs, fermerait la décennie neuve
 * quelques heures de trop le 1er janvier, ou l'ouvrirait la veille. Le format se crée à chaque appel :
 * les tests changent le fuseau de Node.
 */
export function anneeCivile(maintenant: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: 'Europe/Paris' }).format(maintenant))
}

/**
 * Les pages d'une décennie qui ont leur route (`App.tsx`) : la page de la décennie n'offre qu'elles.
 * La boîte à billets (`billets`, tâche 7 du plan 2c) et le guichet (`recherche`, tâche 9) y sont,
 * chacun avec sa route : sans elle, son lien tomberait sur la route inconnue, qui ramène à
 * l'accueil, hors du Voyage.
 */
export const PAGES_DE_LA_DECENNIE: readonly ('billets' | 'recherche')[] = ['billets', 'recherche']

export const anneesDe = (decennie: number): number[] => Array.from({ length: 10 }, (_, i) => decennie + i)

/** Les films de mon journal sortis cette année-là : jamais une série (le Voyage ne compte que des films). */
const filmsDe = (items: readonly JournalItem[], annee: number) => items.filter((i) => i.media.type === 'movie' && i.media.year === annee)

/**
 * L'état d'un cheval du manège (maquette : `NACS`) : brut avant le départ du Voyage, l'état de sa
 * case sur la carte ensuite (médaillé, en cours, passé), bâché une fois verrouillé — « en avance »
 * s'il porte déjà des films vus. Une année que la carte ne porte pas encore (après l'année civile)
 * est bâchée. `attente` : comme sur la carte (`etatDeCase`), une année que le Voyage suivi n'a pas
 * encore ouverte, pour un membre hors IA ; elle l'emporte sur l'état de la case, jamais « en cours ».
 */
export type EtatCheval = 'avant' | 'avance' | 'attente' | EtatCase

export function chevaux(v: Pick<Voyage, 'annees' | 'ia' | 'depart'>, decennie: number): { annee: number; etat: EtatCheval }[] {
  return anneesDe(decennie).map((annee) => {
    const a = v.annees.find((x) => x.annee === annee)
    if (!a) return { annee, etat: annee < v.depart ? 'avant' : 'verrou' }
    const { etat, attente } = etatDeCase(a, v.ia)
    if (attente) return { annee, etat: 'attente' }
    return { annee, etat: etat === 'verrou' && a.profondeur > 0 ? 'avance' : etat }
  })
}

/** Où se tient la figure d'une année sur le monument, pour l'image en cours (`VueMonument.zone`). */
export interface Figure {
  annee: number
  x: number
  y: number
  r: number
  /** Peinte au premier plan (devant le pilier du manège). */
  devant: boolean
}

/**
 * La figure sous le doigt (maquette : le cheval le plus proche, à moins de 30 unités) : la plus
 * proche dont le rayon contient le toucher ; nulle à côté de toutes — le monument s'emballe alors.
 * Un toucher qui tombe à la fois sur une figure de devant et sur une de derrière ouvre toujours
 * celle de devant, même plus loin du doigt : c'est elle qu'on voit (décision du propriétaire du
 * 1er octobre 2026). Entre figures d'un même plan, la plus proche.
 */
export function figureTouchee(figures: readonly Figure[], p: { x: number; y: number }): number | null {
  const d2 = (f: Figure) => (f.x - p.x) ** 2 + (f.y - p.y) ** 2
  const sous = figures.filter((f) => d2(f) <= f.r * f.r)
  const plan = sous.some((f) => f.devant) ? sous.filter((f) => f.devant) : sous
  let meilleure: Figure | null = null
  for (const f of plan) if (!meilleure || d2(f) < d2(meilleure)) meilleure = f
  return meilleure?.annee ?? null
}

/** Une ligne du registre des recettes (maquette : `.registre`) : une par année de la décennie. */
export interface LigneDuRegistre {
  annee: number
  /** Les films vus de l'année, comme la carte les compte (`profondeur` : un programme compte un). */
  vus: number
  /**
   * La récompense de l'année, même en avance : c'est elle que le tampon demande (`ceQuiManque`),
   * et une année verrouillée peut déjà porter son Ours par des films vus en avance.
   */
  recompense: Recompense | null
  /** Ma meilleure note sur un film sorti cette année-là ; nulle sans film noté. */
  meilleureNote: number | null
  /** L'année en cours du membre, sauf en attente : elle se dit alors en attente, jamais « en cours ». */
  enCours: boolean
  /**
   * Pour un membre hors IA, une année que le Voyage suivi n'a pas encore ouverte (`etatDeCase`, le
   * jumeau de la carte) : fermée pour lui, « Théo est trop lent » (`tropLent`).
   */
  attente: boolean
  /** Verrouillée, mais déjà des films vus. */
  enAvance: boolean
  /**
   * L'année a sa page (fiche ou année fermée) : celles que porte la carte, du départ du Voyage à
   * l'année civile — jamais une avant le départ (1890 à 1894), ni une à venir.
   */
  ouvrable: boolean
}

export function registre(v: Pick<Voyage, 'annees' | 'annee_en_cours' | 'ia'>, items: readonly JournalItem[], decennie: number): LigneDuRegistre[] {
  return anneesDe(decennie).map((annee) => {
    const a: AnneeCarte | undefined = v.annees.find((x) => x.annee === annee)
    const notes = filmsDe(items, annee).flatMap((i) => (i.entry.rating === null ? [] : [i.entry.rating]))
    const attente = !!a && etatDeCase(a, v.ia).attente
    return {
      annee,
      vus: a?.profondeur ?? 0,
      recompense: a?.recompense ?? null,
      meilleureNote: notes.length > 0 ? Math.max(...notes) : null,
      enCours: annee === v.annee_en_cours && !attente,
      attente,
      enAvance: !!a && a.statut === 'verrouillee' && a.profondeur > 0,
      ouvrable: !!a,
    }
  })
}

/** Un panneau de la palissade (maquette : `.panneau`) : les affiches d'une année, collées de travers. */
export interface Panneau {
  annee: number
  /** Quatre affiches au plus, du visionnage le plus récent au plus ancien, un film une fois. */
  affiches: string[]
  /** Les films vus de l'année qui n'ont pas trouvé de place (« +2 »). */
  plus: number
  enAvance: boolean
}

export const AFFICHES_PAR_PANNEAU = 4

/** Les panneaux : une année du Voyage par panneau, de la première de la décennie à la dernière que porte la carte. */
export function palissade(v: Pick<Voyage, 'annees'>, items: readonly JournalItem[], decennie: number): Panneau[] {
  return v.annees
    .filter((a) => decennieDe(a.annee) === decennie)
    .map((a) => {
      const vus = new Set<string>()
      const affiches: string[] = []
      // L'API rend le journal du plus récent au plus ancien : le premier rencontré est le dernier vu.
      for (const i of filmsDe(items, a.annee)) {
        if (vus.has(i.media.id)) continue
        vus.add(i.media.id)
        if (i.media.cover_url && affiches.length < AFFICHES_PAR_PANNEAU) affiches.push(i.media.cover_url)
      }
      return { annee: a.annee, affiches, plus: Math.max(0, a.profondeur - affiches.length), enAvance: a.statut === 'verrouillee' && a.profondeur > 0 }
    })
}

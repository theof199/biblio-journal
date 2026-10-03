import { filmographieTerminee } from '../profil/bilan'
import { filmsVus, type FilmSuivi } from './prochain'

/**
 * La page d'un réalisateur : longs et courts métrages, ce qu'elle compte et ce qu'elle dit de
 * chaque film — fonctions pures, testées sans réseau.
 */

/** Un film de la page, réduit à ce que ces fonctions lisent. */
export interface FilmDeRealisateur extends FilmSuivi {
  court: boolean
  sur_le_plex: boolean
}

/** Ce que « N vus sur M » embrasse : longs et courts à part, les deux ensemble, ou les longs seuls. */
export type ModeDeCompte = 'separement' | 'ensemble' | 'longs'

export const MODE_PAR_DEFAUT: ModeDeCompte = 'separement'

export const MODES_DE_COMPTE: readonly ModeDeCompte[] = ['separement', 'ensemble', 'longs']

/**
 * Longs et courts métrages, chacun dans l'ordre où le back les rend : la page les range sous deux
 * titres, et le compte les pèse séparément.
 */
export function separerCourts<F extends { court: boolean }>(films: readonly F[]): { longs: F[]; courts: F[] } {
  return {
    longs: films.filter((film) => !film.court),
    courts: films.filter((film) => film.court),
  }
}

/**
 * Un réalisateur sans long métrage n'a rien à compter « longs seulement » : ce serait « 0 vus sur 0 »
 * et un sceau posé d'office sur une filmographie vide. Le mode se replie alors sur « ensemble ».
 */
function modeEffectif(mode: ModeDeCompte, longs: readonly unknown[]): ModeDeCompte {
  return mode === 'longs' && longs.length === 0 ? 'ensemble' : mode
}

const vusSur = (films: readonly FilmSuivi[]) => `${filmsVus(films)} vus sur ${films.length}`

/**
 * La ligne de compte sous le nom. « Séparément » donne les longs d'abord, puis les courts
 * (« 8 vus sur 12 · courts 1 sur 4 ») ; faute de courts elle n'en parle pas, faute de longs elle ne
 * parle que des courts. Tous les films comptent au total, introuvables compris : masquer ne change
 * pas la filmographie.
 */
export function ligneDeCompte(longs: readonly FilmSuivi[], courts: readonly FilmSuivi[], mode: ModeDeCompte): string {
  const effectif = modeEffectif(mode, longs)
  if (effectif === 'ensemble') return vusSur([...longs, ...courts])
  if (effectif === 'longs') return vusSur(longs)
  const lesCourts = `courts ${filmsVus(courts)} sur ${courts.length}`
  if (courts.length === 0) return vusSur(longs)
  if (longs.length === 0) return lesCourts
  return `${vusSur(longs)} · ${lesCourts}`
}

/**
 * Le sceau « Rétrospective complète » suit ce que le compte embrasse : en « longs seulement » un
 * court jamais vu ne l'empêche pas, dans les autres modes il compte comme n'importe quel film.
 */
export function retrospectiveComplete(
  longs: readonly FilmSuivi[],
  courts: readonly FilmSuivi[],
  mode: ModeDeCompte,
): boolean {
  return filmographieTerminee(modeEffectif(mode, longs) === 'longs' ? longs : [...longs, ...courts])
}

/**
 * L'état d'une ligne : « Vu · 9/10 », « Introuvable » ou « À voir », puis « Sur le Plex » quand il y
 * est, vu ou non. Le signe du Voyage vient après, posé par la page qui le met en gras.
 */
export function etatDuFilm(film: FilmDeRealisateur): string {
  const etat = film.vu ? `Vu${film.vu.rating != null ? ` · ${film.vu.rating}/10` : ''}` : film.introuvable ? 'Introuvable' : 'À voir'
  return film.sur_le_plex ? `${etat} · Sur le Plex` : etat
}

/**
 * Un seul réglage pour tous les réalisateurs, gardé sur l'appareil et jamais envoyé au back : une
 * manière de compter n'a rien à faire dans le journal de quelqu'un d'autre.
 */
const CLE_STOCKAGE = 'journal.realisateur-compte'

/** `localStorage` peut être absent ou lever, et la valeur gardée peut ne plus être un mode connu : on se replie sur le défaut. */
export function lireModeDeCompte(): ModeDeCompte {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE)
    return MODES_DE_COMPTE.find((mode) => mode === brut) ?? MODE_PAR_DEFAUT
  } catch {
    return MODE_PAR_DEFAUT
  }
}

export function ecrireModeDeCompte(mode: ModeDeCompte): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, mode)
  } catch {
    // Rien à faire : le compte change à l'écran, seul le choix ne survit pas à la page.
  }
}

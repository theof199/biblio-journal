import type { CaseVue } from '../types'
import { estFermee } from './gares'

/**
 * La règle des affiches du compartiment (idée 72, « le compartiment se remplit » ; maquette :
 * `AFFICHES_VUES` et `accrocher`, l. 3517 et 3630) : lesquelles se pincent sur la ficelle, dans quel
 * ordre, combien au plus. Écrite une fois, lue par la montée en voiture et par le reflet du tunnel
 * (`accroches.ts`). Rien ici ne lit l'avance ni l'horloge : la ficelle ne dépend que des années.
 */

/** Combien d'affiches tiennent sur la ficelle (maquette : cinq, de 40 px, sous une vitre de 390). */
export const PLAFOND_DE_LA_FICELLE = 5

/** De combien chaque affiche penche à sa pince, en degrés, selon son rang sur la ficelle (maquette : `--r`). */
export const PENCHES = [-4, 3, -2, 5, -3] as const

/**
 * Les adresses des affiches de la ficelle, de gauche à droite. Une année en donne une, la première
 * des siennes (`CaseVue.affiches`), si elle n'est pas fermée (`estFermee` : ni verrouillée, ni en
 * attente du Voyage suivi) ; une année sans affiche ne laisse pas de place vide. Elles se rangent
 * dans l'ordre des années, quel que soit celui des cases ; au-delà du plafond, les plus récentes
 * restent et les plus anciennes sortent.
 */
export function affichesDeLaFicelle(cases: readonly Pick<CaseVue, 'annee' | 'etat' | 'attente' | 'affiches'>[]): string[] {
  return [...cases]
    .sort((a, b) => a.annee - b.annee)
    .flatMap((k) => (estFermee(k) || !k.affiches[0] ? [] : [k.affiches[0]]))
    .slice(-PLAFOND_DE_LA_FICELLE)
}

/**
 * La clé sous laquelle la ficelle se cuit (`accroches.ts`) : ses adresses dans l'ordre, chacune
 * marquée chargée (`+`) ou non (`-`). Une affiche qui arrive change donc la clé, et la ficelle se
 * recuit avec elle ; tant que rien ne change, la même toile est reposée.
 */
export function cleDeLaFicelle(adresses: readonly string[], chargees: readonly boolean[]): string {
  return `ficelle:${adresses.map((url, k) => `${chargees[k] ? '+' : '-'}${url}`).join('|')}`
}

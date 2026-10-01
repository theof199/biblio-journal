import { useEffect, useRef, useState } from 'react'
import { auTempo } from '../tempo'

/**
 * Le déroulé de chaque scène : l'attente avant chacun de ses pas, en millisecondes, au tempo
 * (`voyage/tempo.ts`). La feuille joue les mêmes durées (`Celebrations.module.css`,
 * `calc(… * var(--tempo))`) ; `voyage/tempo.test.ts` refuse ici un chiffre écrit sans `auTempo`.
 */

/** La salle bouclée : le rideau se referme, puis le carton. */
export const SALLE = [auTempo(700)] as const

/** La récompense : le balancier descend et frappe ; la presse s'efface, l'emblème sort ; son nom. */
export const RECOMPENSE = [auTempo(550), auTempo(300), auTempo(900)] as const

/**
 * L'année bouclée : un temps, les cinq ampoules une à une, la médaille sous les confettis, le
 * titre, le guichet qui tend le billet, puis le choix.
 */
export const ANNEE = [auTempo(300), auTempo(175), auTempo(175), auTempo(175), auTempo(175), auTempo(250), auTempo(500), auTempo(400), auTempo(500)] as const

/** Les pas de l'année bouclée, par leur nom : la cinquième ampoule, la médaille, le titre, le guichet, le choix. */
export const PAS_DE_L_ANNEE = { ampoules: 5, medaille: 6, titre: 7, guichet: 8, choix: 9 } as const

/** La vibration d'une fête (Android) : un plus, jamais le seul signal. */
export const VIBRATION_DE_FETE = [auTempo(18), auTempo(40), auTempo(70)]

const attendre = (ms: number) => new Promise<void>((fin) => setTimeout(fin, ms))

/**
 * Le pas où en est une scène : 0 au montage, puis un de plus après chaque attente, jusqu'au
 * dernier. Au calme, le dernier dès le premier rendu, sans minuterie : l'état final posé.
 * `aChaquePas` porte ce qui s'entend et se sent (le clap, le carillon, la vibration).
 *
 * **Une scène démontée n'écrit plus rien** : la séquence relit son drapeau après chaque attente,
 * avant tout `setState`, tout son et toute vibration (`CLAUDE.md`, « Le Voyage : ce qu'on casse
 * sans le voir »). `finir` pose l'état final d'un coup (un toucher impatient) : les pas sautés ne
 * sonnent ni ne vibrent.
 */
export function useDeroule(durees: readonly number[], calme: boolean, aChaquePas?: (pas: number) => void): { pas: number; fini: boolean; finir: () => void } {
  const dernier = durees.length
  const [pas, setPas] = useState(calme ? dernier : 0)
  const rappel = useRef(aChaquePas)
  rappel.current = aChaquePas
  const arrete = useRef(false)

  useEffect(() => {
    if (calme) {
      setPas(dernier)
      return
    }
    let monte = true
    void (async () => {
      for (let i = 0; i < durees.length; i += 1) {
        await attendre(durees[i]!)
        if (!monte || arrete.current) return
        setPas(i + 1)
        rappel.current?.(i + 1)
      }
    })()
    return () => {
      monte = false
    }
    // Les durées d'une scène sont des constantes de ce module.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calme, dernier])

  const finir = () => {
    arrete.current = true
    setPas(dernier)
  }
  return { pas, fini: pas >= dernier, finir }
}

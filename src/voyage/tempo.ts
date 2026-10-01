import type { CSSProperties } from 'react'

/**
 * Le tempo de ce qui suit le geste « vu » : le compostage du billet (le marteau, l'encre, le choc, la
 * vibration, le numéroteur, le talon, puis le retour à l'année) et, sur l'année, le compteur qui roule
 * et le « +1 » qui vole. Chaque durée et chaque délai de la séquence s'écrit à sa valeur de base et se
 * multiplie par ce chiffre : en JS par `auTempo`, en CSS par `var(--tempo)`
 * (`calc(360ms * var(--tempo))`). `tempo.test.ts` refuse une durée écrite sans lui.
 *
 * ×2 depuis le 1er octobre 2026 (le propriétaire : on avait à peine le temps de les voir). C'est le
 * seul chiffre à changer. Au calme, rien ne s'anime, quel que soit le tempo.
 *
 * Les animations venues depuis le suivent aussi : sur la carte, l'envol d'une bobine perdue vers son
 * compteur (`DUREE_DE_L_ENVOL`, `carte/moteur.ts`), la pulsation du compteur et l'apparition de son
 * message (`carte/Carte.module.css`, sous `.ecran` qui porte la variable).
 */
export const TEMPO = 2

/** Une durée ou un délai de la séquence, en millisecondes, au tempo. */
export const auTempo = (ms: number): number => ms * TEMPO

/**
 * La variable que lisent les feuilles de la séquence, posée sur l'élément qui la porte (la page du
 * billet, la corde). Sans elle, leur `calc` est invalide et l'animation entière tombe.
 */
export const STYLE_DU_TEMPO = { '--tempo': String(TEMPO) } as CSSProperties

import type { CaseVue } from '../types'

/**
 * La foire se remplit par paliers (idée 2 ; règle du propriétaire, 29 septembre 2026) : un palier
 * par année bouclée (sa case n'est ni `encours` ni `verrou` : la carte la dit `ouverte`) ; dans
 * l'année en cours, un peu à chaque film vu (`profondeur`), sans jamais atteindre le palier
 * suivant ; pleine seulement quand le passeport porte la décennie. Cinq années, puis le tampon :
 * six paliers. Les films vus en avance (années verrouillées) n'y comptent pas.
 */
export const PALIERS = 6
/** Les films de l'année en cours qui la mènent à mi-palier : `p / (p + 4)` croît et n'atteint jamais 1. */
export const DEMI_PALIER = 4

export function remplissage(cases: readonly Pick<CaseVue, 'etat' | 'profondeur'>[], bouclee: boolean): number {
  if (bouclee) return 1
  const bouclees = cases.filter((c) => c.etat !== 'encours' && c.etat !== 'verrou').length
  const enCours = cases.find((c) => c.etat === 'encours')
  const montee = enCours ? enCours.profondeur / (enCours.profondeur + DEMI_PALIER) : 0
  return (Math.min(bouclees, PALIERS - 1) + montee) / PALIERS
}

/** Ce que la foire montre au remplissage `r` (maquette : `dessinCarte`). */
export function quantites(r: number) {
  return {
    fanions: 4 + Math.round(r * 6),
    file: 2 + Math.round(r * 9),
    fouleManege: Math.round(r * 7),
    fouleLanterne: Math.round(r * 5),
    lampions: [2 + Math.round(r * 8), r > 0.35 ? Math.round(r * 7) : 0, r > 0.7 ? Math.round(r * 6) : 0] as const,
  }
}

/** Les cinq ampoules de la baraque : une par année quittée, toutes quand le passeport porte la décennie. */
export function ampoules(quittees: number, bouclee: boolean): boolean[] {
  return Array.from({ length: 5 }, (_, i) => bouclee || i < quittees)
}

import { clamp } from '../../carte/outils'

/**
 * La foire se bâtit (idée 8, validée par le propriétaire le 29 septembre 2026) : un élément par
 * année, construit sous les yeux quand son année s'ouvre (maquette : `CHANTIER`, `SITES`,
 * `ECRITEAUX`, `ECRITEAU_Y`). La lanterne magique n'est d'aucune année : elle est là dès le départ.
 * La grande baraque de 1899 reste en chantier : elle sera le décor des années 1900.
 */
export interface Element {
  annee: number
  /** La durée de la construction, en secondes. */
  duree: number
  /** Où partent les confettis de la fin, en coordonnées de la section. */
  site: readonly [number, number]
  /** L'écriteau du chantier, et sa hauteur dans la section. */
  ecriteau: string
  ecriteauY: number
  /** Vrai : le chantier ne se termine jamais, son équipe reste (le `reste` d'`equipe`). */
  permanent: boolean
}

export const ELEMENTS: readonly Element[] = [
  { annee: 1895, duree: 4, site: [300, 172], ecriteau: 'Le Cinématographe s’installe', ecriteauY: 124, permanent: false },
  { annee: 1896, duree: 4.6, site: [300, 150], ecriteau: 'Les forains montent la baraque', ecriteauY: 16, permanent: false },
  { annee: 1897, duree: 4.2, site: [84, 530], ecriteau: 'On pose le guichet', ecriteauY: 622, permanent: false },
  { annee: 1898, duree: 5, site: [78, 300], ecriteau: 'Les chevaux de bois arrivent', ecriteauY: 226, permanent: false },
  { annee: 1899, duree: 4.4, site: [322, 690], ecriteau: 'Une grande baraque en chantier', ecriteauY: 612, permanent: true },
]

export type Chantier = { etat: 'absent' } | { etat: 'chantier'; k: number } | { etat: 'bati' }

/**
 * L'état de l'élément de `annee` (maquette : `bati(an)`, renommée : `VueMonde.bati` est déjà
 * pris). `ouverte` est `VueMonde.ouverte`, `t` l'horloge du décor. Absent tant que son année n'est
 * pas ouverte ; en chantier, `k` de 0 à 1, pendant sa durée depuis l'arrivée de l'avatar ; bâti
 * ensuite. Déjà fini quand `vivant` est faux (l'horloge figée le laisserait à mi-course) et quand
 * aucune marche ne l'a ouvert sous les yeux (`t0` à -9 : `t − t0` dépasse toute durée). Le chantier
 * permanent finit à `k` = 1, jamais `bati`.
 */
export function chantier(annee: number, ouverte: { annee: number; t0: number }, t: number, vivant: boolean): Chantier {
  const e = ELEMENTS.find((x) => x.annee === annee)
  if (!e || annee > ouverte.annee) return { etat: 'absent' }
  const fin: Chantier = e.permanent ? { etat: 'chantier', k: 1 } : { etat: 'bati' }
  if (annee < ouverte.annee || !vivant) return fin
  const k = clamp((t - ouverte.t0) / e.duree, 0, 1)
  return k < 1 ? { etat: 'chantier', k } : fin
}

/** Le `k` que prend le dessin (le `bati(an)` de la maquette) : 0 absent, 1 fini. */
export const avancement = (c: Chantier): number => (c.etat === 'absent' ? 0 : c.etat === 'chantier' ? c.k : 1)

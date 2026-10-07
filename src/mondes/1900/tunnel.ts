import type { VueMonde } from '../types'
import { lerp } from '../../carte/outils'
import { TUNNEL } from './donnees'
import { lisse, rangSurLaLigne } from './habillage'
import { ANNEES, E } from './trace'

/**
 * Les règles du tunnel (idée 71, sans le ralenti ; maquette : `rendreDecor`, l. 3733-3741) : des
 * fonctions pures, que le trait (`voute.ts`) lit et que les tests gardent. Tout s'y tire d'`avance`
 * seule : ni horloge, ni mémoire. Le tunnel suit le doigt, et se joue à l'envers au retour, la même
 * avance donnant la même image. Quand le visiteur demande moins d'animations, pas de tunnel.
 */

type Table = Readonly<{ de: number; vers: number; milieu: number; demi: number }>

/** De combien une bouche passe à l'écran, et la paroi, pour un pixel de la toile des gares : au premier plan, et plus près encore (maquette : `K_T`, `K_PAROI`, l. 3508). */
export const K_BOUCHE = 2.4
export const K_PAROI = 4.8
/** La largeur d'une bouche à l'écran, et celle du motif de la paroi (maquette : `L_BOUCHE`, l. 3508 ; `.paroi`, l. 1104). */
export const L_BOUCHE = 360
export const L_PAROI = 480
/** Où le noir commence sous la bouche, depuis son bout : au pied-droit de l'arc (maquette, l. 3740). */
const PIED_DROIT = 123
/** La part du chemin, au départ de chaque gare, sur laquelle le tunnel paraît : nul en gare, sur tout écran. */
const ABORD = 0.06

/** Où le tunnel commence et finit sur la ligne, en gares (3,33 et 3,67 : entre 1903 et 1904). */
export function bornesDuTunnel(table: Table = TUNNEL): { entree: number; sortie: number } {
  const milieu = lerp(ANNEES.indexOf(table.de), ANNEES.indexOf(table.vers), table.milieu)
  return { entree: milieu - table.demi, sortie: milieu + table.demi }
}

/**
 * Les quatre temps du tunnel, dans l'ordre de la marche : la bouche de pierre arrive, le noir balaie
 * la vitre, la paroi défile (le noir tient tout l'écran), puis l'autre bouche passe et le jour revient.
 */
export type TempsDuTunnel = 'bouche' | 'noir' | 'paroi' | 'sortie'

export interface TunnelALEcran {
  temps: TempsDuTunnel
  /** Le bout de chaque bouche, en `x` d'écran : le noir est entre les deux. La bouche d'entrée finit à `entree`, celle de sortie commence à `sortie`. */
  entree: number
  sortie: number
  /** La part de l'écran que le noir couvre ; nulle tant qu'il n'y est pas entré, ou qu'il en est sorti. */
  noir: { x: number; w: number } | null
  /** De combien le motif de la paroi a défilé vers la gauche, de 0 à `L_PAROI`. */
  paroi: number
  /** De 0 à 1 : pleine sur un téléphone ; sur un écran large, où la bouche se verrait depuis la gare, elle paraît au départ. */
  presence: number
}

/**
 * Le tunnel à l'écran, nul quand rien ne s'en voit : hors de son intervalle, en gare, pendant le
 * passage de la foire au train (le rang y vaut zéro), et toujours quand le visiteur demande moins
 * d'animations. Les bouches viennent de la droite, dans le sens de la marche.
 */
export function tunnelALEcran(v: Pick<VueMonde, 'W' | 'avance' | 'vivant'>, table: Table = TUNNEL): TunnelALEcran | null {
  if (!v.vivant) return null
  const pg = rangSurLaLigne(v.avance)
  const de = ANNEES.indexOf(table.de)
  const f = (pg - de) / (ANNEES.indexOf(table.vers) - de)
  const presence = lisse(0, ABORD, f) * (1 - lisse(1 - ABORD, 1, f))
  if (presence <= 0) return null
  const bornes = bornesDuTunnel(table)
  const entree = v.W / 2 + (bornes.entree - pg) * E * K_BOUCHE
  const sortie = v.W / 2 + (bornes.sortie - pg) * E * K_BOUCHE
  if (entree - L_BOUCHE >= v.W || sortie + L_BOUCHE <= 0) return null
  const gauche = Math.max(0, entree - PIED_DROIT)
  const droite = Math.min(v.W, sortie + PIED_DROIT)
  const noir = droite > gauche ? { x: gauche, w: droite - gauche } : null
  const plein = noir !== null && noir.x <= 0 && noir.w >= v.W
  const temps: TempsDuTunnel = plein ? 'paroi' : pg >= (bornes.entree + bornes.sortie) / 2 ? 'sortie' : noir ? 'noir' : 'bouche'
  const paroi = (((pg * E * K_PAROI) % L_PAROI) + L_PAROI) % L_PAROI
  return { temps, entree, sortie, noir, paroi, presence }
}

/**
 * Vrai quand le noir du tunnel, plein, tient tout l'écran : l'heure, la lanterne et la météo sont
 * dessous, et le trait s'en passe (la neige d'Allaman commence dans le noir).
 */
export const sousLaVoute = (t: TunnelALEcran | null): boolean => t !== null && t.temps === 'paroi' && t.presence >= 1

import type { Table } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import type { PanneDeBloc } from '../sacoche'

/**
 * Les règles d'une table du wagon-restaurant (plan des écrans des lots, brief 15), sans rendu. **Le
 * serveur décide** du soir, de l'état de l'invité et de « vu ensemble » : rien ne s'en calcule ici.
 * L'horloge de l'appareil ne sert qu'à cacher un geste que le serveur refuserait de toute façon.
 */

/** Qui je suis à cette table : l'hôte quand `hote.id` est le mien, l'invité sinon (une table n'est servie qu'à ses deux convives). */
export type RoleATable = 'hote' | 'invite'
export const roleA = (table: Pick<Table, 'hote'>, moi: string): RoleATable => (table.hote.id === moi ? 'hote' : 'invite')

/**
 * Le jour de Paris d'un instant, `AAAA-MM-JJ` (que `en-CA` écrit ainsi) : à 23 h 30 de Greenwich,
 * c'est déjà demain à Paris. Le format se crée à chaque appel : les tests changent le fuseau de Node.
 */
const jourAParis = (instant: number) =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(instant))

/** Un jour du calendrier, sans heure, en instant : deux jours se comparent en instants, jamais en chaînes. */
const minuit = (jour: string) => Date.parse(`${jour}T00:00:00Z`)

/**
 * Le soir d'une table (`soir`, un jour de Paris sans heure) est-il passé, à Paris, à l'instant
 * `maintenant` ? Jamais le fuseau de l'appareil, jamais le jour de Greenwich. Un soir illisible est
 * passé : rien ne s'y offre.
 */
export function soirPasse(soir: string, maintenant: number): boolean {
  return !(minuit(soir) >= minuit(jourAParis(maintenant)))
}

/** Ce qui s'offre sur une table. */
export interface GestesDeTable {
  prendre: boolean
  decliner: boolean
}

/**
 * Les gestes offerts : à **l'invité** seulement (l'hôte n'en a aucun : il ne retire pas sa table), et
 * tant que le soir n'est pas passé à Paris. Une invitation qui attend : « Prendre ma place » et
 * « Décliner ». Place prise : « Décliner » reste. **Déclinée, plus rien** : elle ne se reprend pas.
 */
export function gestesOfferts(table: Pick<Table, 'hote' | 'soir' | 'etat'>, moi: string, maintenant: number): GestesDeTable {
  if (roleA(table, moi) !== 'invite' || soirPasse(table.soir, maintenant)) return { prendre: false, decliner: false }
  return { prendre: table.etat === 'attend', decliner: table.etat !== 'a_decline' }
}

/** Une de mes tables, telle que servie, et ce que la page en sait. */
export interface TableDuWagon {
  /** La table **telle que servie** : `etat` est celui de l'invité, `vu_ensemble` celui du serveur, jamais déduit. */
  table: Table
  role: RoleATable
  /** Son soir est passé à Paris : elle ne se joue plus. */
  passee: boolean
  gestes: GestesDeTable
  /** Une écriture est partie pour cette table et n'est pas revenue. */
  enCours: boolean
  /** Ce que le serveur a dit d'un geste refusé ou tombé, tel quel. **Jamais pour un `409`** : les tables se relisent, sans un mot. */
  refus: string | null
}

/**
 * Ce que reçoit le dessin du wagon-restaurant (`GabaritsDesPages.wagonRestaurant`, sans défaut) : mes
 * tables **dans l'ordre servi** (du soir le plus récent au plus ancien ; plusieurs invitations peuvent
 * attendre le même soir : une liste, pas une scène unique), et les deux gestes de l'invité.
 * `pages/VoyageWagonRestaurant.tsx` garde la région, le retour, la lecture, les deux écritures et leur
 * verrou : le dessin ne lit ni n'écrit rien.
 */
export interface PropsWagonRestaurant {
  monde: Monde
  /** Mon pseudo. */
  moi: string
  /** Mes tables sont en panne : la page le dit, et rien d'autre. */
  panne: PanneDeBloc | null
  /** Nul en panne ; vide : aucune table. */
  tables: readonly TableDuWagon[] | null
  prendre: (id: string) => void
  decliner: (id: string) => void
}

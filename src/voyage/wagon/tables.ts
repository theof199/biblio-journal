import type { Table, Tables } from '../../api/voyage'
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

/**
 * Le soir d'une table est-il **ce soir**, à Paris, à l'instant `maintenant` ? Ni hier, ni demain
 * (`soirPasse` rend faux pour un soir à venir). Un soir illisible n'est pas ce soir.
 */
export function ceSoirMeme(soir: string, maintenant: number): boolean {
  return minuit(soir) === minuit(jourAParis(maintenant))
}

/**
 * Les tables qui ouvrent la porte du wagon-restaurant sur la fiche de mon année en cours (plan des
 * écrans des lots, brief 16, décision 10) : celles de **ce soir**, où je suis l'hôte ou l'invité,
 * **que je n'ai pas déclinées**, dans l'ordre servi. Une table d'hier n'ouvre rien. **Une table que
 * mon invité a déclinée ne compte pas quand une autre existe** : l'hôte a retrouvé sa soirée, la porte
 * ne dit pas « 2 tables » pour une rendue et une qui attend. Seule, elle ouvre encore la porte, qui dit
 * que l'invité a rendu sa place ; plusieurs rendues et rien d'autre, la première servie seulement.
 * L'horloge de l'appareil ne fait que cacher une porte : la page du wagon relit tout.
 */
export function tablesDeLaPorte(tables: readonly Table[], moi: string, maintenant: number): Table[] {
  // Passé ce filtre, une table déclinée l'est par mon invité : les miennes d'invité sont parties.
  const ceSoir = tables.filter((t) => ceSoirMeme(t.soir, maintenant) && !(roleA(t, moi) === 'invite' && t.etat === 'a_decline'))
  const tenues = ceSoir.filter((t) => t.etat !== 'a_decline')
  return tenues.length > 0 ? tenues : ceSoir.slice(0, 1)
}

const AUCUN_BILLET: ReadonlySet<string> = new Set()
/**
 * Les billets qui portent le tampon « Vu ensemble », par l'identifiant de leur **entrée de journal**
 * (`mon_billet.id`), jamais par film : une autre séance du même film n'en porte pas. **`vu_ensemble`
 * se lit tel que servi** : une place prise ne tamponne rien, un billet servi sans lui non plus.
 */
export function entreesVuesEnsemble(tables: Tables | undefined): ReadonlySet<string> {
  if (!tables) return AUCUN_BILLET
  return new Set(tables.tables.flatMap((t) => (t.vu_ensemble && t.mon_billet ? [t.mon_billet.id] : [])))
}

/** Où mène la porte, et où mène une table qu'on vient de dresser. */
export const VERS_LE_WAGON = '/voyage/wagon-restaurant'

/**
 * Ce que reçoit le dessin de la porte du wagon-restaurant (`GabaritsDesPages.porteDuWagon`, sans
 * défaut) : mes tables de ce soir, **jamais vide**, dans l'ordre servi, chacune avec mon rôle, et
 * l'adresse du wagon. `voyage/wagon/Porte.tsx` lit ; le dessin ne lit rien et ne décide de rien.
 */
export interface PropsPorteDuWagon {
  monde: Monde
  tables: readonly { table: Table; role: RoleATable }[]
  vers: string
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
  /** Ce que le serveur a dit d'un geste refusé ou tombé, tel quel, `409` compris (les tables se relisent alors) ; nul dès le geste suivant. */
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

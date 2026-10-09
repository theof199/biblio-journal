import { formatDateVisionnage } from '../../../ui/format'
import type { RoleATable } from '../../../voyage/wagon/tables'
import type { Table } from '../../../api/voyage'
import { MOTS_DU_COMPOSTEUR, datePressee } from './carton'

/**
 * Les mots du wagon-restaurant de 1900 (maquette « Voyage immobile 1900 », écran 20, l. 2463-2476 et
 * 4137-4155), ramenés à ce que le contrat sert (constat 17 du plan des écrans des lots) : un membre
 * dresse la table et invite un membre qu'il suit ; le menu ne dit que le titre et « ce soir » (`film`
 * ne porte ni réalisateur, ni année, ni durée) ; « Composter à deux » n'existe pas (la table ne mène à
 * aucun billet). **« Vu ensemble » se lit sur `vu_ensemble`, jamais sur l'état.**
 */
export const MOTS_DU_WAGON = {
  sur: 'Compagnie du Voyage',
  titre: 'Le wagon-restaurant',
  ceSoir: 'Ce soir',
  aucune: 'Aucune table ce soir.',
  passees: 'Les soirs passés',
  moi: 'Toi',
  menu: 'Menu',
  plat: 'Le plat du soir',
  service: 'servi pour deux',
  prendre: 'Prendre ma place',
  decliner: 'Décliner',
  rienNeSePerd: 'rien ne se perd',
  vuEnsemble: 'Vu ensemble',
  monBillet: 'Ton billet',
  porte: 'Wagon-restaurant',
  aDeux: 'le même film, à deux, ce soir',
} as const

type Convives = Pick<Table, 'hote' | 'invite' | 'etat'>

/** Le nom d'une table, pour qui ne la voit pas : la mienne, ou celle de son hôte. */
export const nomDeLaTable = (t: Convives, role: RoleATable): string => (role === 'hote' ? `Ta table, avec ${t.invite.pseudo}` : `La table de ${t.hote.pseudo}`)

/** « ce soir, avec bob » : sous « Prendre ma place ». */
export const avecLHote = (t: Convives): string => `ce soir, avec ${t.hote.pseudo}`

/** Le carton d'un convive : son nom (« Toi » pour moi) et ce qu'il en est de sa place. */
export interface CartonDeTable {
  nom: string
  dit: string
}

/** L'hôte est à sa table dès qu'il la dresse : son carton ne dépend pas de l'état. */
export const cartonDeLHote = (t: Convives, role: RoleATable): CartonDeTable =>
  role === 'hote' ? { nom: MOTS_DU_WAGON.moi, dit: 'tu as pris ta place' } : { nom: t.hote.pseudo, dit: 'a pris sa place' }

const DE_L_INVITE: Record<Table['etat'], { moi: string; lui: string }> = {
  attend: { moi: 'ta place t’attend', lui: 'sa place l’attend' },
  a_pris_sa_place: { moi: 'tu as pris ta place', lui: 'a pris sa place' },
  a_decline: { moi: 'place rendue', lui: 'place rendue' },
}
/** Le carton de l'invité dit `etat`, tel que servi. */
export const cartonDeLInvite = (t: Convives, role: RoleATable): CartonDeTable =>
  role === 'invite' ? { nom: MOTS_DU_WAGON.moi, dit: DE_L_INVITE[t.etat].moi } : { nom: t.invite.pseudo, dit: DE_L_INVITE[t.etat].lui }

const TAMPON = 'Si vous voyez tous deux le film, vos billets porteront le même tampon.'
/**
 * Ce que dit une table de ce soir, sous ses gestes. `vu_ensemble` l'emporte, **lu tel quel** ; sinon
 * l'état de l'invité, dit à l'invité ou à l'hôte.
 */
export function ceQueDitLaTable(t: Convives & Pick<Table, 'vu_ensemble'>, role: RoleATable): string {
  if (t.vu_ensemble) return `Vous l’avez vu tous les deux : « ${MOTS_DU_WAGON.vuEnsemble} ».`
  if (role === 'invite') {
    if (t.etat === 'attend') return `${t.hote.pseudo} t’invite à sa table, ce soir seulement.`
    if (t.etat === 'a_pris_sa_place') return `Deux couverts ce soir : ton verre est servi. ${TAMPON}`
    return `Place rendue : ${t.hote.pseudo} garde la sienne. Rien ne se perd.`
  }
  if (t.etat === 'attend') return `${t.invite.pseudo} n’a pas encore pris sa place.`
  if (t.etat === 'a_pris_sa_place') return `${t.invite.pseudo} a pris sa place : deux couverts ce soir. ${TAMPON}`
  return `${t.invite.pseudo} a rendu sa place : ta soirée est libre.`
}

const D_UN_SOIR_PASSE: Record<Table['etat'], string> = { attend: 'n’a pas eu lieu', a_pris_sa_place: 'place prise', a_decline: 'place rendue' }
/**
 * Un soir passé, en une ligne : son jour (`soir` est un jour du calendrier sans heure, dit découpé,
 * hors du fuseau de l'appareil), le film, à quelle table, et ce qu'il en est resté. Une table qui
 * attendait encore n'a pas eu lieu.
 */
export function soirPasseDit(t: Convives & Pick<Table, 'soir' | 'film' | 'vu_ensemble'>, role: RoleATable): { jour: string; titre: string; ou: string; reste: string } {
  return {
    jour: formatDateVisionnage(t.soir),
    titre: t.film.titre,
    ou: role === 'hote' ? `à ta table, avec ${t.invite.pseudo}` : `à la table de ${t.hote.pseudo}`,
    reste: t.vu_ensemble ? MOTS_DU_WAGON.vuEnsemble : D_UN_SOIR_PASSE[t.etat],
  }
}

/**
 * Mon billet d'une table vue à deux (brief 16) : ce que son carton porte, ou rien. **`vu_ensemble` se
 * lit tel que servi**, et le billet est `mon_billet`, le mien seul : celui de l'autre convive n'est pas
 * servi. Ni place prise ni billet sans `vu_ensemble` ne tamponnent rien. Le contrat ne dit pas son
 * numéro dans la décennie : le carton n'en porte pas ici, le casier le dit.
 */
export function monBilletTamponne(t: Pick<Table, 'film' | 'vu_ensemble' | 'mon_billet'>, tampon: string, autour: string) {
  if (!t.vu_ensemble || !t.mon_billet) return null
  const jour = formatDateVisionnage(t.mon_billet.finished_at)
  return {
    tete: MOTS_DU_COMPOSTEUR.compagnie,
    titre: t.film.titre,
    sous: `${MOTS_DU_WAGON.moi.toLowerCase()} · ${jour}`,
    note: t.mon_billet.rating,
    presse: datePressee(t.mon_billet.finished_at),
    tampon: { mot: tampon, dit: `${tampon} : ${autour} ${jour}` },
    ensemble: MOTS_DU_COMPOSTEUR.ensemble,
  }
}

/**
 * Ce que dit la porte du wagon-restaurant, sur la fiche de mon année en cours (maquette, écran 17 :
 * `.lien-wr`, « Léa a pris sa place : le même film, à deux, ce soir »). Une table : l'état de l'invité,
 * dit à l'hôte ou à l'invité. Plusieurs le même soir : leur compte.
 */
export function ceQueDitLaPorte(tables: readonly { table: Convives; role: RoleATable }[]): string {
  if (tables.length !== 1) return `${tables.length} tables t’attendent ce soir`
  const { table: t, role } = tables[0]!
  const A_DEUX = MOTS_DU_WAGON.aDeux
  if (role === 'invite') return t.etat === 'a_pris_sa_place' ? `Ta place est prise à la table de ${t.hote.pseudo} : ${A_DEUX}` : `${t.hote.pseudo} t’invite à sa table : ${A_DEUX}`
  if (t.etat === 'a_pris_sa_place') return `${t.invite.pseudo} a pris sa place : ${A_DEUX}`
  if (t.etat === 'a_decline') return `${t.invite.pseudo} a rendu sa place : ta table reste dressée ce soir`
  return `${t.invite.pseudo} n’a pas encore pris sa place : ${A_DEUX}`
}

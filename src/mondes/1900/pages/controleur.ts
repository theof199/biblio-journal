import { numeroLisible } from '../../../voyage/billets'
import type { EtatDuControle } from '../../../voyage/controleur/Controleur'
import { decennieDe } from '../../../voyage/regles'
import { ligneDuFilm } from './carton'

/**
 * Les mots et les règles du contrôleur des billets qui passe sur la carte de 1900 (maquette « Voyage
 * immobile 1900 », l. 4076-4096), sans rendu. La note « sans titre de transport » de la maquette n'est
 * pas portée : aucune donnée ne marque un billet (plan des écrans des lots, constat 7). Les mots du
 * carton sont ceux du composteur (`carton.ts`), celui du tampon est au monde (`mots.billet`).
 */
export const MOTS_DU_CONTROLEUR = {
  nom: 'Le contrôleur',
  demande: '« Contrôle des billets, s’il vous plaît. »',
  enRegle: '« En règle. Bon voyage ! »',
  bonneSoiree: '« Bonne soirée. »',
  ilDemande: 'Il demande ton dernier billet. Rien n’oblige à le montrer.',
  pasDePoincon: 'Pas de poinçon, pas de pénalité : rien ne se perd. Il repassera une autre semaine.',
  presenter: 'Présenter le billet',
  refuser: 'Pas ce soir',
  refermer: 'Refermer la portière',
} as const

const M = MOTS_DU_CONTROLEUR

/** Ce que dit le contrôleur, dans sa bulle. */
export const bulleDuControleur = (etat: EtatDuControle): string => (etat === 'presente' ? M.enRegle : etat === 'refuse' ? M.bonneSoiree : M.demande)

/**
 * Ce qui se passe, sous le billet. Présenté : le coup de poinçon, sur le billet nommé par son numéro
 * quand la boîte l'a donné, sur « ton billet » sinon. La maquette y ajoutait « il se voit aussi sur
 * l'écran 7 », un mot de maquette.
 */
export function ceQuiSePasse(etat: EtatDuControle, numero: number | null): string {
  if (etat === 'demande') return M.ilDemande
  if (etat === 'refuse') return M.pasDePoincon
  return `Un coup de poinçon doré sur ${numero !== null ? `le billet ${numeroLisible(numero)}` : 'ton billet'}. Le contrôleur ne repassera pas de la semaine.`
}

/** La décennie dont chaque année est une gare. */
const DECENNIE = 1900

/**
 * La ligne du film sur le billet demandé. Le contrôleur demande mon dernier billet de film, de quelque
 * année qu'il soit : « gare de 1903 » ne se dit que d'une année de la ligne, les autres n'ont pas de
 * gare et disent leur année seule. Sans année, le réalisateur seul ; sans rien, pas de ligne.
 */
export function ligneDuBilletDemande(realisateur: string | null, annee: number | null): string | null {
  if (annee !== null && decennieDe(annee) === DECENNIE) return ligneDuFilm(realisateur, annee)
  return [realisateur?.trim() || null, annee].filter((x) => x !== null).join(' · ') || null
}

import type { Tampon } from '../../../voyage/passeport'

/**
 * Les mots et les règles de la sacoche des années 1900 (maquette, écran 15), sans rendu. Les régions
 * « Passeport » et « Portefeuille » gardent le nom que la page leur donne ; celle des coulisses prend
 * le titre d'ici. Les mots de la malle sont dans `malle.ts` ; le courrier et les objets trouvés de
 * l'écran 15 n'en ont pas encore : ils viennent avec leurs lots.
 */
export const MOTS_DE_LA_SACOCHE = {
  compagnie: 'Chemins de fer du Voyage',
  titre: 'Sacoche du voyageur',
  passeport: { titre: 'Le passeport', sous: 'une page par décennie', attente: '…', vide: 'Aucun tampon encore' },
  page: { pose: 'Tampon posé', enCours: 'En cours', recompenses: 'récompenses' },
  portefeuille: { titre: 'Le portefeuille', sous: 'les tickets', attente: '…', vide: 'Aucun ticket', pour: 'Ticket pour', utilise: 'utilisé le', utiliser: 'Utiliser' },
  coulisses: { titre: 'Les coulisses', depenses: 'Dépenses', credits: 'Crédits des images', note: 'Une estimation au tarif public d’Anthropic : la facture du compte Anthropic fait foi.' },
} as const

/** Ce que dit une page du passeport sous son dessin : son tampon est posé, ou la décennie est en cours. */
export const etatDeLaPage = (tampon: Tampon | null): string => (tampon ? MOTS_DE_LA_SACOCHE.page.pose : MOTS_DE_LA_SACOCHE.page.enCours)

/** « 4/10 », au cœur de l'anneau : les années récompensées sur toutes, telles que la page les passe. */
export const compteDeLAnneau = ({ faites, total }: { faites: number; total: number }): string => `${faites}/${total}`

/** La part de l'anneau qui se remplit, de 0 à 1 ; rien pour une décennie sans année. */
export const partDeLAnneau = ({ faites, total }: { faites: number; total: number }): number => (total > 0 ? Math.min(1, faites / total) : 0)

/** Le nom du geste pour qui ne voit pas le ticket : le même que celui du défaut. */
export const libelleDUtiliser = (annee: number): string => `${MOTS_DE_LA_SACOCHE.portefeuille.utiliser} le ticket pour ${annee}`

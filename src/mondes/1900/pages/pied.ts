/**
 * Les mots et les règles du bas d'une gare (les derniers écrans de 1900, brief 3), sans rendu : le
 * ticket qui attend, le billet utilisé et la dépêche du jury. La maquette ne dessine pas cet écran : il
 * est fait par analogie avec son « Bon pour » (écrans 12 et 13), son portefeuille (écran 15) et ses
 * dépêches (`.depeche`), analogies validées le 9 octobre 2026. Le nom de la région du ticket reste
 * celui du défaut, « Ton ticket ».
 */
export const MOTS_DU_PIED = {
  region: 'Ton ticket',
  titre: 'Au guichet',
  attend: 'ton ticket t’attend',
  servi: 'ton ticket a servi',
  utilise: 'utilisé le',
  retourner: 'Toucher le ticket pour le retourner',
  depeche: 'Dépêche télégraphique',
  verdict: 'Pas encore mûre',
} as const

/** Le bouton du ticket qui attend (maquette, écran 12 : « Utiliser le ticket de 1906 »). */
export const libelleDuTicket = (annee: number): string => `Utiliser le ticket de ${annee}`

/** Le dos du billet utilisé : ce qu'il valait, d'où il vient, où il a servi. Plus un mot de la foire. */
export const dosDuBillet = (annee: number, ticket: number): string =>
  `Valable pour une gare entière de la ligne, correspondances et train du soir compris. Délivré en ${annee}, tamponné à l’entrée de ${ticket}. Ni repris ni échangé.`

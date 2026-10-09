/**
 * Les mots et les règles de la séance Hale's Tours, la fiche d'un film des années 1900 (maquette
 * « Voyage immobile 1900 », écran 5), sans rendu. « Trois photogrammes », le studio et le mois de
 * sortie de la maquette ne sont pas repris : aucune donnée ne les porte. Le geste qui mène au billet
 * (« Composter une séance ») est un mot du monde, `mots.billet.ouvrir`.
 */
export const MOTS_DE_LA_SEANCE = {
  voiture: 'Voiture',
  titre: 'La séance Hale’s Tours',
  vignette: 'L’entrée d’un Hale’s Tours : « Trains every 10 minutes »',
  // La légende, en trois morceaux : celui du milieu se lit en gras.
  legende: ['Dès 1905, à Kansas City, les ', 'Hale’s Tours', ' projettent des vues de chemin de fer au bout d’une fausse voiture qui tangue. La fiche d’un film se regarde de là : assis, l’écran au bout de l’allée.'],
  seances: 'Tes séances',
  corriger: 'Corriger',
  corrigerSous: 'ta note, tes réactions',
  plex: 'Voir sur le Plex',
  podium: 'Mettre sur le podium',
  table: 'Dresser une table',
  tableSous: 'au wagon-restaurant, ce soir',
  demander: 'Demander sur Sir',
  demande: 'demandé',
  introuvable: 'Introuvable',
  remettre: 'Le remettre à voir',
  film: 'Le film',
} as const

/** Ce que dit la fausse voiture à qui ne la voit pas : l'écran au bout, et le film qu'il projette. */
export const libelleDeLaVoiture = (titre: string): string => `Une fausse voiture de chemin de fer : au bout, l’écran projette ${titre}`

/**
 * « Tes séances », en une phrase (maquette : « Vu le 14 septembre 2026 · 8 sur 10 · « Frissons ». ») :
 * la date de mon dernier visionnage quand il est retrouvé, la note que l'API rend pour le film, mes
 * réactions. La remarque du carnet est privée : elle n'y entre jamais. Le nombre de séances de la
 * maquette (« 1 fois ») demanderait de lire tout le journal : il n'est pas repris.
 */
export function phraseDesSeances(note: number | null, seance: { date: string; reactions: readonly string[] } | null): string {
  const morceaux = [seance ? `Vu le ${seance.date}` : 'Vu', note !== null ? `${note} sur 10` : 'sans note']
  if (seance && seance.reactions.length > 0) morceaux.push(seance.reactions.map((r) => `« ${r} »`).join(', '))
  return `${morceaux.join(' · ')}.`
}

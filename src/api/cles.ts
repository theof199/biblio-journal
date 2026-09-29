export const cles = {
  session: ['session'] as const,
  voyage: ['voyage'] as const,
  tickets: ['voyage', 'tickets'] as const,
  annee: (annee: number) => ['voyage', 'annee', annee] as const,
  journal: ['journal'] as const,
  reactions: ['reactions'] as const,
  stats: ['stats'] as const,
  plex: ['plex'] as const,
  /**
   * « Tes séances » (Au ciné) : le journal filtré `en_salle`, une clé à part de `journal` —
   * pagination indépendante — mais sous son préfixe, pour que toute invalidation de `journal`
   * (`Formulaire.tsx`, après une écriture) la périme aussi.
   */
  seances: ['journal', 'seances'] as const,
  sorties: ['sorties'] as const,
  realisateurs: ['realisateurs'] as const,
  pageRealisateur: (tmdbId: number) => ['realisateurs', tmdbId, 'page'] as const,
  sagas: ['sagas'] as const,
  filmsSaga: (tmdbId: number) => ['sagas', tmdbId, 'films'] as const,
}

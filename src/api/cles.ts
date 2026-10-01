export const cles = {
  session: ['session'] as const,
  voyage: ['voyage'] as const,
  tickets: ['voyage', 'tickets'] as const,
  annee: (annee: number) => ['voyage', 'annee', annee] as const,
  /**
   * Le carton d'un film (`GET /reference/chroniques/films/{tmdbId}`) : hors du préfixe `voyage`, un
   * carton ne change pas avec le journal, et l'invalidation qui suit une écriture ne le relit pas.
   */
  carton: (tmdbId: number) => ['chroniques', 'film', tmdbId] as const,
  journal: ['journal'] as const,
  reactions: ['reactions'] as const,
  stats: ['stats'] as const,
  plex: ['plex'] as const,
  senscritique: ['senscritique'] as const,
  /** Les films à apparier : sous le préfixe `senscritique`, mais l'état se pose et se périme en `exact`, sans les relire. */
  senscritiqueAApparier: ['senscritique', 'a-apparier'] as const,
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

  /**
   * Le journal entier, à plat (bilan et graphiques du profil) : sous le préfixe `journal`, pour
   * que l'invalidation qui suit une écriture le périme aussi.
   */
  journalComplet: ['journal', 'complet'] as const,
  /**
   * Mes visionnages des films sortis de `de` à `a` (la boîte à billets, la page d'une décennie, plan
   * 2c) : sous le préfixe `journal`, périmés comme lui par toute écriture au journal.
   */
  journalDesAnnees: (de: number, a: number) => ['journal', 'annees', de, a] as const,
}

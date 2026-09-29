export const cles = {
  session: ['session'] as const,
  voyage: ['voyage'] as const,
  tickets: ['voyage', 'tickets'] as const,
  annee: (annee: number) => ['voyage', 'annee', annee] as const,
  journal: ['journal'] as const,
  reactions: ['reactions'] as const,
  stats: ['stats'] as const,
  plex: ['plex'] as const,
  /** « Tes séances » (Au ciné) : le journal filtré `en_salle`, une clé à part de `journal` — pagination indépendante. */
  seances: ['journal', 'seances'] as const,
  sorties: ['sorties'] as const,
}

export const cles = {
  session: ['session'] as const,
  voyage: ['voyage'] as const,
  tickets: ['voyage', 'tickets'] as const,
  annee: (annee: number) => ['voyage', 'annee', annee] as const,
}

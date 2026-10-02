/** Les dix verdicts d'une note, du pire au meilleur : celui de la note 1 en premier. */
const VERDICTS = ['Navet', 'Raté', 'Faible', 'Bof', 'Moyen', 'Pas mal', 'Bien', 'Très bien', 'Excellent', 'Chef-d’œuvre'] as const

/** Le mot d'une note de 1 à 10 ; nul hors de cette plage, ou pour une note qui n'est pas un entier. */
export function verdictDe(note: number): string | null {
  return VERDICTS[note - 1] ?? null
}

/** « Très bien · 8/10 » : ce que le crayon écrit à côté de « Mon avis » ; vide sans note. */
export function noteEnMots(note: number | null): string {
  const verdict = note == null ? null : verdictDe(note)
  return note == null || verdict == null ? '' : `${verdict} · ${note}/10`
}

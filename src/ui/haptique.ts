/**
 * L'haptique : Android l'honore, Safari n'a pas `navigator.vibrate` (données de compatibilité de
 * MDN), et Chrome rend `false` sans geste de l'utilisateur. Un plus, jamais le seul signal.
 */
export function vibrer(motif: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(motif)
}

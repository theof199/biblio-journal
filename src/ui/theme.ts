/**
 * Le réglage jour / nuit du membre. « Auto » suit le téléphone : `theme.css` ne force rien tant que
 * `<html>` ne porte pas `data-theme`. Gardé localement, jamais envoyé au back : c'est une préférence
 * de cet appareil, pas du compte.
 */
export type ChoixTheme = 'auto' | 'clair' | 'sombre'

const CLE_STOCKAGE = 'journal.theme'
const CHOIX: readonly ChoixTheme[] = ['auto', 'clair', 'sombre']

/** `localStorage` peut être absent (navigation privée) ou lever : on retombe sur « auto » plutôt que de casser l'écran. */
export function lireTheme(): ChoixTheme {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE)
    return CHOIX.find((choix) => choix === brut) ?? 'auto'
  } catch {
    return 'auto'
  }
}

export function ecrireTheme(choix: ChoixTheme): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, choix)
  } catch {
    // Rien à faire : le choix s'applique à la session, seul son souvenir ne survit pas.
  }
}

/** « Auto » ôte l'attribut : c'est la feuille de style, pas ce module, qui suit le téléphone. */
export function appliquerTheme(choix: ChoixTheme): void {
  if (choix === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', choix)
}

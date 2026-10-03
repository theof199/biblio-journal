import { Component, type ReactNode } from 'react'
import Panne from '../ui/Panne'

interface FiletProps {
  children: ReactNode
}

interface FiletEtat {
  erreur: unknown
  enErreur: boolean
}

/**
 * Rattrape l'erreur d'une page de la coque, un morceau introuvable compris, pour montrer `Panne`
 * au lieu d'une page blanche : la barre d'onglets, hors du filet, reste à l'écran. À poser avec
 * `key={pathname}` : changer d'onglet démonte le filet et lui rend son état sain.
 */
export class Filet extends Component<FiletProps, FiletEtat> {
  state: FiletEtat = { erreur: null, enErreur: false }

  static getDerivedStateFromError(erreur: unknown): FiletEtat {
    return { erreur, enErreur: true }
  }

  render() {
    if (!this.state.enErreur) return this.props.children
    // Recharger et non remettre l'état à zéro : un morceau manquant reste manquant dans le cache de
    // `lazy`, seul un `index.html` neuf renvoie vers les bons noms de fichiers.
    return <Panne erreur={this.state.erreur} onReessayer={() => window.location.reload()} />
  }
}

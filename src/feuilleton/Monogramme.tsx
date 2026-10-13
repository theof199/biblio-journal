import type { CSSProperties } from 'react'

interface Props {
  /** Le pseudo du membre : sa première lettre fait le monogramme. */
  pseudo: string
  /** Sa couleur d'identité (`identity_color`), une donnée du membre et non une couleur de l'app. */
  couleur: string
  className?: string
}

/**
 * Le monogramme d'un membre, à sa couleur d'identité. Il ne fait que poser `--identite` sur sa pièce,
 * comme le profil le fait sur sa page : ce qu'on en fait (le fond, la lettre) reste à l'habillage du
 * chapitre (`--h-mono-fond`, `--h-mono-texte`, `docs/feuilleton/habillages.md`). Hors de
 * `telecommande/`, dont les composants ne portent aucun style.
 */
export default function Monogramme({ pseudo, couleur, className }: Props) {
  return (
    <span className={className} data-piece="monogramme" style={{ '--identite': couleur } as CSSProperties} aria-hidden="true">
      {pseudo.slice(0, 1).toUpperCase()}
    </span>
  )
}

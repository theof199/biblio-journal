import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { EtatFronton, LigneFronton } from './fronton'
import { longueurDeLecture } from './titre'
import styles from './Fronton.module.css'

/** La longueur du texte, que la feuille lit pour réduire les lettres à la largeur du panneau. */
const largeurDeLigne = (ligne: LigneFronton, longueur = ligne.texte.length): CSSProperties => ({ '--longueur': longueur }) as CSSProperties

const longueurDeTitreCompact = (lignes: readonly LigneFronton[]): number =>
  longueurDeLecture(
    lignes
      .filter((ligne) => ligne.role === 'titre' || ligne.role === 'titreCompact')
      .map((ligne) => ({ texte: ligne.texte, compacte: ligne.role === 'titreCompact' })),
  )

function Ligne({ ligne, longueurCompacte }: { ligne: LigneFronton; longueurCompacte: number }) {
  const classe = `${styles.ligne} ${styles[ligne.role]}`
  // Le jour est le titre de la page : la seule ligne qui n'est pas un simple texte.
  if (ligne.role === 'jour') {
    return (
      <h1 className={classe} style={largeurDeLigne(ligne)}>
        {ligne.texte}
      </h1>
    )
  }
  // Les lettres de titre se peignent deux fois (le corps, puis la face lumineuse ou dorée) : la feuille
  // relit le texte dans `data-texte` pour la seconde couche, sans le doubler dans le document.
  const titre = ligne.role === 'titre' || ligne.role === 'titreCompact'
  const longueur = ligne.role === 'titreCompact' ? longueurCompacte : ligne.texte.length
  return (
    <div className={classe} style={largeurDeLigne(ligne, longueur)} data-texte={titre ? ligne.texte : undefined}>
      {ligne.texte}
    </div>
  )
}

/**
 * Le fronton de l'accueil : le panneau à lettres d'un cinéma, entre deux rangées d'ampoules. Un seul
 * lien, vers ce qu'il annonce. Le cadre et les ampoules ne changent pas ; l'enseigne au-dedans est
 * celle de la décennie du film (`data-decennie`, lu par `theme.css`).
 */
export default function Fronton({ etat }: { etat: EtatFronton }) {
  const longueurCompacte = longueurDeTitreCompact(etat.lignes)
  return (
    <Link to={etat.cible.to} state={etat.cible.state} className={styles.fronton} data-decennie={etat.decennie}>
      <div className={styles.ampoules} aria-hidden="true" />
      <div className={styles.panneau}>
        {etat.lignes.map((ligne, indice) => (
          <Ligne key={indice} ligne={ligne} longueurCompacte={longueurCompacte} />
        ))}
      </div>
      <div className={styles.ampoules} aria-hidden="true" />
    </Link>
  )
}

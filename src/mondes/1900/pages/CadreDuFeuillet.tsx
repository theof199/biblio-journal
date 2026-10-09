import { useMouvementReduit } from '../../../ui/mouvement'
import type { PropsCadreDuFeuillet } from '../../../voyage/Feuillet'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import styles from './Feuillet.module.css'

/**
 * Le cadre d'un feuillet des années 1900 (`feuillet`) : une feuille détachée du carnet à souches du
 * contrôleur. La maquette ne dessine aucun feuillet : celui-ci est fait par analogie avec ses talons
 * (`.talons` : le pointillé, le bouton au filet d'encre), ses choix (`.a-choix`) et le carnet du
 * composteur (écran 6), analogie validée le 9 octobre 2026. Le bord dentelé de la souche, le titre en
 * capitales, « Fermer » en talon, le pointillé ; dessous, les choix du site, tels quels, qui défilent
 * seuls : la tête ne passe jamais sur eux. `Feuillet` garde le dialogue, le focus, Échap, le voile et
 * la fermeture. La feuille ne se détache (son entrée) que hors du calme.
 */
export default function CadreDuFeuillet({ titre, idDuTitre, fermer, onFermer, children }: PropsCadreDuFeuillet) {
  const calme = useMouvementReduit()
  return (
    <div className={styles.cadre} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.tete}>
        <h2 id={idDuTitre}>{titre}</h2>
        <button ref={fermer} type="button" className={styles.fermer} onClick={onFermer}>
          Fermer
        </button>
      </div>
      <div className={styles.choix}>{children}</div>
    </div>
  )
}

import type { RefObject } from 'react'
import { IconChevronDown, IconChevronLeft } from '@tabler/icons-react'
import type { Habillage } from '../habillages'
import { useTelecommande } from './adresse'
import Coquille, { NOMS, PARENTES } from './Coquille'
import { useDialogue } from './dialogue'
import VueTelecommande from './VueTelecommande'
import { useTelecommandeVivante } from './vivante'
import { ecrireLaVue } from './vues'
import styles from './Panneau.module.css'

interface Props {
  habillage: Habillage
  chapitre: string
  /** Le bouton rond : c'est à lui que le focus revient à la fermeture. */
  boutonRond: RefObject<HTMLElement>
  /** Une invitation « vu à deux » attend : le voyant du bandeau. Sans elle, pas de voyant. */
  invitation: boolean
}

/**
 * Le panneau de la télécommande : un dialogue qui monte du bas, sous la barre d'onglets qui reste
 * touchable, le même côté Travail et côté Maison. Il ne se charge qu'à l'ouverture (`paresseux`,
 * `Feuilleton.tsx`). Ouvert ou non, et sur quelle vue : c'est l'adresse qui le dit (`adresse.ts`).
 * Tout ce qui s'en voit vient de l'habillage du chapitre, par ses variables `--h-*`.
 */
export default function Panneau({ habillage, chapitre, boutonRond, invitation }: Props) {
  const { vue, precedente, allerA, revenir, fermer } = useTelecommande()
  const boite = useDialogue<HTMLElement>(fermer, boutonRond, vue ? ecrireLaVue(vue) : '')
  const vivante = useTelecommandeVivante()
  if (!vue) return null

  const retour = vue.nom === 'telecommande' ? null : (precedente ?? PARENTES[vue.nom])

  return (
    <div className={`${styles.dialogue} ${habillage.classe}`} data-chapitre={chapitre}>
      <div className={styles.voile} data-piece="voile" onClick={fermer} />
      <section ref={boite} role="dialog" aria-modal="true" aria-label="Télécommande" tabIndex={-1} className={styles.boitier} data-piece="boitier" data-vue={vue.nom}>
        <header className={styles.bandeau}>
          {retour ? (
            <button type="button" className={styles.touche} data-piece="touche" aria-label={`Retour : ${NOMS[retour.nom]}`} onClick={() => revenir(retour)}>
              <IconChevronLeft aria-hidden="true" className={styles.icone} />
              {NOMS[retour.nom]}
            </button>
          ) : (
            <span className={`${styles.libelle} ${styles.marque}`}>
              <b>Télécommande</b>
            </span>
          )}
          {invitation ? <span className={styles.voyant} role="img" aria-label="Une invitation attend" data-piece="voyant" /> : null}
          <button type="button" className={`${styles.touche} ${styles.ronde}`} data-piece="touche" aria-label="Fermer la télécommande" onClick={fermer}>
            <IconChevronDown aria-hidden="true" className={styles.icone} />
          </button>
        </header>

        <div className={styles.vue}>
          {vue.nom === 'telecommande' ? (
            <VueTelecommande {...vivante} allerA={allerA} onVuADeux={() => allerA({ nom: 'a-deux' })} />
          ) : (
            <Coquille vue={vue} />
          )}
          <p className={styles.pied} aria-hidden="true" data-piece="pied">
            <span className={styles.piedMarque}>{habillage.marque}</span>
            <span className={styles.piedModele}>{habillage.modele}</span>
          </p>
        </div>
      </section>
    </div>
  )
}

import type { RefObject } from 'react'
import { IconChevronDown, IconChevronLeft } from '@tabler/icons-react'
import type { Habillage } from '../habillages'
import { useTelecommande } from './adresse'
import { NOMS, PARENTES } from './Coquille'
import { useDialogue } from './dialogue'
import { useLeTitreDeLaFiche } from './donnees'
import VueADeux from './VueADeux'
import VueAjouter from './VueAjouter'
import VueFiche from './VueFiche'
import VueListe from './VueListe'
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
  const { vue, precedente, allerA, remplacer, revenir, fermer } = useTelecommande()
  const boite = useDialogue<HTMLElement>(fermer, boutonRond, vue ? ecrireLaVue(vue) : '')
  const vivante = useTelecommandeVivante(vue)
  const titreDeLaFiche = useLeTitreDeLaFiche(vue?.nom === 'fiche' ? vue.serie : null)
  if (!vue) return null
  // Le nom du dialogue suit la vue : « Télécommande », « En cours », « Ajouter une série », « Vu à deux », « Fiche de Dark ».
  const nom = vue.nom === 'fiche' && titreDeLaFiche ? `${NOMS.fiche} de ${titreDeLaFiche}` : NOMS[vue.nom]

  // Réglée sur une série depuis la liste, la télécommande y ramène ; à son ouverture, elle n'a pas de retour.
  const retour = vue.nom === 'telecommande' ? (vue.serie && precedente?.nom === 'en-cours' ? precedente : null) : (precedente ?? PARENTES[vue.nom])

  return (
    <div className={`${styles.dialogue} ${habillage.classe}`} data-chapitre={chapitre}>
      <div className={styles.voile} data-piece="voile" onClick={fermer} />
      <section ref={boite} role="dialog" aria-modal="true" aria-label={nom} tabIndex={-1} className={styles.boitier} data-piece="boitier" data-vue={vue.nom}>
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
            <VueTelecommande {...vivante.telecommande} allerA={allerA} onVuADeux={(serie) => allerA({ nom: 'a-deux', serie: serie.id })} />
          ) : vue.nom === 'en-cours' ? (
            <VueListe {...vivante.liste} allerA={allerA} />
          ) : vue.nom === 'a-deux' ? (
            <VueADeux {...vivante.aDeux} onFait={() => revenir(retour ?? undefined)} />
          ) : vue.nom === 'ajouter' ? (
            // La télécommande réglée sur la série ajoutée prend la place de l'ajout : le retour du téléphone ne ramène pas à la recherche.
            <VueAjouter suivies={vivante.suivies} onAjoutee={(serie) => remplacer({ nom: 'telecommande', serie })} />
          ) : (
            <VueFiche key={vue.serie} serieId={vue.serie} />
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

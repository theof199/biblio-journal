import { useMemo, useRef, type ChangeEvent, type FormEvent, type ReactNode, type RefObject } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { ambianceDeLHeure } from '../../carte/heure'
import type { Monde } from '../../mondes/types'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'
import styles from '../../pages/VoyageRecherche.module.css'

/**
 * Ce que reçoit la tête du guichet, par défaut ou du monde (`GabaritsDesPages.teteDuGuichet`). La
 * page garde la saisie, sa mémoire et le comportement du champ au doigt : elle passe le formulaire
 * et le champ **tout réglés**, que la tête pose tels quels sur son `form` et son `input`, sans rien
 * en retirer. Le lien de retour arrive monté.
 */
export interface PropsTeteDuGuichet {
  monde: Monde
  decennie: number
  /** Moins d'animations : rien ne bouge. */
  calme: boolean
  /** Le lien de retour vers la décennie, monté par la page : la tête le pose où elle veut. */
  retour: ReactNode
  /**
   * Le formulaire de recherche : ce que la page amène au-dessus du clavier au toucher du champ
   * (`ref`), et l'envoi, qui ne fait que replier le clavier.
   */
  guichet: {
    ref: RefObject<HTMLFormElement>
    role: 'search'
    onSubmit: (e: FormEvent<HTMLFormElement>) => void
  }
  /** Le champ : sa valeur, son nom, et les trois gestes que la page écoute. */
  champ: {
    ref: RefObject<HTMLInputElement>
    type: 'search'
    enterKeyHint: 'search'
    autoComplete: 'off'
    placeholder: string
    'aria-label': string
    value: string
    onFocus: () => void
    onBlur: () => void
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
  }
}

/**
 * La tête par défaut : le bandeau du monde sur une toile (le guichetier s'y penche à chaque lettre,
 * sauf au calme), le retour posé dessus, et la fenêtre du guichet sur le bas du bandeau.
 */
export default function Tete({ monde, decennie: d, calme, retour, guichet, champ }: PropsTeteDuGuichet) {
  const { hauteurs } = monde.pages
  // L'instant de la toile, et celui de la dernière lettre tapée (le guichetier se penche).
  const dernierT = useRef(0)
  const frappe = useRef(-9)
  const nuit = useMemo(() => {
    const maintenant = new Date()
    return ambianceDeLHeure(maintenant.getHours() + maintenant.getMinutes() / 60).nuit
  }, [])
  return (
    <>
      <div className={styles.bandeau}>
        <Toile
          hauteur={hauteurs.guichet}
          libelle={`Le guichet des années ${d}.`}
          dessiner={(ctx, t, vivant) => {
            dernierT.current = t
            monde.pages.dessinerGuichet({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.guichet, t, vivant, nuit, frappe: frappe.current })
          }}
        />
        {retour}
      </div>

      <form {...guichet} className={styles.fenetre}>
        <span className={styles.enseigne} aria-hidden="true">
          Guichet
        </span>
        <label>
          <IconSearch aria-hidden="true" />
          <input
            {...champ}
            onChange={(e) => {
              if (!calme) frappe.current = dernierT.current
              champ.onChange(e)
            }}
          />
        </label>
      </form>
    </>
  )
}

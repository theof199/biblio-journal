import { useMemo, useRef } from 'react'
import { ambianceDeLHeure } from '../../carte/heure'
import type { CaseVue, Monde } from '../../mondes/types'
import { useMouvementReduit } from '../../ui/mouvement'
import { figureTouchee, type EtatCheval, type Figure } from '../decennie'
import Toile, { LARGEUR_LOGIQUE } from '../Toile'

/**
 * Ce que reçoit le monument d'une décennie, par défaut ou du monde (`GabaritsDesPages.monument`) :
 * de quoi le dessiner, quelles années ont leur page, et le geste qui en ouvre une. La page garde la
 * navigation, le lien de retour et la plaque du chapitre, posés par-dessus.
 */
export interface PropsMonument {
  monde: Monde
  decennie: number
  /** Les dix années de la décennie et l'état de leur figure (`chevaux`). */
  annees: readonly { annee: number; etat: EtatCheval }[]
  /** Les années de la décennie telles que la carte les voit. */
  cases: readonly Pick<CaseVue, 'annee' | 'etat' | 'profondeur'>[]
  /** La décennie porte son tampon. */
  bouclee: boolean
  /** L'année a sa page : elle seule s'ouvre. */
  ouvrable: (annee: number) => boolean
  /** Ouvrir la page d'une année : la page navigue, jamais le monument. */
  onOuvrir: (annee: number) => void
}

/**
 * Le monument par défaut (maquette 1890, écran IV : le manège) : la toile du monde, où chaque figure
 * inscrit sa place à chaque image. Le premier contact emballe le manège hors d'une année qui s'ouvre
 * et n'ouvre jamais rien (un défilement commence aussi par là) ; le toucher achevé ouvre l'année de
 * la figure, si elle a sa page.
 */
export default function Monument({ monde, decennie: d, annees, cases, bouclee, ouvrable, onOuvrir }: PropsMonument) {
  const { mots: m, hauteurs } = monde.pages
  const calme = useMouvementReduit()
  // Où se tient chaque figure à l'image en cours (vidé à chaque image), l'instant de la toile, et le
  // dernier toucher hors d'une année qui s'ouvre (il s'emballe).
  const figures = useRef<Figure[]>([])
  const dernierT = useRef(0)
  const touche = useRef(-9)
  const nuit = useMemo(() => {
    const maintenant = new Date()
    return ambianceDeLHeure(maintenant.getHours() + maintenant.getMinutes() / 60).nuit
  }, [])
  /** L'année sous le doigt, si elle a sa page ; nulle sinon (aucune figure, ou une année sans page). */
  const anneeOuvrable = (p: { x: number; y: number }) => {
    const annee = figureTouchee(figures.current, p)
    return annee !== null && ouvrable(annee) ? annee : null
  }
  return (
    <Toile
      hauteur={hauteurs.monument}
      libelle={m.decennie.toucher === null ? `${m.decennie.annonce} ${d}.` : `${m.decennie.annonce} ${d} : ${m.decennie.toucher}.`}
      onToucher={(p) => {
        if (!calme && anneeOuvrable(p) === null) touche.current = dernierT.current
      }}
      onChoisir={(p) => {
        const annee = anneeOuvrable(p)
        if (annee !== null) onOuvrir(annee)
      }}
      dessiner={(ctx, t, vivant) => {
        dernierT.current = t
        figures.current = []
        monde.pages.dessinerMonument({
          ctx,
          W: LARGEUR_LOGIQUE,
          H: hauteurs.monument,
          t,
          vivant,
          nuit,
          annees,
          cases,
          bouclee,
          touche: touche.current,
          zone: (annee, x, y, r, devant) => void figures.current.push({ annee, x, y, r, devant }),
        })
      }}
    />
  )
}

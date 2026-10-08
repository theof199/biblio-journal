import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { montrerLeTicket, type FichePrete, type Voyage } from '../../api/voyage'
import type { Ambiance } from '../../carte/son'
import type { Monde } from '../../mondes/types'
import { useMouvementReduit } from '../../ui/mouvement'
import { STYLE_DU_TEMPO } from '../tempo'
import { gabaritSeul } from '../gabarit'
import AnneeBouclee from './AnneeBouclee'
import BadgeColle from './BadgeColle'
import PresseAMedailles from './PresseAMedailles'
import SalleBouclee from './SalleBouclee'
import { arriveesFetees, recompensesDAvant, salleFetee } from './lues'
import { sonDeLaFete } from './son'
import type { Scene } from './scenes'
import styles from './Celebrations.module.css'

/** Ce que le séquenceur passe à chaque scène. */
export interface PropsDeScene<S extends Scene> {
  scene: S
  monde: Monde
  calme: boolean
  /** L'ambiance de la carte, si le membre l'a allumée ; nulle : la scène est muette. */
  son: Ambiance | null
  /** La scène est finie : la suivante, ou la fin. */
  onSuite: () => void
}

/**
 * Le ticket s'est montré (`POST /me/voyage/tickets/{annee}/montre`) : une seule fois par année,
 * quel que soit le nombre de gestes. La carte en cache l'apprend aussitôt (`ticket_a_montrer` nul :
 * elle ne rejouera pas l'année bouclée), puis se relit, elle seule (`exact` : aucune fiche d'année).
 * Un refus ne se dit pas : le ticket reste à montrer, et la carte le rattrapera.
 */
export function useMontrerLeTicket(): (annee: number) => boolean {
  const client = useQueryClient()
  const montres = useRef(new Set<number>())
  return (annee) => {
    if (montres.current.has(annee)) return false
    montres.current.add(annee)
    client.setQueryData<Voyage>(cles.voyage, (v) => (v?.ticket_a_montrer?.annee === annee ? { ...v, ticket_a_montrer: null } : v))
    const relire = () => void client.invalidateQueries({ queryKey: cles.voyage, exact: true })
    montrerLeTicket(annee).then(relire, relire)
    return true
  }
}

interface Props {
  /** Le monde de l'année fêtée : ses jetons habillent les scènes, où qu'elles se jouent. */
  monde: Monde
  membre: string
  /** Les scènes, dans l'ordre ; une scène ajoutée en cours de fête se joue à son tour. */
  scenes: readonly Scene[]
  /** Encaisser le ticket de l'année bouclée ; absent : « L’utiliser » ne s'offre pas. */
  onUtiliser?: (annee: number) => void
  onFin: () => void
  /**
   * Hors de la carte, l'ambiance est tue (`Ambiance.taire`, posé par la carte en la quittant) : la
   * fête la réveille le temps de ses scènes, puis la rend au silence. Sur la carte, elle joue déjà.
   */
  horsCarte?: boolean
  /**
   * La fiche de l'année fêtée, quand la page la tient déjà (la fiche d'année) : de quoi montrer la
   * salle bouclée et les arrivées de l'année. Absente (la carte) : la fête ne lit aucune fiche.
   */
  fiche?: FichePrete | null
}

/**
 * Le séquenceur des célébrations : une scène à la fois, plein écran, dans le costume du monde ; un
 * toucher passe à la suivante, la dernière rend la page. Rien ne se mémorise : démonté, il ne
 * rejoue rien.
 */
export default function Celebrations({ monde, membre, scenes, onUtiliser, onFin, horsCarte = false, fiche = null }: Props) {
  const calme = useMouvementReduit()
  const client = useQueryClient()
  const [rang, setRang] = useState(0)
  const [son] = useState(() => sonDeLaFete(membre))
  const montrer = useMontrerLeTicket()

  useEffect(() => {
    if (!son || !horsCarte) return
    const cache = () => son.taire(document.hidden)
    cache()
    document.addEventListener('visibilitychange', cache)
    return () => {
      document.removeEventListener('visibilitychange', cache)
      son.taire(true)
    }
  }, [son, horsCarte])

  // Une étiquette de la malle ne se fête que dans un monde qui la dessine (une clé sans défaut) : sans
  // dessin, sa scène n'est pas de la fête, et rien ne s'ouvre à vide.
  const avecBadge = gabaritSeul(monde, 'feteDuBadge') !== null
  const jouees = avecBadge ? scenes : scenes.filter((s) => s.type !== 'badge')
  const scene = jouees[rang]
  if (!scene) return null
  // Deux touchers dans le même instant ne sautent pas la scène suivante sans qu'elle ait été vue.
  const suite = () => {
    setRang((r) => (r === rang ? r + 1 : r))
    if (rang + 1 >= jouees.length) onFin()
  }
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof monde.pages.jetons = { ...monde.pages.jetons, ...STYLE_DU_TEMPO }
  const commun = { monde, calme, son, onSuite: suite }

  return (
    <div className={`${styles.calque} ${calme ? styles.calme : ''}`} style={style} data-celebration={scene.type} data-calme={calme}>
      {scene.type === 'salle' ? (
        <SalleBouclee key={rang} scene={scene} {...commun} salle={salleFetee(fiche, scene)} />
      ) : scene.type === 'recompense' ? (
        // La carte se lit dans le cache, sans requête : la page qui fête l'a déjà.
        <PresseAMedailles key={rang} scene={scene} {...commun} passees={recompensesDAvant(client.getQueryData<Voyage>(cles.voyage), scene.annee)} />
      ) : scene.type === 'badge' ? (
        <BadgeColle key={rang} scene={scene} {...commun} />
      ) : (
        <AnneeBouclee key={rang} scene={scene} {...commun} onMontre={montrer} onUtiliser={onUtiliser} arrivees={arriveesFetees(fiche, scene.annee)} />
      )}
    </div>
  )
}

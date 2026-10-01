import type { CSSProperties } from 'react'
import type { Monde } from '../../mondes/types'
import { formatDateVisionnage } from '../../ui/format'
import { useMouvementReduit } from '../../ui/mouvement'
import type { Tampon as TamponDuPasseport } from '../passeport'
import styles from './Tampon.module.css'

interface Props {
  /** Le monde de la décennie (`creerRegistre()(decennie)`) : ses jetons, son mot, le titre du voyageur. */
  monde: Monde
  decennie: number
  /** Le tampon de la décennie au passeport (`tamponDe`), nul tant qu'elle n'est pas bouclée. */
  tampon: TamponDuPasseport | null
  /** Sans tampon, montrer sa place en pointillés (le livret) ; sans elle, rien. */
  place?: boolean
  /**
   * Il vient d'être posé : il frappe en apparaissant (la carte, au passage de la décennie). Faux par
   * défaut : le livret l'ouvre posé depuis des mois, et ne le refrappe pas à chaque visite.
   */
  frappe?: boolean
}

/**
 * Le jour où la décennie a été bouclée, en toutes lettres, **à Paris** : `boucle_le` est tantôt un
 * minuit UTC (le jour d'un visionnage, une date sans heure), tantôt l'instant où le ticket de la
 * décennie suivante a été utilisé (`calculerTampons`, la plus tardive des deux). Un minuit UTC est le
 * même jour à Paris ; un ticket utilisé à 0 h 30 à Paris l'est le jour même, pas la veille comme en
 * UTC. Jamais le fuseau de l'appareil : un téléphone réglé ailleurs reculerait d'un jour. Le jour de
 * Paris (`AAAA-MM-JJ`, que `en-CA` écrit ainsi) se dit ensuite comme un visionnage
 * (`formatDateVisionnage` : « 1er janvier 2000 », que `Intl` écrirait « 1 janvier »). Le format se
 * crée à chaque appel : les tests changent le fuseau de Node, et un format créé au chargement ne le
 * verrait pas (le retrait du fuseau passerait alors inaperçu).
 */
function jourDe(iso: string): string {
  const jour = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso))
  return formatDateVisionnage(jour)
}

/**
 * Le tampon du passeport d'une décennie (plan 2c, tâche 5 ; maquette 1890 : `.tampon` et sa frappe,
 * `.livret .place`). Posé : le mot du passeport, « Années 1890 » au pochoir, « bouclée », le titre du
 * voyageur et le jour ; il frappe quand il vient d'être posé (`frappe`), jamais au calme. Sans tampon,
 * sa place en pointillés, qui ne dit rien de bouclé. Il pose lui-même les jetons de son monde : la
 * carte le montre hors de toute page du Voyage. Sa taille suit la police de son conteneur (16 em de
 * côté), jamais sous 12,25 px (196 px) : plus petit, son jour ne se lirait plus.
 */
export default function Tampon({ monde, decennie, tampon, place = false, frappe = false }: Props) {
  const calme = useMouvementReduit()
  const { jetons, mots } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const titre = monde.titreVoyageur

  if (!tampon) {
    if (!place) return null
    return (
      <div className={styles.place} style={style}>
        {titre ? <span className={styles.titrePlace}>{titre}</span> : null}
        <small>Le tampon se pose ici</small>
      </div>
    )
  }

  return (
    <div className={frappe && !calme ? `${styles.tampon} ${styles.frappe}` : styles.tampon} style={style}>
      <span className={styles.mot}>{mots.decennie.passeport}</span>
      <strong className={styles.millesime}>{`Années ${decennie}`}</strong>
      <span className={styles.mot}>bouclée</span>
      {titre ? <em className={styles.titre}>{titre}</em> : null}
      <time className={styles.jour} dateTime={tampon.boucle_le}>
        {jourDe(tampon.boucle_le)}
      </time>
    </div>
  )
}

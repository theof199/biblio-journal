import type { CSSProperties } from 'react'
import { useMouvementReduit } from '../../../ui/mouvement'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { ENTRE_DEUX_TROUS, noteDuCarton, trousDuCarton } from './carton'
import styles from './Carton.module.css'

/** Ce que le composteur fait du carton : il l'avale, le frappe, le rend, puis le carton part au casier. */
export type GesteDuCarton = 'avale' | 'frappe' | 'rendu' | 'part'

interface Props {
  /** La compagnie, en tête. */
  tete: string
  titre: string
  /** Le titre du carton est celui de la page : son seul `h1`. Ailleurs (une liasse), une ligne. */
  titreDePage?: boolean
  /** La ligne sous le titre. */
  sous?: string | null
  /** Le numéro au pied, tel qu'il se lit (« N° 0413 », « N° ···· ») ; absent, le pied n'en porte pas. */
  numero?: string
  /** Le numéro roule encore : il ne se lit pas au lecteur d'écran. */
  numeroQuiRoule?: boolean
  /** La note percée, un trou par point ; nulle, « sans note ». Absente, le carton n'a ni trous ni note. */
  note?: number | null
  /** La date pressée sur la tranche (`datePressee`) ; elle ne se lit pas : qui la pose la dit ailleurs. */
  presse?: string | null
  /** Le tampon posé : son mot, et ce qu'il dit à qui ne le voit pas. Nul : le carton n'est pas composté. */
  tampon?: { mot: string; dit: string } | null
  /** Le geste du composteur en cours ; nul, le carton est au repos. */
  geste?: GesteDuCarton | null
  /** Ce qui vient de changer sous le doigt : les trous percés à partir de `depuis`, la date. `tour` le rejoue. */
  frais?: { trous?: { depuis: number; tour: number }; presse?: number }
}

/**
 * Le carton Edmondson, le billet des années 1900 (maquette « Voyage immobile 1900 », écrans 6 et 7 :
 * `.edm`) : la compagnie, le titre, la ligne du film, le numéro et la note au pied, la bande rouge, la
 * date pressée sur la tranche, dix places dont la note perce les premières, et le tampon. Un seul
 * composant pour le billet de séance, la liasse du casier et le « Bon pour » d'une année bouclée :
 * tout ce qu'il montre lui est passé, il ne lit rien.
 *
 * Il ne porte jamais la mention de classe (décision 6) ni le poinçon doré du contrôleur (son lot).
 * Rien n'y bouge au calme : `data-vivante` porte seul les animations de la feuille.
 */
export default function Carton({ tete, titre, titreDePage = false, sous, numero, numeroQuiRoule = false, note, presse, tampon, geste, frais }: Props) {
  const calme = useMouvementReduit()
  const Titre = titreDePage ? 'h1' : 'div'
  const perces = frais?.trous
  return (
    <div className={styles.carton} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'} data-geste={geste ?? undefined}>
      <div className={styles.l1}>{tete}</div>
      <Titre className={styles.l2}>{titre}</Titre>
      {sous ? <div className={styles.l3}>{sous}</div> : null}
      <div className={styles.l4}>
        <span aria-hidden={numeroQuiRoule || undefined}>{numero}</span>
        {note !== undefined ? <span>{noteDuCarton(note)}</span> : null}
      </div>
      {presse ? (
        <span key={frais?.presse ?? 0} className={styles.presse} data-fraiche={frais?.presse ? 'oui' : undefined} aria-hidden="true">
          {presse}
        </span>
      ) : null}
      {note !== undefined ? (
        <div className={styles.trous} aria-hidden="true">
          {trousDuCarton(note).map((perce, i) => {
            // Un trou que la pince vient de percer s'ouvre et lâche sa confetti, l'un après l'autre.
            const neuf = perce && perces !== undefined && i >= perces.depuis
            const retard: CSSProperties | undefined = neuf ? { animationDelay: `${(i - perces.depuis) * ENTRE_DEUX_TROUS}ms` } : undefined
            return (
              <i key={neuf ? `${i}-${perces.tour}` : i} className={styles.trou} data-perce={perce} data-neuf={neuf ? 'oui' : undefined} style={retard}>
                {neuf && !calme ? <b className={styles.chute} style={retard} /> : null}
              </i>
            )
          })}
        </div>
      ) : null}
      {tampon ? (
        <span className={styles.vu} role="img" aria-label={tampon.dit}>
          {tampon.mot}
        </span>
      ) : null}
    </div>
  )
}

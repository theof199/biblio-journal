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
  /**
   * Le poinçon doré du contrôleur : ce qu'il dit à qui ne le voit pas ; `frais`, il vient d'être percé
   * (il luit, et se perce sous la racine vivante). Absent ou nul, aucun poinçon : le carton ne le
   * porte que si on le lui passe, et le composteur ne le passe jamais.
   */
  poincon?: { dit: string; frais?: boolean } | null
  /**
   * Le tampon vert « Vu ensemble » du wagon-restaurant : son mot, et ce qu'il dit à qui ne le voit pas.
   * Absent ou nul, aucun tampon vert : comme le poinçon, le carton ne le porte que si on le lui passe,
   * et le composteur ne le passe jamais. Les deux marques se portent ensemble, l'une n'efface pas l'autre.
   */
  ensemble?: { mot: string; dit: string } | null
  /**
   * La taille des lignes. Absente, celles de la maquette, mesurées au carton : c'est le carton de tous
   * ses sites. `grande` : les quatre lignes grossies, pour un carton posé seul sur la largeur de la page
   * et qui ne porte ni places ni date (le « Bon pour » au pied d'une gare, qui la demande seul).
   */
  taille?: 'grande'
}

/**
 * Le carton Edmondson, le billet des années 1900 (maquette « Voyage immobile 1900 », écrans 6 et 7 :
 * `.edm`) : la compagnie, le titre, la ligne du film, le numéro et la note au pied, la bande rouge, la
 * date pressée sur la tranche, dix places dont la note perce les premières, et le tampon. Un seul
 * composant pour le billet de séance, la liasse du casier et le « Bon pour » d'une année bouclée :
 * tout ce qu'il montre lui est passé, il ne lit rien.
 *
 * Il ne porte jamais la mention de classe (décision 6). Le poinçon doré du contrôleur (maquette :
 * `.poincon-or`, un cercle perlé et une étoile percée, dont les couleurs sont la donnée) n'y est que
 * si on le lui passe : le casier et le billet sorti pour un billet présenté, la portière du contrôleur
 * au moment du coup, jamais le composteur. Le tampon vert « Vu ensemble » (maquette, écran 20 :
 * `.ensemble-t`, à l'encre du jeton `--m-vert`) non plus : le casier, le billet sorti et la table du
 * wagon-restaurant le passent pour le billet d'une table vue à deux. Un billet peut porter les deux.
 * **Aucune des deux ne couvre une ligne du carton** (`Carton.module.css`) : le poinçon se perce sur la
 * bande rouge, hors de la colonne du texte ; le tampon vert a sa ligne à lui, entre celle du film et
 * le pied, et les autres lignes se serrent pour la lui laisser.
 * Rien n'y bouge au calme : `data-vivante` porte seul les animations de la feuille.
 */
export default function Carton({ tete, titre, titreDePage = false, sous, numero, numeroQuiRoule = false, note, presse, tampon, geste, frais, poincon, ensemble, taille }: Props) {
  const calme = useMouvementReduit()
  const Titre = titreDePage ? 'h1' : 'div'
  const perces = frais?.trous
  return (
    <div className={styles.carton} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'} data-geste={geste ?? undefined} data-taille={taille}>
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
      {ensemble ? (
        <span className={styles.ensemble} role="img" aria-label={ensemble.dit} data-perce={poincon ? 'oui' : undefined}>
          {ensemble.mot}
        </span>
      ) : null}
      {poincon ? (
        <span className={styles.poincon} role="img" aria-label={poincon.dit} data-frais={poincon.frais ? 'oui' : undefined}>
          <svg viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
            <circle r="8.6" fill="none" stroke="#e2b23c" strokeWidth="1.5" />
            <circle r="6.6" fill="none" stroke="#f0d27a" strokeWidth=".6" strokeDasharray="1 1.2" />
            <path d="M0 -5.4 l1.5 3.4 3.7 .4 -2.8 2.5 .8 3.7 -3.2 -1.9 -3.2 1.9 .8 -3.7 -2.8 -2.5 3.7 -.4 Z" fill="#0e0a07" stroke="#e2b23c" strokeWidth=".9" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </div>
  )
}

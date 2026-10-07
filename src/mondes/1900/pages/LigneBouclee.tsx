import { useMouvementReduit } from '../../../ui/mouvement'
import { NOM_DE_RECOMPENSE } from '../../../voyage/annee/Embleme'
import type { PropsFeteDeLAnnee } from '../../../voyage/celebrations/DessinDeLAnnee'
import { PAS_DE_L_ANNEE } from '../../../voyage/celebrations/deroule'
import { motifDeRecompense } from '../../../voyage/celebrations/scenes'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import Carton from './Carton'
import { MOTS_DES_FETES, trajetDuBon } from './fetes'
import { rangDeLaGare } from './gare'
import { ligneDeLIndicateur, lignesDeLAnnee } from './lignes'
import styles from './Fetes.module.css'

/** Les confettis du poinçon : un décor, qui ne tombe que d'une salve jouée, jamais au calme. */
const CHADS = [0, 1, 2, 3, 4, 5, 6, 7] as const

/**
 * La ligne bouclée, à la place du fronton et de sa médaille (maquette, écran 13 : `.s-annee`) : la
 * plaque de la gare, les lignes de l'indicateur (celles du brief 2, `lignesDeLAnnee` et
 * `ligneDeLIndicateur`, sur les arrivées que la scène a calculées : rien n'est recompté ici) qui se
 * pointent une à une, le tampon rouge au pas de la médaille, puis le guichet tend le carton
 * Edmondson du « Bon pour ». Les deux boutons du choix restent ceux de la scène. Sans la fiche de
 * l'année (le rattrapage de la carte), pas d'indicateur : la plaque, le tampon et le carton.
 *
 * Une ligne ne se pointe que si elle est arrivée : une Palme encore attendue le reste. Au calme,
 * tout est posé, sans confettis.
 */
export default function LigneBouclee({ scene, monde, pas, salve, arrivees }: PropsFeteDeLAnnee) {
  const calme = useMouvementReduit()
  const m = monde.pages.mots
  const lignes = arrivees ? lignesDeLAnnee([...arrivees], true) : null
  const recompense = scene.recompense
  return (
    <div className={`${styles.fete} ${styles.annee}`} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      {salve > 0 && !calme ? (
        <div className={styles.chads} aria-hidden="true" data-chads="oui">
          {CHADS.map((i) => (
            <i key={i} />
          ))}
        </div>
      ) : null}
      <p className={styles.plaque}>
        <small>{rangDeLaGare(scene.annee)}</small>
        <b>{scene.annee}</b>
      </p>
      <div className={styles.papier}>
        {lignes ? (
          <ol aria-label={`${MOTS_DES_FETES.arrivees} ${scene.annee}`}>
            {lignes.map((a, i) => {
              const ligne = ligneDeLIndicateur(a, scene.annee, false)
              return (
                <li key={a.cle} data-pointee={a.arrivee && pas > i ? 'oui' : 'non'}>
                  <b>{ligne.nom}</b>
                  <span>{ligne.libelle}</span>
                  <i>{ligne.etat}</i>
                </li>
              )
            })}
          </ol>
        ) : null}
        {pas >= PAS_DE_L_ANNEE.medaille ? <p className={styles.tampon}>{m.annonce.bouclee}</p> : null}
      </div>
      {pas >= PAS_DE_L_ANNEE.titre ? (
        <>
          <p className={styles.titre}>{MOTS_DES_FETES.bouclee}</p>
          {recompense ? <p className={styles.sous}>{`${NOM_DE_RECOMPENSE[recompense]} · ${motifDeRecompense(recompense, scene.annee)}`}</p> : null}
        </>
      ) : null}
      {pas >= PAS_DE_L_ANNEE.guichet ? (
        <div className={styles.guichet}>
          <i className={styles.grille} aria-hidden="true" />
          <div className={styles.tablette}>
            <Carton tete={MOTS_DES_FETES.compagnie} titre={`${MOTS_DES_FETES.bon} ${scene.ticket}`} sous={trajetDuBon(scene.annee, scene.ticket)} numero={MOTS_DES_FETES.entree} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

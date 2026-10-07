import { useMouvementReduit } from '../../../ui/mouvement'
import { formatDateVisionnage } from '../../../ui/format'
import { numeroLisible } from '../../../voyage/billets'
import type { PropsCasier } from '../../../voyage/boite/Casier'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import Carton from './Carton'
import { MOTS_DU_COMPOSTEUR, datePressee, ligneDuFilm } from './carton'
import { CARTONS_ECHELONNES, ENTRE_DEUX_CARTONS, MOTS_DU_CASIER as M, compteDeLaCase, compteDeLaLiasse, liasseDe, pilesDeLaCase, titreDeLaLiasse } from './casier'
import Rubrique from './Rubrique'
import styles from './Casier.module.css'

/**
 * Le casier du contrôleur, la boîte à billets des années 1900 (maquette, écran 8 : `.casier`, `.case`,
 * `.liasse`) : une case par année que la page lui passe (jamais une année d'avant le départ du
 * Voyage), « Tous », et la liasse de la case choisie, du plus ancien billet au plus récent, chaque
 * billet sur son carton Edmondson. Toucher un carton l'ouvre en grand.
 *
 * Il ne lit rien et ne numérote rien : la case choisie et le billet ouvert vivent dans l'adresse, que
 * la page tient ; le numéro est celui du billet de séance. Rien n'y bouge au calme.
 */
export default function CasierDuControleur({ monde, intercalaires, choisi, onChoisir, billets, nouveau, onOuvrir }: PropsCasier) {
  const m = monde.pages.mots
  const calme = useMouvementReduit()
  const liasse = liasseDe(billets)
  const total = intercalaires.reduce((n, i) => n + i.compte, 0)
  return (
    <div className={styles.racine} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.casier}>
        <div className={styles.rayon} role="group" aria-label={M.cases}>
          {intercalaires.map((i) => (
            <button key={i.annee} type="button" className={styles.case} aria-pressed={choisi === i.annee} aria-label={`${i.annee}, ${compteDeLaCase(i.compte)}`} onClick={() => onChoisir(i.annee)}>
              <span className={styles.fente} aria-hidden="true">
                {Array.from({ length: pilesDeLaCase(i.compte) }, (_, k) => (
                  <i key={k} style={{ bottom: 4 + k * 6 }} />
                ))}
              </span>
              <span className={styles.annee}>{i.annee}</span>
              <small>{compteDeLaCase(i.compte)}</small>
            </button>
          ))}
          <button type="button" className={styles.tous} aria-pressed={choisi === null} aria-label={`${m.boite.tous}, ${compteDeLaLiasse(total)}`} onClick={() => onChoisir(null)}>
            {m.boite.tous}
            <small>{compteDeLaLiasse(total)}</small>
          </button>
        </div>
        <p className={styles.pied}>{M.pied}</p>
      </div>

      <Rubrique>
        {titreDeLaLiasse(choisi)} <small>{compteDeLaLiasse(liasse.length)}</small>
      </Rubrique>
      {liasse.length === 0 ? (
        <p className={styles.vide}>{choisi === null ? M.aucun : m.boite.vide}</p>
      ) : (
        // La clé rejoue la sortie de la liasse quand la case change, jamais quand un billet s'ouvre.
        <ol key={choisi ?? 'tous'} className={styles.liasse} aria-label={titreDeLaLiasse(choisi)}>
          {liasse.map((b, i) => {
            const { entry, media } = b.item
            const neuf = entry.id === nouveau
            return (
              <li key={entry.id} style={calme ? undefined : { animationDelay: `${Math.min(i, CARTONS_ECHELONNES) * ENTRE_DEUX_CARTONS}ms` }}>
                <button type="button" className={styles.billet} data-neuf={neuf ? 'oui' : undefined} onClick={() => onOuvrir(entry.id)}>
                  <Carton
                    tete={MOTS_DU_COMPOSTEUR.compagnie}
                    titre={media.title}
                    sous={ligneDuFilm(media.director, media.year!)}
                    numero={numeroLisible(b.numero)}
                    note={entry.rating}
                    presse={datePressee(entry.finished_at)}
                    tampon={{ mot: m.billet.tampon, dit: `${m.billet.tampon} : ${m.billet.tamponAutour} ${formatDateVisionnage(entry.finished_at)}` }}
                  />
                  {neuf ? <span className={styles.lecteur}>{`, ${M.range}`}</span> : null}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

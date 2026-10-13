import Attente, { Barre } from '../../ui/Attente'
import Affiche from '../../ui/Affiche'
import type { Vue } from './vues'
import styles from './Panneau.module.css'

/** Le titre de chaque vue, tel que le bandeau et un retour le disent. */
export const NOMS: Record<Vue['nom'], string> = {
  telecommande: 'Télécommande',
  'en-cours': 'En cours',
  ajouter: 'Ajouter une série',
  'a-deux': 'Vu à deux',
  fiche: 'Fiche',
}

/** La vue où ramène le retour d'une vue ouverte par son adresse : la fiche vient de la liste, le reste de la télécommande. */
export const PARENTES: Record<Exclude<Vue['nom'], 'telecommande'>, Vue> = {
  'en-cours': { nom: 'telecommande' },
  ajouter: { nom: 'telecommande' },
  'a-deux': { nom: 'telecommande' },
  fiche: { nom: 'en-cours' },
}

const CARTES = 3

/**
 * Une vue du panneau qui n'a pas encore son contenu (la liste « En cours », l'ajout, le « vu à deux »,
 * la fiche) : son titre, et des cartes laissées en blanc, à la forme des vraies. Le même boîtier.
 */
export default function Coquille({ vue }: { vue: Exclude<Vue, { nom: 'telecommande' }> }) {
  return (
    <>
      <h2 className={styles.titreVue}>{NOMS[vue.nom]}</h2>
      <Attente libelle={`${NOMS[vue.nom]} : à venir…`} className={styles.pile}>
        {Array.from({ length: CARTES }, (_, carte) => (
          <div key={carte} className={styles.ecran} data-piece="ecran" data-etat="attente">
            <div className={styles.sujet}>
              <Affiche src={null} titre="" taille="ligne" />
              <div className={styles.infos}>
                <Barre largeur="longue" />
                <Barre largeur="moyenne" />
              </div>
            </div>
          </div>
        ))}
      </Attente>
    </>
  )
}

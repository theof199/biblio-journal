import styles from './Anneau.module.css'

/** La circonférence de l'anneau (maquette : `2π × 29`, dans un repère de 70). */
const CIRCONFERENCE = 2 * Math.PI * 29

/**
 * L'anneau du passeport (maquette 1890 : `.livret`, écran IV) : les années d'une décennie qui portent
 * leur récompense, sur toutes (`anneauDuPasseport`), à l'or du monde posé autour de lui. Le livret
 * de la décennie et la sacoche du voyageur le montrent ; il ne dit rien aux lecteurs d'écran, le
 * texte d'à côté le dit (« 3 années sur 5 »).
 */
export default function Anneau({ faites, total }: { faites: number; total: number }) {
  const part = total > 0 ? faites / total : 0
  return (
    <svg className={styles.anneau} viewBox="0 0 70 70" aria-hidden="true">
      <circle className={styles.piste} cx="35" cy="35" r="29" />
      <circle
        className={styles.plein}
        cx="35"
        cy="35"
        r="29"
        strokeDasharray={CIRCONFERENCE.toFixed(1)}
        strokeDashoffset={(CIRCONFERENCE * (1 - part)).toFixed(1)}
        transform="rotate(-90 35 35)"
      />
    </svg>
  )
}

/** « 3 années sur 5 », « 1 année sur 10 » : ce que l'anneau dessine, en mots. */
export const anneesSur = ({ faites, total }: { faites: number; total: number }) => `${faites} ${faites > 1 ? 'années' : 'année'} sur ${total}`

import type { PropsBoniment } from '../../../voyage/annee/Boniment'
import { paragraphes } from '../../../voyage/feuille'
import styles from './Guide.module.css'

/**
 * Le guide du voyageur, à la place du boniment (maquette, écran 2 : `.guide`) : le premier paragraphe
 * de l'ouverture, les deux gestes du boniment (lire l'ouverture ; le générique, quand le ticket de
 * l'année est connu), puis les faits de l'année. La récompense, elle, est sur le tampon de l'indicateur.
 */
export default function Guide({ monde, annee, ouverture, faits, generique, onLire, onGenerique }: PropsBoniment) {
  const m = monde.pages.mots
  const premier = paragraphes(ouverture)[0] ?? ''
  return (
    <section aria-label={m.boniment}>
      <h2 className={styles.sec}>
        {m.boniment}
        <small>{annee}</small>
      </h2>
      <div className={styles.guide}>
        {premier ? <p>{premier}</p> : null}
        <div className={styles.liens}>
          <button type="button" onClick={onLire}>
            {m.lireOuverture}
          </button>
          {generique ? (
            <button type="button" onClick={onGenerique}>
              Le générique de fin
            </button>
          ) : null}
        </div>
        {faits.length > 0 ? (
          <>
            <h3>{m.echos}</h3>
            <ul>
              {faits.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  )
}

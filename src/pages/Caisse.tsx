import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../session/SessionContext'
import BoutonRetour from '../ui/BoutonRetour'
import { formatDateCourte, jourLocal } from '../ui/format'
import { appliquerTheme, ecrireTheme, lireTheme } from '../ui/theme'
import type { ChoixTheme } from '../ui/theme'
import Doublons from '../profil/Doublons'
import Rattrapage from '../profil/Rattrapage'
import recu from '../profil/Recu.module.css'
import SensCritique from '../profil/SensCritique'
import { Version } from '../profil/Version'
import styles from './Caisse.module.css'

const CHOIX: readonly { valeur: ChoixTheme; libelle: string }[] = [
  { valeur: 'auto', libelle: 'Auto' },
  { valeur: 'clair', libelle: 'Jour' },
  { valeur: 'sombre', libelle: 'Nuit' },
]

/** Une ligne de caisse : « libellé ······ → ». */
function Ligne({ children }: { children: string }) {
  return (
    <>
      <span className={recu.libelle}>{children}</span>
      <span className={recu.pointilles} aria-hidden="true" />
      <span className={recu.valeur} aria-hidden="true">
        →
      </span>
    </>
  )
}

/**
 * La caisse (`profil/reglages`) : un ticket de caisse thermique déroulé sur le ciel, où le membre
 * règle son Journal. Le thème, « Mes films », l'import Letterboxd, la liaison SensCritique, le rattrapage,
 * les doublons, la déconnexion, la mention TMDB et la version en pied de ticket. Le papier est crème de jour comme de nuit.
 */
export default function Caisse() {
  const { user, deconnecter } = useSession()
  const naviguer = useNavigate()
  const themeId = useId()
  const [theme, setTheme] = useState<ChoixTheme>(lireTheme)

  const choisirTheme = (choix: ChoixTheme) => {
    ecrireTheme(choix)
    appliquerTheme(choix)
    setTheme(choix)
  }

  return (
    <div className={styles.fond}>
      <div className={styles.page} style={{ '--identite': user.identity_color } as CSSProperties}>
        <BoutonRetour vers="/profil" />

        <article className={styles.ticket}>
          <div className={styles.papier} aria-hidden="true" />
          <div className={styles.corps}>
            <header className={styles.entete}>
              <p className={styles.journal}>Journal</p>
              <h1 className={styles.titre}>La caisse</h1>
              <p className={styles.date}>{formatDateCourte(jourLocal())}</p>
            </header>
            <p className={styles.etoiles} aria-hidden="true">
              * * * * * * * * * * * * * *
            </p>

            <section>
              <h2 id={themeId} className={recu.entete}>
                Thème
              </h2>
              <div role="radiogroup" aria-labelledby={themeId} className={styles.choix}>
                {CHOIX.map(({ valeur, libelle }) => (
                  <label key={valeur} className={styles.option}>
                    <input
                      type="radio"
                      name="theme"
                      value={valeur}
                      className="sr-only"
                      checked={theme === valeur}
                      onChange={() => choisirTheme(valeur)}
                    />
                    <span className={styles.mot}>{libelle}</span>
                    {/* Le cercle au crayon gras, tracé à la main ; il ne se montre que sur le choix coché. */}
                    <svg className={styles.cercle} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                      <path
                        d="M14 27 C 4 14, 30 3, 52 4 C 80 4, 98 15, 90 27 C 80 38, 38 38, 14 32 C 4 28, 6 18, 22 11"
                        fill="none"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </label>
                ))}
              </div>
            </section>
            <hr className={styles.tiret} />

            <section>
              <h2 className={recu.entete}>Mes films</h2>
              <Link to="/profil/mes-films" className={recu.ligne}>
                <Ligne>Voir tous mes films</Ligne>
              </Link>
            </section>

            <section>
              <h2 className={recu.entete}>Importer</h2>
              {/* Le fichier se choisit ici, se lit et s'envoie sur la page suivante, qui montre l'attente puis le rapport. */}
              <label className={recu.ligne}>
                <Ligne>Importer Letterboxd</Ligne>
                {/* Le ZIP entier : les films vus sans entrée de journal ne sont que dans son watched.csv. */}
                <input
                  type="file"
                  className="sr-only"
                  accept=".zip,.csv,application/zip,text/csv"
                  aria-label="Fichier d’export Letterboxd"
                  onChange={(event) => {
                    const fichier = event.target.files?.[0]
                    event.target.value = ''
                    if (fichier) naviguer('/profil/import-letterboxd', { state: { fichier } })
                  }}
                />
              </label>
              <p className={recu.aide}>Le ZIP d’export de Letterboxd (ou son diary.csv seul)</p>
            </section>

            <section>
              <SensCritique />
            </section>

            <section>
              <Rattrapage />
            </section>

            <section>
              <h2 className={recu.entete}>Doublons</h2>
              <Doublons />
            </section>

            <div className={styles.coupe} aria-hidden="true">
              <span className={styles.ciseaux}>✂</span>
            </div>

            <button type="button" className={`${recu.ligne} ${recu.fort}`} onClick={() => void deconnecter()}>
              <Ligne>Se déconnecter</Ligne>
            </button>

            <p className={`${styles.etoiles} ${styles.etoilesBas}`} aria-hidden="true">
              * * * * * * * * * * * * * *
            </p>

            {/* Une condition d'utilisation de l'API de TMDB (§3 « Attribution »), pas une politesse : la phrase est la leur, en anglais, non traduite. */}
            <div className={styles.mentionTmdb}>
              <img src={`${import.meta.env.BASE_URL}tmdb.svg`} alt="TMDB" className={styles.logoTmdb} />
              <p>This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
            </div>
            <Version />
            <p className={styles.merci}>Merci, à bientôt</p>
          </div>
        </article>
      </div>
    </div>
  )
}

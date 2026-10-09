import { useId } from 'react'
import type { CartePostaleEnvoyee, CartePostaleRecue } from '../../../api/voyage'
import Panne from '../../../ui/Panne'
import { useDialogue } from '../../../voyage/dialogue'
import type { CarteOuverte, PropsCourrierDeLaSacoche } from '../../../voyage/sacoche/Courrier'
import { MOTS_DU_COURRIER as M, adresseDe, ceQueDitLaCarte, enteteDeLEnvoyee, enteteDeLaRecue, gareDe, rectoDe, tamponADate } from './courrier'
import Rubrique from './Rubrique'
import styles from './Courrier.module.css'
import sacoche from './Sacoche.module.css'

/** Le timbre des Chemins de fer du Voyage (maquette, l. 2327) : dentelé, rouge, une roue de wagon. */
function Timbre() {
  return (
    <svg className={styles.timbre} viewBox="0 0 42 52" role="img" aria-label={M.ouverte.timbre}>
      <rect width="42" height="52" fill="var(--m-papier)" />
      <path d="M0 0 H42 V52 H0 Z" fill="none" stroke="var(--m-papier2)" strokeWidth="4" strokeDasharray="2.6 2.6" />
      <rect x="4" y="4" width="34" height="44" fill="var(--m-rouge)" />
      <rect x="6.5" y="6.5" width="29" height="39" fill="none" stroke="var(--m-papier)" strokeWidth=".8" />
      <circle cx="21" cy="23" r="8" fill="none" stroke="var(--m-papier)" strokeWidth="1.6" />
      <circle cx="21" cy="23" r="2" fill="var(--m-papier)" />
      <path d="M21 15 V31 M13 23 H29 M15.4 17.4 L26.6 28.6 M15.4 28.6 L26.6 17.4" stroke="var(--m-papier)" strokeWidth=".8" />
    </svg>
  )
}

/** Le tampon à date (maquette, l. 2328) : deux cercles, la gare sur l'arc, le jour de l'envoi au cœur, les flammes à droite. */
function Cachet({ carte }: { carte: CartePostaleRecue | CartePostaleEnvoyee }) {
  const arc = useId()
  const tampon = tamponADate(carte)
  return (
    <svg className={styles.cachet} viewBox="-32 -32 96 64" role="img" aria-label={tampon.libelle}>
      <g fill="none" stroke="var(--m-encre)">
        <circle r="29" strokeWidth="2.4" />
        <circle r="19" strokeWidth="1.2" />
        <path d="M30 -10 C40 -14 46 -6 56 -10 M30 0 C40 -4 46 4 56 0 M30 10 C40 6 46 14 56 10" strokeWidth="1.8" />
      </g>
      <path id={arc} d="M-23.5 0 A23.5 23.5 0 0 1 23.5 0" fill="none" />
      <text className={styles.arc} textAnchor="middle" fill="var(--m-encre)">
        <textPath href={`#${arc}`} startOffset="50%">
          {tampon.gare}
        </textPath>
      </text>
      <g className={styles.date} fill="var(--m-encre)" textAnchor="middle">
        <text y="-1">{tampon.jour}</text>
        <text y="9">{tampon.annee}</text>
      </g>
    </svg>
  )
}

/**
 * Une carte ouverte (maquette, écran 19) : le recto de sa gare s'il a une photographie, puis son dos
 * divisé d'époque — « Correspondance » et le mot, signé ; « Adresse », le timbre, le tampon à date et
 * l'adresse servie. Un dialogue par-dessus la sacoche : « Refermer la carte » prend le focus et le
 * rend, Échap ferme. **Le mot est un texte d'un autre membre** : rendu en texte, jamais en HTML ; ni
 * le nom du dialogue ni aucun attribut ne le portent. Rien n'y bouge.
 */
function Ouverte({ ouverte, onFermer }: { ouverte: CarteOuverte; onFermer: () => void }) {
  const refermer = useDialogue<HTMLButtonElement>(onFermer)
  const { carte } = ouverte
  const recto = rectoDe(carte.annee)
  return (
    <div className={styles.calque} role="dialog" aria-modal="true" aria-label={M.ouverte.titre}>
      <button ref={refermer} type="button" className={styles.retour} aria-label={M.ouverte.refermer} onClick={onFermer}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className={styles.defil}>
        <div className={styles.cadre}>
          <Rubrique balise="p">
            {M.ouverte.titre} <small>{gareDe(carte.annee)}</small>
          </Rubrique>
          {recto ? (
            <figure className={styles.recto}>
              <img src={recto.image} alt={recto.libelle} decoding="async" />
              <figcaption>{recto.legende}</figcaption>
            </figure>
          ) : null}
          <div className={styles.verso}>
            <p className={styles.ent} aria-hidden="true">
              {M.ouverte.titre}
            </p>
            <div className={styles.mot}>
              <small>{M.ouverte.correspondance}</small>
              <p>{carte.mot}</p>
              <p className={styles.signe}>{carte.expediteur.pseudo}</p>
            </div>
            <div className={styles.adr}>
              <small>{M.ouverte.adresse}</small>
              <Timbre />
              <Cachet carte={carte} />
              <p>
                {adresseDe(carte).map((ligne) => (
                  <span key={ligne}>{ligne}</span>
                ))}
              </p>
            </div>
          </div>
          <p className={styles.etat}>{ceQueDitLaCarte(ouverte)}</p>
        </div>
      </div>
    </div>
  )
}

/** Un pli de la rubrique (maquette : `.pli`) : la vignette de sa gare ou un dos de carte, son en-tête, le mot, « Nouvelle ». */
function Pli({ entete, carte, nouvelle, ouvrir }: { entete: string; carte: CartePostaleRecue | CartePostaleEnvoyee; nouvelle: boolean; ouvrir: (id: string) => void }) {
  const recto = rectoDe(carte.annee)
  return (
    <li>
      <button type="button" className={styles.pli} aria-haspopup="dialog" onClick={() => ouvrir(carte.id)}>
        {recto ? <img src={recto.image} alt="" loading="lazy" decoding="async" /> : <span className={styles.dos} aria-hidden="true" />}
        <span className={styles.texte}>
          <b>{entete}</b>
          <q>{carte.mot}</q>
        </span>
        {nouvelle ? <em>{M.nouvelle}</em> : null}
      </button>
    </li>
  )
}

/**
 * Le courrier dans la sacoche des années 1900 (maquette, écran 15 : `.courrier` ; écran 19 : la carte
 * ouverte) : sa rubrique, puis mes cartes reçues dans l'ordre servi (« De Léa · gare de 1902 », le
 * mot, « Nouvelle » tant que `lue_le` est nul), puis les envoyées (« À Léa · gare de 1902 », l'adresse
 * servie), **sans rien dire de leur lecture**. Une boîte vide le dit. Le dessin ne lit ni n'écrit
 * rien : `voyage/sacoche/Courrier.tsx` lui passe la boîte, la carte que l'adresse ouvre et le calque.
 * On n'écrit pas de carte ici. Rien n'y bouge.
 */
export default function CourrierDeLaSacoche({ panne, recues, envoyees, ouverte, ouvrir, fermer }: PropsCourrierDeLaSacoche) {
  const vide = recues !== null && envoyees !== null && recues.length + envoyees.length === 0
  return (
    <>
      <Rubrique>
        {M.titre} <small>{M.sous}</small>
      </Rubrique>
      {panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : vide ? (
        <p className={sacoche.vide}>{M.vide}</p>
      ) : (
        <>
          {recues && recues.length > 0 ? (
            <>
              <p className={styles.sens}>{M.recues}</p>
              <ul className={styles.courrier} aria-label={M.recues}>
                {recues.map((carte) => (
                  <Pli key={carte.id} entete={enteteDeLaRecue(carte)} carte={carte} nouvelle={carte.lue_le === null} ouvrir={ouvrir} />
                ))}
              </ul>
            </>
          ) : null}
          {envoyees && envoyees.length > 0 ? (
            <>
              <p className={styles.sens}>{M.envoyees}</p>
              <ul className={styles.courrier} aria-label={M.envoyees}>
                {envoyees.map((carte) => (
                  <Pli key={carte.id} entete={enteteDeLEnvoyee(carte)} carte={carte} nouvelle={false} ouvrir={ouvrir} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
      {ouverte ? <Ouverte ouverte={ouverte} onFermer={fermer} /> : null}
    </>
  )
}

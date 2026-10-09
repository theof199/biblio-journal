import { useId, type ReactNode } from 'react'
import type { CartePostaleEnvoyee, CartePostaleRecue } from '../../../api/voyage'
import { useMouvementReduit } from '../../../ui/mouvement'
import { useDialogue } from '../../../voyage/dialogue'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import { MOTS_DU_COURRIER as M, gareDe, rectoDe, tamponADate } from './courrier'
import Rubrique from './Rubrique'
import styles from './Courrier.module.css'

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

/**
 * Le tampon à date (maquette, l. 2328) : deux cercles, la gare sur l'arc, le jour de l'envoi au cœur,
 * les flammes à droite. `frais`, il tombe sur la carte (`data-frais`, que la feuille n'anime que sous
 * `data-vivante='oui'`) ; sinon il y est déjà.
 */
function Cachet({ carte, frais }: { carte: CartePostaleRecue | CartePostaleEnvoyee; frais: boolean }) {
  const arc = useId()
  const tampon = tamponADate(carte)
  return (
    <svg className={styles.cachet} viewBox="-32 -32 96 64" role="img" aria-label={tampon.libelle} data-frais={frais ? 'oui' : undefined}>
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

interface Props {
  /** Le nom du dialogue et du dos de la carte : « Carte postale », « Carte à écrire ». Jamais un mot de carte. */
  titre: string
  /** La gare d'où la carte part : son recto, si 1900 en a la photographie (décision 8). */
  annee: number
  /** Le mot, à gauche du dos divisé : un texte, toujours. */
  mot: string
  /** Qui signe. */
  signe: string
  /** La carte servie, dont on frappe le tampon à date ; nulle tant qu'elle n'est pas postée : **un dos sans tampon**. */
  postee: CartePostaleRecue | CartePostaleEnvoyee | null
  /** La carte vient d'être postée (le `201`, que la page seule connaît) : son tampon à date se frappe, une fois. Jamais pour une carte qu'on rouvre, envoyée ou reçue. */
  frappe?: boolean
  /** Les lignes de l'adresse, dans l'ordre. */
  adresse: readonly string[]
  onFermer: () => void
  /** Sous la carte : ce qu'elle dit d'elle, ou de quoi l'écrire. */
  children: ReactNode
}

/**
 * Une carte postale de 1900, **un seul dessin pour la lire et pour l'écrire** (maquette, écran 19) : le
 * recto de sa gare s'il a une photographie, puis son dos divisé d'époque — « Correspondance », le mot,
 * signé ; « Adresse », le timbre, le tampon à date **une fois postée seulement**, et l'adresse. Un
 * dialogue par-dessus la sacoche : « Refermer la carte » prend le focus et le rend, défile avec la
 * carte (jamais sur la photographie), Échap ferme. **Le
 * mot est un texte** (celui d'un autre membre, ou mon brouillon) : rendu en texte, jamais en HTML ; ni
 * le nom du dialogue ni aucun attribut ne le portent. **Un seul mouvement** : le tampon à date qui
 * tombe sur la carte qu'on vient de poster (maquette, `.cp.postee .cachet.frappe`, l. 1292 : la frappe
 * du composteur, `tampon-frappe` et `tampon-encre`, l. 496-498), au tempo, jamais au calme
 * (`data-vivante`) : le tampon y est posé d'emblée.
 */
export default function CartePostale({ titre, annee, mot, signe, postee, frappe = false, adresse, onFermer, children }: Props) {
  const calme = useMouvementReduit()
  const refermer = useDialogue<HTMLButtonElement>(onFermer)
  const recto = rectoDe(annee)
  return (
    <div className={styles.calque} style={STYLE_DU_TEMPO} role="dialog" aria-modal="true" aria-label={titre} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.defil}>
        <button ref={refermer} type="button" className={styles.retour} aria-label={M.ouverte.refermer} onClick={onFermer}>
          <span aria-hidden="true">‹</span>
        </button>
        <div className={styles.cadre}>
          <Rubrique balise="p">
            {titre} <small>{gareDe(annee)}</small>
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
              <p>{mot}</p>
              <p className={styles.signe}>{signe}</p>
            </div>
            <div className={styles.adr}>
              <small>{M.ouverte.adresse}</small>
              <Timbre />
              {postee ? <Cachet carte={postee} frais={frappe} /> : null}
              <p>
                {adresse.map((ligne) => (
                  <span key={ligne}>{ligne}</span>
                ))}
              </p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

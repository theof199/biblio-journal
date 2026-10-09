import { useEffect, useId, useMemo, useState, type CSSProperties, type RefObject } from 'react'
import type { Monde } from '../mondes/types'
import { alea } from '../carte/outils'
import { useMouvementReduit } from '../ui/mouvement'
import Toile, { LARGEUR_LOGIQUE } from './Toile'
import { useDialogue } from './dialogue'
import { gabaritDe } from './gabarit'
import { NUMERO_DE_FEUILLE, paragraphes, partieComposee } from './feuille'
import styles from './Feuille.module.css'

/** Les cadences de la maquette (`composer`, `attente`), en millisecondes. */
const MOT = 75
const AVANT_LA_SUITE = 350
const ENTRE_LES_SUITES = 420
const LETTRE = 65
const EFFACE = 26
const PAUSE = 1100

type Etat = { type: 'texte'; texte: string } | { type: 'attente' } | { type: 'erreur'; message: string }

interface Props {
  /** L'habillage du monde de l'année : ses jetons, ses mots, et le dessin de sa feuille (par défaut, le prospectus sous son estrade). */
  monde: Monde
  quoi: keyof typeof NUMERO_DE_FEUILLE
  /** Au-dessus du titre (« Ouverture », « Salle », « Le film », « Générique »), le titre, puis la ligne sous lui. */
  esp: string
  titre: string
  sous: string
  /** Le texte, ou l'attente, ou l'erreur (son `message` tel que l'API l'a écrit). */
  etat: Etat
  onReessayer: () => void
  onFermer: () => void
}

/** Le premier paragraphe découpé pour la composition : la lettrine, les mots au plomb, le reste en fondu. */
function composition(texte: string) {
  const paras = paragraphes(texte)
  const premier = paras[0] ?? ''
  const n = partieComposee(premier)
  const r = alea(texte.length)
  let rang = 0
  const mots = premier
    .slice(1, n)
    .split(/(\s+)/)
    .filter(Boolean)
    .map((jeton) => {
      if (/^\s+$/.test(jeton)) return null
      // L'encre et le décalage de chaque mot de plomb, tirés comme la maquette : le décalage d'abord.
      const dy = `${(r() * 1.2 - 0.6).toFixed(2)}px`
      const o = (0.74 + r() * 0.26).toFixed(2)
      return { jeton, dy, o, rang: rang++ }
    })
  return { paras, premier, n, mots, compte: rang }
}

/** Un mot de plomb : son décalage et son encre, tirés une fois, et le moment où il tombe (en millisecondes depuis l'ouverture). */
export interface MotDePlomb {
  jeton: string
  dy: string
  o: string
  delai: number
}

/**
 * Ce que la feuille montre, déjà composé par `Feuille` : le dessin ne découpe rien et ne tient aucune
 * horloge. Un texte : sa lettrine, la part du premier paragraphe qui se compose (`debut` d'un bloc
 * quand tout est posé, `mots` un à un sinon ; `null` y est un blanc), sa suite et les paragraphes
 * suivants, chacun dit vu ou non. L'attente : la phrase entière, et ce qui en est tapé.
 */
export type CorpsDeLaFeuille =
  | { type: 'erreur'; message: string }
  | { type: 'attente'; phrase: string; tapee: string }
  | { type: 'texte'; pose: boolean; lettrine: string; debut: string; mots: (MotDePlomb | null)[]; suite: { texte: string; vue: boolean }; paragraphes: { texte: string; vu: boolean }[] }
  | { type: 'vide' }

/**
 * Ce que `Feuille` passe au dessin de la feuille du chroniqueur, section que le monde peut composer
 * (`GabaritsDesPages.feuilleDuChroniqueur`). Le dialogue, son nom, le focus, Échap, les minuteries et
 * le calme restent à `Feuille` : le dessin pose les deux identifiants, la référence de « Fermer », et
 * rend ce qu'on lui dit vu.
 */
export interface PropsFeuilleDuChroniqueur {
  monde: Monde
  quoi: keyof typeof NUMERO_DE_FEUILLE
  esp: string
  titre: string
  sous: string
  /** Les identifiants que la rubrique et le titre portent : c'est par eux, dans cet ordre, que le dialogue se nomme. */
  idDeLEsp: string
  idDuTitre: string
  /** La référence que le bouton « Fermer » porte : il prend le focus à l'ouverture. */
  fermer: RefObject<HTMLButtonElement>
  onFermer: () => void
  onReessayer: () => void
  /** Au calme, tout est déjà posé (`corps` le dit aussi) et rien ne doit bouger. */
  calme: boolean
  /** Le chroniqueur se tait, tape (l'attente) ou parle (le texte se compose). */
  parle: 'non' | 'tape' | 'parle'
  corps: CorpsDeLaFeuille
}

/** Le dessin par défaut : l'estrade du monde en tête, puis le prospectus (maquette 1890, écran VIII). */
export function Prospectus({ monde, quoi, esp, titre, sous, idDeLEsp, idDuTitre, fermer, onFermer, onReessayer, parle, corps }: PropsFeuilleDuChroniqueur) {
  const { mots: m, hauteurs, dessinerEstrade } = monde.pages
  return (
    <div className={styles.colonne}>
      <div className={styles.bandeau}>
        <Toile
          hauteur={hauteurs.estrade}
          libelle="Le chroniqueur sur son estrade."
          dessiner={(ctx, t, vivant) => dessinerEstrade({ ctx, W: LARGEUR_LOGIQUE, H: hauteurs.estrade, t, vivant, parle })}
        />
        <button ref={fermer} type="button" className={styles.fermer} aria-label="Fermer" onClick={onFermer}>
          <span aria-hidden="true">‹</span>
        </button>
      </div>

      <article className={styles.prospectus}>
        <div className={styles.tete}>
          <small>{m.feuille.tete}</small>
          <strong>{m.feuille.titre}</strong>
          <em>{m.feuille.sous}</em>
        </div>
        <div className={styles.titre}>
          <span id={idDeLEsp}>{esp}</span>
          <b id={idDuTitre}>{titre}</b>
          {sous ? <i>{sous}</i> : null}
        </div>

        <div className={styles.corps} aria-live="polite">
          {corps.type === 'erreur' ? (
            <div className={styles.relache}>
              <span className={styles.bande} aria-hidden="true">
                {m.chroniqueur.relache}
              </span>
              <p>{corps.message}</p>
              <button type="button" className={styles.bouton} onClick={onReessayer}>
                Réessayer
              </button>
            </div>
          ) : corps.type === 'attente' ? (
            <p role="status" aria-label={corps.phrase} className={styles.attente}>
              <span aria-hidden="true">{corps.tapee}</span>
              <span className={styles.curseur} aria-hidden="true" />
            </p>
          ) : corps.type === 'texte' ? (
            <>
              <p>
                <span className={styles.lettrine}>{corps.lettrine}</span>
                {corps.pose
                  ? corps.debut
                  : corps.mots.map((mot, k) => {
                      if (mot === null) return ' '
                      // Sa place finale, son encre : l'animation part d'au-dessus, transparente, et s'y pose.
                      const plomb: CSSProperties = {
                        opacity: mot.o,
                        transform: `translateY(${mot.dy})`,
                        animationDelay: `${mot.delai}ms`,
                      }
                      return (
                        <span key={k} className={styles.mot} style={plomb}>
                          {mot.jeton}
                        </span>
                      )
                    })}
                <span className={styles.suite} style={corps.suite.vue ? undefined : { opacity: 0 }}>
                  {corps.suite.texte}
                </span>
              </p>
              {corps.paragraphes.map((p, i) => (
                <p key={i} className={styles.suite} style={p.vu ? undefined : { opacity: 0 }}>
                  {p.texte}
                </p>
              ))}
            </>
          ) : null}
        </div>

        <div className={styles.pied}>
          <span>{m.feuille.pied}</span>
          <span>{m.chroniqueur.numero(NUMERO_DE_FEUILLE[quoi])}</span>
        </div>
        <p className={styles.imprimeur}>{m.feuille.imprimeur}</p>
      </article>
    </div>
  )
}

/**
 * La feuille du chroniqueur (maquette 1890, écran VIII, `initChroniqueur`) : un dialogue par-dessus
 * la page. Un texte se compose : le premier paragraphe mot à mot, le reste en fondu ; l'attente tape
 * sa phrase ; l'erreur fait relâche et propose de réessayer. Au calme, tout est posé d'un coup, sans
 * minuterie. Son dessin est une section que le monde peut composer (`gabarits.feuilleDuChroniqueur` ;
 * le défaut : `Prospectus`, sous l'estrade du monde) : `Feuille` garde le dialogue, le focus, Échap,
 * les cadences et le calme, et lui passe ce qui est vu et ce qui est tapé.
 */
export default function Feuille({ monde, quoi, esp, titre, sous, etat, onReessayer, onFermer }: Props) {
  const calme = useMouvementReduit()
  const fermer = useDialogue<HTMLButtonElement>(onFermer)
  const id = useId()
  const { mots: m, jetons } = monde.pages
  // La phrase de l'attente, tapée lettre à lettre (maquette : `attente`) : un mot du monde.
  const ecrit = m.chroniqueur.ecrit
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }

  // La clé de l'état, et non l'objet : une relecture de la page qui rend le même texte ne recompose rien.
  const texte = etat.type === 'texte' ? etat.texte : null
  const compo = useMemo(() => (texte === null ? null : composition(texte)), [texte])
  const suites = compo ? compo.paras.length : 0
  const fin = compo ? compo.compte * MOT + AVANT_LA_SUITE : 0

  const [vues, setVues] = useState(0)
  const [compose, setCompose] = useState(false)
  const [tapees, setTapees] = useState(0)

  useEffect(() => {
    setVues(0)
    setCompose(false)
    setTapees(0)
    if (calme) return
    const minuteurs: number[] = []
    const plus = (f: () => void, ms: number) => void minuteurs.push(window.setTimeout(f, ms))
    if (texte !== null) {
      setCompose(true)
      for (let i = 0; i < suites; i += 1) plus(() => setVues(i + 1), fin + i * ENTRE_LES_SUITES)
      plus(() => setCompose(false), fin + suites * ENTRE_LES_SUITES)
    } else if (etat.type === 'attente') {
      let i = 0
      let sens = 1
      const pas = () => {
        if (sens > 0) {
          i += 1
          setTapees(i)
          if (i >= ecrit.length) {
            sens = -1
            plus(pas, PAUSE)
          } else plus(pas, LETTRE)
        } else {
          i -= 1
          setTapees(i)
          if (i <= 0) sens = 1
          plus(pas, EFFACE)
        }
      }
      pas()
    }
    return () => minuteurs.forEach((m) => window.clearTimeout(m))
  }, [calme, texte, etat.type, suites, fin, ecrit])

  const parle = etat.type === 'attente' ? 'tape' : !calme && compose ? 'parle' : 'non'
  const corps: CorpsDeLaFeuille =
    etat.type === 'erreur'
      ? { type: 'erreur', message: etat.message }
      : etat.type === 'attente'
        ? { type: 'attente', phrase: ecrit, tapee: calme ? ecrit : ecrit.slice(0, tapees) }
        : compo && compo.premier
          ? {
              type: 'texte',
              pose: calme,
              lettrine: compo.premier[0]!,
              debut: compo.premier.slice(1, compo.n),
              mots: compo.mots.map((mot) => (mot === null ? null : { jeton: mot.jeton, dy: mot.dy, o: mot.o, delai: mot.rang * MOT })),
              suite: { texte: compo.premier.slice(compo.n), vue: calme || vues >= 1 },
              paragraphes: compo.paras.slice(1).map((p, i) => ({ texte: p, vu: calme || vues >= i + 2 })),
            }
          : { type: 'vide' }
  const Dessin = gabaritDe(monde, 'feuilleDuChroniqueur', Prospectus)

  return (
    <div className={styles.calque} style={style} role="dialog" aria-modal="true" aria-labelledby={`${id}-esp ${id}-titre`}>
      <Dessin monde={monde} quoi={quoi} esp={esp} titre={titre} sous={sous} idDeLEsp={`${id}-esp`} idDuTitre={`${id}-titre`} fermer={fermer} onFermer={onFermer} onReessayer={onReessayer} calme={calme} parle={parle} corps={corps} />
    </div>
  )
}

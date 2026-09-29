import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import type { Monde } from '../mondes/types'
import { alea } from '../carte/outils'
import { useMouvementReduit } from '../ui/mouvement'
import Toile, { LARGEUR_LOGIQUE } from './Toile'
import { useDialogue } from './dialogue'
import { NUMERO_DE_FEUILLE, paragraphes, partieComposee } from './feuille'
import styles from './Feuille.module.css'

/** La phrase de l'attente, tapée lettre à lettre (maquette : `attente`). */
const ECRIT = 'Le chroniqueur écrit…'

/** Les cadences de la maquette (`composer`, `attente`), en millisecondes. */
const MOT = 75
const AVANT_LA_SUITE = 350
const ENTRE_LES_SUITES = 420
const LETTRE = 65
const EFFACE = 26
const PAUSE = 1100

type Etat = { type: 'texte'; texte: string } | { type: 'attente' } | { type: 'erreur'; message: string }

interface Props {
  /** L'habillage du monde de l'année : ses jetons, ses mots, son estrade. */
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

/**
 * La feuille du chroniqueur (maquette 1890, écran VIII, `initChroniqueur`) : un dialogue par-dessus
 * la page, l'estrade du monde en tête, puis le prospectus. Un texte se compose : le premier
 * paragraphe mot à mot, le reste en fondu ; l'attente tape sa phrase ; l'erreur fait relâche et
 * propose de réessayer. Au calme, tout est posé d'un coup, sans minuterie.
 */
export default function Feuille({ monde, quoi, esp, titre, sous, etat, onReessayer, onFermer }: Props) {
  const calme = useMouvementReduit()
  const fermer = useDialogue<HTMLButtonElement>(onFermer)
  const id = useId()
  const { mots: m, hauteurs, dessinerEstrade, jetons } = monde.pages
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
          if (i >= ECRIT.length) {
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
  }, [calme, texte, etat.type, suites, fin])

  const parle = etat.type === 'attente' ? 'tape' : !calme && compose ? 'parle' : 'non'
  const toutPose = calme

  return (
    <div className={styles.calque} style={style} role="dialog" aria-modal="true" aria-labelledby={`${id}-esp ${id}-titre`}>
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
            <span id={`${id}-esp`}>{esp}</span>
            <b id={`${id}-titre`}>{titre}</b>
            {sous ? <i>{sous}</i> : null}
          </div>

          <div className={styles.corps} aria-live="polite">
            {etat.type === 'erreur' ? (
              <div className={styles.relache}>
                <span className={styles.bande} aria-hidden="true">
                  RELÂCHE
                </span>
                <p>{etat.message}</p>
                <button type="button" className={styles.bouton} onClick={onReessayer}>
                  Réessayer
                </button>
              </div>
            ) : etat.type === 'attente' ? (
              <p role="status" aria-label={ECRIT} className={styles.attente}>
                <span aria-hidden="true">{calme ? ECRIT : ECRIT.slice(0, tapees)}</span>
                <span className={styles.curseur} aria-hidden="true" />
              </p>
            ) : compo && compo.premier ? (
              <>
                <p>
                  <span className={styles.lettrine}>{compo.premier[0]}</span>
                  {toutPose
                    ? compo.premier.slice(1, compo.n)
                    : compo.mots.map((mot, k) => {
                        if (mot === null) return ' '
                        // Sa place finale, son encre : l'animation part d'au-dessus, transparente, et s'y pose.
                        const plomb: CSSProperties = {
                          opacity: mot.o,
                          transform: `translateY(${mot.dy})`,
                          animationDelay: `${mot.rang * MOT}ms`,
                        }
                        return (
                          <span key={k} className={styles.mot} style={plomb}>
                            {mot.jeton}
                          </span>
                        )
                      })}
                  <span className={styles.suite} style={toutPose || vues >= 1 ? undefined : { opacity: 0 }}>
                    {compo.premier.slice(compo.n)}
                  </span>
                </p>
                {compo.paras.slice(1).map((p, i) => (
                  <p key={i} className={styles.suite} style={toutPose || vues >= i + 2 ? undefined : { opacity: 0 }}>
                    {p}
                  </p>
                ))}
              </>
            ) : null}
          </div>

          <div className={styles.pied}>
            <span>{m.feuille.pied}</span>
            <span>{`Feuille n° ${NUMERO_DE_FEUILLE[quoi]}`}</span>
          </div>
          <p className={styles.imprimeur}>{m.feuille.imprimeur}</p>
        </article>
      </div>
    </div>
  )
}

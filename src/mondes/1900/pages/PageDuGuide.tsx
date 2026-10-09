import type { CSSProperties } from 'react'
import { NUMERO_DE_FEUILLE } from '../../../voyage/feuille'
import type { PropsFeuilleDuChroniqueur } from '../../../voyage/Feuille'
import { STYLE_DU_TEMPO } from '../../../voyage/tempo'
import Action from './Action'
import Rubrique from './Rubrique'
import styles from './PageDuGuide.module.css'

/**
 * La feuille du chroniqueur des années 1900 (`feuilleDuChroniqueur`) : une page du « Guide du
 * voyageur », sans estrade (décision du 9 octobre 2026). La maquette ne dessine pas cet écran : il
 * déplie l'encart du guide de la fiche d'année (écran 2, `.guide`, `.sec`), dont il reprend le titre de
 * rubrique, le filet de laiton à gauche de la colonne et les caractères. En tête, hors de ce qui
 * défile, le titre courant, le folio (le numéro de la feuille) et « Fermer » ; dessous, la rubrique
 * (`esp`, que le site passe selon ce qui se lit), le titre, puis le texte en colonne sous sa lettrine.
 *
 * `Feuille` garde le dialogue, le focus, Échap, les cadences et le calme : ce dessin ne tient aucune
 * horloge. Un mot ne vient qu'à son moment (`delai`), la suite et un paragraphe que dits vus, et rien
 * ne bouge hors d'une racine vivante.
 */
export default function PageDuGuide({ monde, quoi, esp, titre, sous, idDeLEsp, idDuTitre, fermer, onFermer, onReessayer, calme, corps }: PropsFeuilleDuChroniqueur) {
  const m = monde.pages.mots
  const cache = (vu: boolean): CSSProperties | undefined => (vu ? undefined : { opacity: 0 })
  return (
    <div className={styles.page} style={STYLE_DU_TEMPO} data-vivante={calme ? 'non' : 'oui'}>
      <div className={styles.tete}>
        <Rubrique balise="p">
          {m.feuille.tete}
          <small>{m.chroniqueur.numero(NUMERO_DE_FEUILLE[quoi])}</small>
        </Rubrique>
        <button ref={fermer} type="button" className={styles.fermer} onClick={onFermer}>
          Fermer
        </button>
      </div>

      <div className={styles.defile}>
        <div className={styles.titre}>
          <span id={idDeLEsp}>{esp}</span>
          <h2 id={idDuTitre}>{titre}</h2>
          {sous ? <p>{sous}</p> : null}
        </div>

        <div className={styles.colonne} aria-live="polite">
          {corps.type === 'erreur' ? (
            <AvisDuGuide plaque={m.chroniqueur.relache} message={corps.message} onReessayer={onReessayer} />
          ) : corps.type === 'attente' ? (
            <SousPresse phrase={corps.phrase} tapee={corps.tapee} />
          ) : corps.type === 'texte' ? (
            <>
              <p>
                <span className={styles.lettrine}>{corps.lettrine}</span>
                {corps.pose
                  ? corps.debut
                  : corps.mots.map((mot, k) =>
                      mot === null ? (
                        ' '
                      ) : (
                        // Le moment du mot est celui que `Feuille` cadence ; sa venue, elle, est au tempo (la feuille).
                        <span key={k} className={styles.mot} style={{ animationDelay: `${mot.delai}ms` }}>
                          {mot.jeton}
                        </span>
                      ),
                    )}
                <span className={styles.suite} style={cache(corps.suite.vue)}>
                  {corps.suite.texte}
                </span>
              </p>
              {corps.paragraphes.map((p, i) => (
                <p key={i} className={styles.suite} style={cache(p.vu)}>
                  {p.texte}
                </p>
              ))}
            </>
          ) : null}
        </div>

        <div className={styles.pied}>
          <p>
            {m.feuille.titre} <em>{m.feuille.sous}</em>
          </p>
          <p className={styles.colophon}>
            <span>{m.feuille.pied}</span>
            <span>{m.feuille.imprimeur}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

/** L'attente du Guide : la phrase à la presse (ce qui en est déjà frappé), le tiret où tombera la suite. La feuille et une année en préparation la montrent. */
export function SousPresse({ phrase, tapee }: { phrase: string; tapee: string }) {
  return (
    <p role="status" aria-label={phrase} className={styles.attente}>
      <span aria-hidden="true">{tapee}</span>
      <span className={styles.curseur} aria-hidden="true" />
    </p>
  )
}

/** L'avis de gare du Guide : sa plaque rouge, ce qui est arrivé, « Réessayer ». Commun à la feuille et à une année en préparation. */
export function AvisDuGuide({ plaque, message, onReessayer }: { plaque: string; message: string; onReessayer: () => void }) {
  return (
    <div className={styles.avis}>
      <span className={styles.plaque} aria-hidden="true">
        {plaque}
      </span>
      <p>{message}</p>
      <Action onClick={onReessayer}>Réessayer</Action>
    </div>
  )
}

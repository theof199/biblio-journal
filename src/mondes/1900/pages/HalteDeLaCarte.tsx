import { useEffect, useState, type CSSProperties } from 'react'
import { BASCULE_DU_LEVIER } from '../durees'
import { useMouvementReduit } from '../../../ui/mouvement'
import { GARDE_DU_CHOIX } from '../../../voyage/celebrations/deroule'
import type { PropsHalteDeLaCarte } from '../../../voyage/halte/Halte'
import { imageDu1900 } from '../images'
import DessinDeLaHalte from './DessinDeLaHalte'
import { MOTS_DE_LA_HALTE as M, compteDit, compteLu, enteteDeLaHalte, etatDit, plexDe } from './halte'
import styles from './Halte.module.css'

/**
 * Une halte ouverte sur la carte de 1900 (maquette « Voyage immobile 1900 », `#halte`) : la petite
 * gare au bout de l'embranchement, sa plaque émaillée au nom servi, « hors ligne · embranchement »,
 * et son indicateur : le compte, puis chaque film (son affiche ou « sans affiche », son titre, son
 * année, son état par les mots d'un film de salle, son lien Plex s'il en a un). **Aucun geste n'y
 * marque un film vu et aucun film ne s'y ouvre** (décision 9 du propriétaire : un film de halte se
 * cherche et se composte comme tout film) : le seul bouton est « Revenir sur la ligne ».
 *
 * Derrière la petite gare dessinée, le lointain en photographie (maquette : `.halte::before`,
 * `--i-loin1` ; ici `loin1` de `assets/`, le premier lointain que la carte montre déjà par la vitre :
 * aucun poids de plus), décorative, donc muette ; sans elle le ciel reste.
 *
 * Un dialogue par-dessus la carte ; il pose lui-même les jetons du monde (la carte ne les pose pas),
 * le tempo vient de l'écran de la carte. Il entre en glissant de la droite, jamais au calme
 * (`data-vivante`). Il s'ouvre sous le doigt qui vient de toucher le levier : hors du calme, « Revenir
 * sur la ligne » reste inerte un instant (`GARDE_DU_CHOIX`), pour qu'un toucher redoublé ne le referme
 * pas avant qu'on l'ait vu. Échap et le retour, eux, referment toujours.
 */
function HalteEntree({ monde, halte, compte, premier, fermer }: Omit<PropsHalteDeLaCarte, 'apresLeLevier'>) {
  const calme = useMouvementReduit()
  // Entrée après la bascule, elle se monte après que le bloc lecteur a cherché son bouton : il prend le focus ici.
  useEffect(() => premier.current?.focus(), [premier])
  const { jetons, mots } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const lointain = imageDu1900('loin1')
  const [arme, setArme] = useState(calme)
  useEffect(() => {
    if (arme) return
    const j = setTimeout(() => setArme(true), GARDE_DU_CHOIX)
    return () => clearTimeout(j)
  }, [arme])
  return (
    <div className={styles.halte} style={style} role="dialog" aria-modal="true" aria-labelledby="halte-nom" data-vivante={calme ? 'non' : 'oui'}>
      {lointain ? <div className={styles.lointain} style={{ backgroundImage: `url(${lointain})` }} aria-hidden="true" /> : null}
      <div className={styles.decor}>
        <DessinDeLaHalte />
      </div>
      <p className={styles.plaque}>
        <b id="halte-nom">{halte.nom}</b>
        <small>{M.horsLigne}</small>
      </p>
      <div className={styles.indicateur}>
        <p className={styles.entete}>
          <span>{enteteDeLaHalte(compte.total)}</span>
          {/* Un `aria-label` sur un `<b>` sans rôle ne se lit pas : le compte se lit par un texte caché
              à l'œil, et le chiffre visible est caché au lecteur d'écran. */}
          <b>
            <span className="sr-only">{compteLu(compte)}</span>
            <span aria-hidden="true">{compteDit(compte)}</span>
          </b>
        </p>
        <ol>
          {halte.films.map((film) => (
            <li key={film.tmdb_id} data-etat={film.etat}>
              {/* Une affiche nulle n'a pas d'image : son cadre dit « sans affiche ». */}
              {film.cover_url ? <img src={film.cover_url} alt="" loading="lazy" decoding="async" /> : <span className={styles.sans}>{M.sansAffiche}</span>}
              <span className={styles.titre}>{film.title}</span>
              <small>{film.year}</small>
              <em>{etatDit(film, mots.introuvable)}</em>
              {film.plex_url ? (
                <a href={film.plex_url} target="_blank" rel="noreferrer" aria-label={plexDe(film)}>
                  {M.plex}
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <button ref={premier} type="button" className={styles.revenir} aria-disabled={!arme} onClick={() => void (arme && fermer())}>
        {M.revenir}
      </button>
    </div>
  )
}

/**
 * **Le levier bascule d'abord, la halte entre ensuite.** Ouverte sous le doigt qui vient de toucher le
 * levier (`apresLeLevier`), elle n'est pas à l'écran tant qu'il bascule (`BASCULE_DU_LEVIER`, au
 * tempo : sinon elle glisse par-dessus lui et l'aller ne se voit pas). L'adresse la porte déjà, et la
 * carte est inerte dessous : rien d'autre ne s'ouvre dans l'intervalle, Échap et le retour referment.
 * Au calme rien n'attend (le levier y est posé d'un coup), ni pour une halte que l'adresse portait en
 * arrivant : il n'y a pas eu de geste.
 */
export default function HalteDeLaCarte({ apresLeLevier, ...halte }: PropsHalteDeLaCarte) {
  const calme = useMouvementReduit()
  const [entree, setEntree] = useState(calme || !apresLeLevier)
  useEffect(() => {
    if (entree) return
    const j = setTimeout(() => setEntree(true), BASCULE_DU_LEVIER)
    return () => clearTimeout(j)
  }, [entree])
  return entree ? <HalteEntree {...halte} /> : null
}

import { useState } from 'react'
import type { Malle, PlaceDeMalle } from '../../../api/voyage'
import Panne from '../../../ui/Panne'
import { useDialogue } from '../../../voyage/dialogue'
import { jourDeParis } from '../../../voyage/passeport'
import type { PropsMalleDeLaSacoche } from '../../../voyage/sacoche/Malle'
import BadgeDeMalle from './BadgeDeMalle'
import {
  MOTS_DE_LA_MALLE as M,
  ceQueDitLaTrace,
  compteDeLaLigne,
  compteDeLaMalle,
  derniereCollee,
  derniereDite,
  etatDeLaPlace,
  nomLuDeLaPlace,
  nouvellesDites,
  placeAuDepart,
  plaqueDeLaMalle,
  teteDeLaFiche,
  traversDeLaPlace,
} from './malle'
import Rubrique from './Rubrique'
import styles from './Malle.module.css'
import sacoche from './Sacoche.module.css'

/** Ce qu'une place dit quand on la touche (maquette, l. 3865-3870) : son nom, sa règle, sa date ou ce qui manque, avec sa jauge. */
function Fiche({ place, nouvelle }: { place: PlaceDeMalle; nouvelle: boolean }) {
  const etat = etatDeLaPlace(place)
  const p = place.progression
  return (
    <div className={styles.fiche} role="status">
      <div className={styles.vue} data-etat={etat}>
        <BadgeDeMalle place={place} muet />
      </div>
      <div>
        <small>{teteDeLaFiche(place, nouvelle)}</small>
        {etat === 'cachee' ? (
          <>
            <b>{M.ouverte.nomDeLaCachee}</b>
            <p>{M.ouverte.regleDeLaCachee}</p>
          </>
        ) : (
          <>
            <b>{place.nom}</b>
            {place.regle ? <p>{place.regle}</p> : null}
            {etat === 'collee' ? (
              <p className={styles.etat}>
                {M.ouverte.collee} <time dateTime={place.collee_le!}>{jourDeParis(place.collee_le!)}</time>
              </p>
            ) : (
              <>
                <p className={styles.etat}>{ceQueDitLaTrace(place)}</p>
                {p ? (
                  <div className={styles.jauge} aria-hidden="true">
                    {Array.from({ length: p.seuil }, (_, k) => (
                      <i key={k} data-fait={k < p.fait ? 'oui' : 'non'} />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * La malle ouverte (maquette, écran 18) : la valise, ses places par numéro, la plaque de la compagnie,
 * et dessous la fiche de la place touchée. Un dialogue par-dessus la sacoche : « Refermer » prend le
 * focus et le rend, Échap ferme. La place choisie n'est qu'à l'écran : la dernière collée en
 * s'ouvrant, sinon la première. Rien n'y bouge.
 */
function MalleOuverte({ malle, nouvelles, onFermer }: { malle: Malle; nouvelles: readonly number[]; onFermer: () => void }) {
  const refermer = useDialogue<HTMLButtonElement>(onFermer)
  const [numero, setNumero] = useState<number | null>(null)
  const choisie = malle.etiquettes.find((p) => p.numero === numero) ?? placeAuDepart(malle.etiquettes)
  return (
    <div className={styles.calque} role="dialog" aria-modal="true" aria-label={M.ouverte.titre}>
      <button ref={refermer} type="button" className={styles.retour} aria-label={M.ouverte.refermer} onClick={onFermer}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className={styles.defil}>
        <div className={styles.cadre}>
          <Rubrique>
            {M.ouverte.titre} <small>{compteDeLaMalle(malle)}</small>
          </Rubrique>
          <div className={styles.valise}>
            <i className={styles.sangle} data-cote="g" />
            <i className={styles.sangle} data-cote="d" />
            {(['a', 'b', 'c', 'd'] as const).map((c) => (
              <i key={c} className={styles.coin} data-coin={c} />
            ))}
            <ul className={styles.places}>
              {malle.etiquettes.map((p, rang) => {
                // Collée un peu de travers ; touchée, elle se redresse et grossit (la feuille n'a pas de variable à elle).
                const { r, x, y } = traversDeLaPlace(rang)
                const touchee = p === choisie
                const neuve = nouvelles.includes(p.numero)
                return (
                  <li key={p.numero}>
                    <button
                      type="button"
                      className={styles.place}
                      style={{ transform: `translate(${x}px, ${y}px) ${touchee ? 'scale(1.1)' : `rotate(${r}deg)`}` }}
                      data-etat={etatDeLaPlace(p)}
                      aria-pressed={touchee}
                      aria-label={nomLuDeLaPlace(p)}
                      onClick={() => setNumero(p.numero)}
                    >
                      <BadgeDeMalle place={p} muet />
                      {neuve ? (
                        <span className={styles.neuve} style={{ transform: `translateX(-50%) rotate(${touchee ? 0 : -r}deg)` }}>
                          {M.nouvelle}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
              <li className={styles.plaque} aria-hidden="true">
                {M.ouverte.compagnie}
                <b>{plaqueDeLaMalle(malle.decennie)}</b>
              </li>
            </ul>
          </div>
        </div>
      </div>
      {choisie ? (
        <div className={styles.cadre}>
          <Fiche place={choisie} nouvelle={nouvelles.includes(choisie.numero)} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * La malle aux étiquettes dans la sacoche des années 1900 (maquette, écran 15 : `.ligne-malle` ; écran
 * 18 : la malle ouverte) : sa rubrique, puis une ligne de cuir — l'étiquette collée en dernier, « 5
 * étiquettes sur 15 » avec le total que le serveur sert, « La Correspondance, collée le 29 septembre
 * 2026 » au jour de Paris, « 1 nouvelle » — qui ouvre la malle. Le dessin ne lit ni n'écrit rien :
 * `voyage/sacoche/Malle.tsx` lui passe la malle lue, ce qui est nouveau pour la visite, et le calque
 * que l'adresse porte. Rien n'y bouge.
 */
export default function MalleDeLaSacoche({ panne, malle, nouvelles, ouverte, ouvrir, fermer }: PropsMalleDeLaSacoche) {
  const derniere = malle ? derniereCollee(malle.etiquettes) : null
  return (
    <>
      <Rubrique>
        {M.titre} <small>{M.sous}</small>
      </Rubrique>
      {panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : malle ? (
        <>
          <button type="button" className={styles.ligne} data-mini={derniere ? 'oui' : 'non'} aria-haspopup="dialog" onClick={ouvrir}>
            {derniere ? (
              <span className={styles.mini}>
                <BadgeDeMalle place={derniere} muet />
              </span>
            ) : null}
            <span>
              <b>{compteDeLaLigne(malle)}</b>
              {derniere ? <small>{derniereDite(derniere)}</small> : null}
            </span>
            {nouvelles.length > 0 ? <em>{nouvellesDites(nouvelles.length)}</em> : null}
          </button>
          {ouverte ? <MalleOuverte malle={malle} nouvelles={nouvelles} onFermer={fermer} /> : null}
        </>
      ) : null}
    </>
  )
}

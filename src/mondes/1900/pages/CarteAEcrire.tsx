import { useId, useState } from 'react'
import Panne from '../../../ui/Panne'
import type { CarteAEcrire as Props } from '../../../voyage/sacoche/Courrier'
import { MOT_MAX, motPostable } from '../../../voyage/sacoche/mot'
import CartePostale from './CartePostale'
import { MOTS_DU_COURRIER as M, compteDuMot } from './courrier'
import styles from './Courrier.module.css'
import sacoche from './Sacoche.module.css'

/**
 * La carte à écrire d'une gare bouclée (plan des écrans des lots, brief 14 ; maquette, écran 19) : le
 * même dos divisé que la carte lue (`CartePostale.tsx`), sans tampon, où le brouillon se lit à la plume
 * à mesure qu'il s'écrit, puis de quoi l'écrire : **un champ d'une ligne** (le serveur refuse un saut
 * de ligne ; la maquette avait un `textarea`), 140 signes et leur compte, et le destinataire parmi mes
 * abonnements. **L'adresse ne dit que le pseudo** : la gare du destinataire vient avec la carte postée.
 * **Une carte ne se corrige ni ne se retire** : « Poster la carte » ne poste rien, il demande ; seul
 * « La poster pour de bon » l'envoie. Le brouillon n'est que dans ce composant : refermée, la carte
 * est blanche. Sans abonnement, elle le dit et n'offre ni champ ni bouton. Le dessin ne lit ni n'écrit
 * rien : `voyage/sacoche/Courrier.tsx` lit mes abonnements et poste. Rien n'y bouge.
 */
export default function CarteAEcrire({ carte, onFermer }: { carte: Props; onFermer: () => void }) {
  const [mot, setMot] = useState('')
  const [choisi, setChoisi] = useState<string | null>(null)
  const [demande, setDemande] = useState(false)
  const compte = useId()
  const destinataire = carte.abonnements?.find((a) => a.id === choisi) ?? null
  const pret = motPostable(mot) && destinataire !== null && !carte.enCours

  return (
    <CartePostale titre={M.ecrire.titre} annee={carte.annee} mot={mot} signe={carte.moi} postee={null} adresse={destinataire ? [destinataire.pseudo] : []} onFermer={onFermer}>
      {carte.panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={carte.panne.erreur} onReessayer={carte.panne.reessayer} />
        </div>
      ) : carte.abonnements === null ? null : carte.abonnements.length === 0 ? (
        <p className={styles.etat}>{M.ecrire.personne}</p>
      ) : (
        <form
          className={styles.ecrire}
          onSubmit={(e) => {
            e.preventDefault()
            setDemande(true)
          }}
        >
          <label>
            <span>{M.ecrire.mot}</span>
            <input
              type="text"
              value={mot}
              maxLength={MOT_MAX}
              autoComplete="off"
              enterKeyHint="done"
              aria-describedby={compte}
              onChange={(e) => {
                setMot(e.target.value)
                setDemande(false)
              }}
            />
          </label>
          <p id={compte} className={styles.compte}>
            {compteDuMot(mot)}
          </p>
          <fieldset>
            <legend>{M.ecrire.aQui}</legend>
            {carte.abonnements.map((a) => (
              <label key={a.id}>
                <input
                  type="radio"
                  name="destinataire"
                  checked={a.id === choisi}
                  onChange={() => {
                    setChoisi(a.id)
                    setDemande(false)
                  }}
                />
                <span>{a.pseudo}</span>
              </label>
            ))}
          </fieldset>
          {carte.refus ? (
            <p className={styles.refus} role="alert">
              {carte.refus}
            </p>
          ) : null}
          {carte.enCours ? (
            <p className={styles.etat} role="status">
              {M.ecrire.enCours}
            </p>
          ) : demande && pret ? (
            <div className={styles.confirmer}>
              <p>{M.ecrire.avertir}</p>
              <button
                type="button"
                onClick={() => {
                  setDemande(false)
                  carte.poster(destinataire.id, mot)
                }}
              >
                {M.ecrire.confirmer}
              </button>
              <button type="button" onClick={() => setDemande(false)}>
                {M.ecrire.attendre}
              </button>
            </div>
          ) : (
            <button type="submit" className={styles.poster} disabled={!pret}>
              {M.ecrire.poster}
            </button>
          )}
        </form>
      )}
    </CartePostale>
  )
}

import { useEffect, useRef } from 'react'
import type { CartePostaleEnvoyee, CartePostaleRecue } from '../../../api/voyage'
import Panne from '../../../ui/Panne'
import type { CarteOuverte, PropsCourrierDeLaSacoche } from '../../../voyage/sacoche/Courrier'
import CarteAEcrire from './CarteAEcrire'
import CartePostale from './CartePostale'
import { MOTS_DU_COURRIER as M, adresseDe, carteAEcrireDe, ceQueDitLaCarte, ceQueDitLaPostee, enteteDeLEnvoyee, enteteDeLaRecue, rectoDe } from './courrier'
import Rubrique from './Rubrique'
import styles from './Courrier.module.css'
import sacoche from './Sacoche.module.css'

/**
 * Une carte ouverte (maquette, écran 19), reçue ou envoyée : le dessin commun (`CartePostale.tsx`), son
 * mot signé de son expéditeur, son tampon à date, l'adresse **telle que servie**, et sous elle d'où et
 * quand elle est partie. Celle qu'on vient de poster dit que son tampon est frappé, et où elle part.
 */
function Ouverte({ ouverte, vientDePartir, onFermer }: { ouverte: CarteOuverte; vientDePartir: boolean; onFermer: () => void }) {
  const { carte } = ouverte
  return (
    <CartePostale titre={M.ouverte.titre} annee={carte.annee} mot={carte.mot} signe={carte.expediteur.pseudo} postee={carte} adresse={adresseDe(carte)} onFermer={onFermer}>
      {vientDePartir ? (
        <p className={styles.etat} role="status">
          {ceQueDitLaPostee(carte)}
        </p>
      ) : (
        <p className={styles.etat}>{ceQueDitLaCarte(ouverte)}</p>
      )}
    </CartePostale>
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
 * servie), **sans rien dire de leur lecture**, puis « À écrire » : une entrée par gare de `en_attente`,
 * et pour elles seules (brief 14 ; la carte à écrire : `CarteAEcrire.tsx`). Une boîte vide le dit. Un
 * `409` à l'envoi se dit ici, la carte refermée. Le dessin ne lit ni n'écrit rien :
 * `voyage/sacoche/Courrier.tsx` lui passe la boîte, la carte que l'adresse ouvre et les calques. Rien
 * n'y bouge.
 *
 * **Le focus d'une carte refermée ne se perd pas** : le dialogue le rend au bouton qui l'a ouverte
 * (`useDialogue`), mais l'entrée « À écrire » d'une carte postée n'existe plus. Le focus resté sans
 * élément revient alors au titre de la rubrique.
 */
export default function CourrierDeLaSacoche({ panne, recues, envoyees, ouverte, ouvrir, fermer, enAttente, aEcrire, vientDePartir, refus, ecrire }: PropsCourrierDeLaSacoche) {
  const vide = recues !== null && envoyees !== null && recues.length + envoyees.length === 0
  const titre = useRef<HTMLElement | null>(null)
  const carteOuverte = ouverte !== null || aEcrire !== null
  const etaitOuverte = useRef(false)
  // Après le nettoyage du dialogue, qui a rendu le focus à son bouton s'il existe encore.
  useEffect(() => {
    if (etaitOuverte.current && !carteOuverte && document.activeElement === document.body) titre.current?.focus()
    etaitOuverte.current = carteOuverte
  }, [carteOuverte])
  return (
    <>
      <Rubrique cible={titre}>
        {M.titre} <small>{M.sous}</small>
      </Rubrique>
      {panne ? (
        <div className={sacoche.panne}>
          <Panne erreur={panne.erreur} onReessayer={panne.reessayer} />
        </div>
      ) : (
        <>
          {vide ? <p className={sacoche.vide}>{M.vide}</p> : null}
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
          {enAttente && enAttente.length > 0 ? (
            <>
              <p className={styles.sens}>{M.aEcrire}</p>
              <ul className={styles.courrier} aria-label={M.aEcrire}>
                {enAttente.map((annee) => (
                  <li key={annee}>
                    <button type="button" className={styles.blanche} aria-haspopup="dialog" onClick={() => ecrire(annee)}>
                      {carteAEcrireDe(annee)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {refus ? (
            <p className={styles.refus} role="status">
              {refus}
            </p>
          ) : null}
        </>
      )}
      {ouverte ? <Ouverte ouverte={ouverte} vientDePartir={vientDePartir} onFermer={fermer} /> : aEcrire ? <CarteAEcrire key={aEcrire.annee} carte={aEcrire} onFermer={fermer} /> : null}
    </>
  )
}

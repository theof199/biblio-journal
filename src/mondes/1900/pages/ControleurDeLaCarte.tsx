import type { CSSProperties } from 'react'
import { formatDateVisionnage } from '../../../ui/format'
import { useMouvementReduit } from '../../../ui/mouvement'
import { numeroLisible } from '../../../voyage/billets'
import type { PropsControleurDeLaCarte } from '../../../voyage/controleur/Controleur'
import Carton from './Carton'
import { MOTS_DU_COMPOSTEUR as C, datePressee } from './carton'
import { MOTS_DU_CONTROLEUR as M, bulleDuControleur, ceQuiSePasse, ligneDuBilletDemande } from './controleur'
import DessinDuControleur from './DessinDuControleur'
import styles from './Controleur.module.css'

/** Le poinçon doré (maquette : `.poincon-or`) : un cercle perlé et une étoile percée. Ses couleurs sont sa donnée. */
function PoinconDore() {
  return (
    <svg viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
      <circle r="8.6" fill="none" stroke="#e2b23c" strokeWidth="1.5" />
      <circle r="6.6" fill="none" stroke="#f0d27a" strokeWidth=".6" strokeDasharray="1 1.2" />
      <path d="M0 -5.4 l1.5 3.4 3.7 .4 -2.8 2.5 .8 3.7 -3.2 -1.9 -3.2 1.9 .8 -3.7 -2.8 -2.5 3.7 -.4 Z" fill="#0e0a07" stroke="#e2b23c" strokeWidth=".9" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Le contrôleur des billets sur la carte de 1900 (maquette « Voyage immobile 1900 », `#controle`) : il
 * entre par la droite, la main tendue ; sa bulle dit ce qu'il dit, le billet demandé est le carton
 * Edmondson de mon dernier film quand le journal l'a montré, et dessous ce qui se passe, puis les
 * deux réponses, ou « Refermer la portière » une fois qu'il a répondu. Présenté, le poinçon doré se
 * perce sur le carton : posé par-dessus, `Carton` ne le porte pas (le casier le lui donnera, brief 8).
 *
 * Un dialogue, par-dessus la carte qui reste derrière, assombrie : ni photographie ni autre décor.
 * La carte ne pose pas les jetons des pages : il les pose lui-même (le tempo, lui, vient de l'écran de
 * la carte). Il ne lit ni n'écrit rien, et rien n'y bouge au calme (`data-vivante`).
 */
export default function ControleurDeLaCarte({ monde, billet, etat, panne, premier, presenter, refuser, fermer }: PropsControleurDeLaCarte) {
  const calme = useMouvementReduit()
  const { jetons, mots } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const date = billet ? formatDateVisionnage(billet.item.entry.finished_at) : null
  return (
    <div className={styles.controle} style={style} role="dialog" aria-modal="true" aria-label={M.nom} data-vivante={calme ? 'non' : 'oui'} data-etat={etat}>
      <div className={styles.personnage}>
        <DessinDuControleur />
      </div>
      <p className={styles.bulle} aria-live="polite">
        <b>{M.nom}</b> <span>{bulleDuControleur(etat)}</span>
      </p>
      {billet && date ? (
        <div className={styles.billet}>
          <Carton
            tete={C.compagnie}
            titre={billet.item.media.title}
            sous={ligneDuBilletDemande(billet.item.media.director, billet.item.media.year)}
            numero={billet.numero !== null ? numeroLisible(billet.numero) : undefined}
            note={billet.item.entry.rating}
            presse={datePressee(billet.item.entry.finished_at)}
            tampon={{ mot: mots.billet.tampon, dit: `${mots.billet.tampon} : ${mots.billet.tamponAutour} ${date}` }}
          />
          {etat === 'presente' ? (
            <span className={styles.poincon}>
              <PoinconDore />
            </span>
          ) : null}
        </div>
      ) : null}
      <p className={styles.etat} role="status">
        {ceQuiSePasse(etat, billet?.numero ?? null)}
      </p>
      {panne ? (
        <p className={styles.panne} role="alert">
          {panne}
        </p>
      ) : null}
      {/* Deux clés : « Refermer la portière » est un autre bouton que « Présenter le billet », qui
          reprend le focus par `premier` au lieu d'en hériter sans être annoncé. */}
      {etat === 'demande' ? (
        <div key="reponses" className={styles.choix}>
          <button ref={premier} type="button" className={styles.plein} onClick={presenter}>
            {M.presenter}
          </button>
          <button type="button" onClick={refuser}>
            {M.refuser}
          </button>
        </div>
      ) : (
        <div key="fin" className={styles.choix}>
          <button ref={premier} type="button" className={styles.seul} onClick={fermer}>
            {M.refermer}
          </button>
        </div>
      )}
    </div>
  )
}

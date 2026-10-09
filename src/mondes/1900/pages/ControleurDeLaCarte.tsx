import { useEffect, useState, type CSSProperties } from 'react'
import { formatDateVisionnage } from '../../../ui/format'
import { useMouvementReduit } from '../../../ui/mouvement'
import { numeroLisible } from '../../../voyage/billets'
import { GARDE_DU_CHOIX } from '../../../voyage/celebrations/deroule'
import type { PropsControleurDeLaCarte } from '../../../voyage/controleur/Controleur'
import Carton from './Carton'
import { MOTS_DU_COMPOSTEUR as C, datePressee } from './carton'
import { MOTS_DU_CONTROLEUR as M, bulleDuControleur, ceQuiSePasse, ligneDuBilletDemande } from './controleur'
import { imageDu1900 } from '../images'
import DessinDuControleur from './DessinDuControleur'
import styles from './Controleur.module.css'

/**
 * Le contrôleur des billets sur la carte de 1900 (maquette « Voyage immobile 1900 », `#controle`) : il
 * entre par la droite, la main tendue ; sa bulle dit ce qu'il dit, le billet demandé est le carton
 * Edmondson de mon dernier film quand le journal l'a montré, et dessous ce qui se passe, puis les
 * deux réponses, ou « Refermer la portière » une fois qu'il a répondu. Présenté, le poinçon doré se
 * perce sur le carton : `Carton` le porte, le même qu'au casier, ici frais (il luit et se perce).
 *
 * Un dialogue qui prend tout l'écran de la carte : derrière lui, la photographie du compartiment
 * (maquette : `.controle`, `--i-interieur` ; ici `interieur` de `assets/`, celle que la carte montre
 * déjà à la montée), sous un voile et la lueur d'une lampe, sur un fond plein. Rien de la carte ne
 * transparaît : son bandeau d'objectif ne se lit plus sous la bulle. Sans l'image, le voile reste.
 * La carte ne pose pas les jetons des pages : il les pose lui-même (le tempo, lui, vient de l'écran de
 * la carte). Il ne lit ni n'écrit rien, et rien n'y bouge au calme (`data-vivante`).
 *
 * « Refermer la portière » prend la place exacte des deux réponses : hors du calme, il reste inerte
 * un instant après la réponse (`GARDE_DU_CHOIX`, la garde du choix de l'année bouclée), pour qu'un
 * second toucher arrivé au même endroit ne referme pas avant qu'on ait lu. Échap, lui, referme toujours.
 */
export default function ControleurDeLaCarte({ monde, billet, etat, panne, premier, presenter, refuser, fermer }: PropsControleurDeLaCarte) {
  const calme = useMouvementReduit()
  const { jetons, mots } = monde.pages
  // Les jetons ne sont que des variables : `CSSProperties` seul les refuserait (aucune propriété connue).
  const style: CSSProperties & typeof jetons = { ...jetons }
  const photo = imageDu1900('interieur')
  const date = billet ? formatDateVisionnage(billet.item.entry.finished_at) : null
  const repondu = etat !== 'demande'
  const [arme, setArme] = useState(calme)
  useEffect(() => {
    if (!repondu || arme) return
    const j = setTimeout(() => setArme(true), GARDE_DU_CHOIX)
    return () => clearTimeout(j)
  }, [repondu, arme])
  return (
    <div className={styles.controle} style={style} role="dialog" aria-modal="true" aria-label={M.nom} data-vivante={calme ? 'non' : 'oui'} data-etat={etat}>
      <div className={styles.photo} style={photo ? { backgroundImage: `url(${photo})` } : undefined} aria-hidden="true" />
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
            poincon={etat === 'presente' ? { dit: C.poincon, frais: true } : null}
          />
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
          <button ref={premier} type="button" className={styles.seul} aria-disabled={!arme} onClick={() => void (arme && fermer())}>
            {M.refermer}
          </button>
        </div>
      )}
    </div>
  )
}

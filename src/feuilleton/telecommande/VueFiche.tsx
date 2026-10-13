import { useId, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconChevronUp, IconStack2 } from '@tabler/icons-react'
import type { EpisodeDeSaison, FicheDeSerie, SaisonDeFiche } from '../../api/feuilleton'
import Affiche from '../../ui/Affiche'
import Attente, { Barre } from '../../ui/Attente'
import { jourAParis, jourEnLettres, useLaFiche, useLesEpisodes } from './donnees'
import { useEcrituresDeLaFiche, type EcrituresDeLaFiche } from './fiche'
import MessageDuVu from './MessageDuVu'
import { Panne } from './VueTelecommande'
import { messageDe } from './vivante'
import styles from './Panneau.module.css'

/** L'état de diffusion, tel que TMDB le nomme (`metadata.status`), en clair. Un statut inconnu ne se dit pas. */
const DIFFUSIONS: Record<string, string> = {
  'Returning Series': 'En cours de diffusion',
  Ended: 'Terminée',
  Canceled: 'Annulée',
  'In Production': 'En production',
  Planned: 'Annoncée',
  Pilot: 'Pilote',
}

const FANTOMES = 3

export const nomDeLaSaison = (saison: Pick<SaisonDeFiche, 'number'>) => (saison.number === 0 ? 'Épisodes spéciaux' : `Saison ${saison.number}`)

/** La dernière saison d'abord, comme la maquette ; la saison 0, « Épisodes spéciaux », en dernier. */
export function rangerLesSaisons(saisons: SaisonDeFiche[]): SaisonDeFiche[] {
  const ordinaires = saisons.filter((saison) => saison.number !== 0).sort((a, b) => b.number - a.number)
  return [...ordinaires, ...saisons.filter((saison) => saison.number === 0)]
}

/** Pas encore diffusé : une date connue, et à venir à Paris. Sans date, l'épisode est tenu pour diffusé, comme côté API. */
const aVenir = (episode: EpisodeDeSaison, aujourdHui: string) => episode.air_date != null && episode.air_date > aujourdHui

/**
 * La fiche d'une série (`?telecommande=fiche-<identifiant>`) : l'en-tête, le synopsis, les saisons
 * dépliables et leurs épisodes, cochables et décochables un par un. Elle lit `GET /media/{id}` à son
 * ouverture, et les épisodes d'une saison à son dépliage ; ses écritures sont dans `fiche.ts`.
 */
export default function VueFiche({ serieId }: { serieId: string }) {
  const fiche = useLaFiche(serieId)
  const ecritures = useEcrituresDeLaFiche(serieId)
  const [bascules, setBascules] = useState<Record<string, boolean>>({})
  // La saison du prochain épisode est dépliée d'abord : celle de la première lecture. Une relecture qui
  // change de prochain ne replie pas la saison qu'on est en train de cocher.
  const dAbord = useRef<string | null | undefined>(undefined)

  if (fiche.isPending) {
    return (
      <div className={styles.ecran} data-piece="ecran" data-etat="attente">
        <Attente libelle="La fiche arrive…" className={styles.fantome}>
          <div className={`${styles.sujet} ${styles.grand}`}>
            <Affiche src={null} titre="" className={styles.afficheDeFiche} />
            <div className={styles.infos}>
              <Barre largeur="longue" />
              <Barre largeur="moyenne" />
              <Barre largeur="courte" />
            </div>
          </div>
        </Attente>
      </div>
    )
  }
  // La panne ne se dit que sans données : une relecture ratée (`isError`, avec les données d'avant) laisse la fiche lisible.
  if (!fiche.data) return <Panne message={messageDe(fiche.error)} onReessayer={() => void fiche.refetch()} />

  const serie: FicheDeSerie = fiche.data
  const prochain = serie.next_up?.kind === 'episode' ? serie.next_up : null
  if (dAbord.current === undefined) dAbord.current = prochain?.season_id ?? null
  const saisons = rangerLesSaisons(serie.seasons ?? [])
  const combien = saisons.filter((saison) => saison.number !== 0).length
  const diffusion = serie.metadata.status ? DIFFUSIONS[serie.metadata.status] : undefined
  const aujourdHui = jourAParis(new Date())

  return (
    <>
      <div className={styles.ecran} data-piece="ecran" data-etat="fiche">
        <div className={`${styles.sujet} ${styles.grand}`}>
          <Affiche src={serie.cover_url} titre={serie.title} className={styles.afficheDeFiche} />
          <div className={styles.infos}>
            <h2 className={`${styles.titre} ${styles.entier} ${styles.deFiche}`}>{serie.title}</h2>
            <p className={styles.meta}>{[serie.year, combien > 0 ? `${combien} saison${combien > 1 ? 's' : ''}` : null].filter((mot) => mot != null).join(' · ')}</p>
            {diffusion ? <p className={styles.meta}>{diffusion}</p> : null}
          </div>
        </div>
      </div>

      {serie.summary ? <p className={styles.synopsis}>{serie.summary}</p> : null}

      {saisons.length > 0 ? (
        <ul className={`${styles.pile} ${styles.serree}`} aria-label="Saisons">
          {saisons.map((saison) => {
            const depliee = bascules[saison.id] ?? saison.id === dAbord.current
            return (
              <Saison
                key={saison.id}
                serieId={serieId}
                saison={saison}
                depliee={depliee}
                onBasculer={() => setBascules((avant) => ({ ...avant, [saison.id]: !depliee }))}
                prochainId={prochain?.id ?? null}
                aujourdHui={aujourdHui}
                ecritures={ecritures}
              />
            )
          })}
        </ul>
      ) : (
        <p className={styles.phrase}>Cette série n’a pas encore de saison connue.</p>
      )}
    </>
  )
}

interface PropsSaison {
  serieId: string
  saison: SaisonDeFiche
  depliee: boolean
  onBasculer: () => void
  prochainId: string | null
  aujourdHui: string
  ecritures: EcrituresDeLaFiche
}

function Saison({ serieId, saison, depliee, onBasculer, prochainId, aujourdHui, ecritures }: PropsSaison) {
  const episodes = useLesEpisodes(serieId, saison.id, depliee)
  const id = useId()
  const nom = nomDeLaSaison(saison)
  const avis = ecritures.avis?.saisonId === saison.id ? ecritures.avis : null
  // « Toute la saison » ne s'offre que s'il reste du diffusé à cocher : d'après les épisodes lus, et d'après la progression en les attendant.
  const resteACocher = episodes.data ? episodes.data.some((episode) => !episode.watched.me && !aVenir(episode, aujourdHui)) : saison.progress.me.checked < saison.progress.me.total

  return (
    <li className={styles.saison} data-piece="ecran" data-etat="saison">
      <button type="button" className={styles.repli} aria-expanded={depliee} aria-controls={id} onClick={onBasculer}>
        <b className={styles.nomDeSaison}>{nom}</b>
        <span className={styles.avance}>
          {saison.progress.me.checked} sur {saison.progress.me.total}
        </span>
        {depliee ? <IconChevronUp aria-hidden="true" className={styles.icone} /> : <IconChevronDown aria-hidden="true" className={styles.icone} />}
      </button>

      <div id={id} className={styles.corpsDeSaison} hidden={!depliee}>
        {!depliee ? null : (
          <>
            {/* La portée ne coche que hors saison 0 : aux épisodes spéciaux, on coche un par un. */}
            {saison.number === 0 || (!avis && !resteACocher) ? null : (
              <div className={styles.rangee}>
                {avis ? (
                  <MessageDuVu key={avis.cle} texte={avis.texte} alerte={avis.alerte} onPartir={ecritures.onAvisParti} />
                ) : (
                  <button type="button" className={`${styles.touche} ${styles.large}`} data-piece="touche" aria-label={`Toute la saison : ${nom}`} onClick={() => ecritures.cocherLaSaison(saison.id)}>
                    <IconStack2 aria-hidden="true" className={styles.icone} />
                    Toute la saison
                  </button>
                )}
              </div>
            )}

            {episodes.isPending ? (
              <Attente libelle="Les épisodes arrivent…" className={styles.episodes}>
                {Array.from({ length: FANTOMES }, (_, rang) => (
                  <div key={rang} className={styles.ep}>
                    <Barre largeur="courte" />
                    <Barre largeur="longue" />
                  </div>
                ))}
              </Attente>
            ) : !episodes.data ? (
              <div className={styles.rate} role="alert">
                <p className={styles.panne}>{messageDe(episodes.error)}</p>
                <button type="button" className={styles.touche} data-piece="touche" onClick={() => void episodes.refetch()}>
                  Réessayer
                </button>
              </div>
            ) : (
              <ul className={styles.episodes} aria-label={`Épisodes : ${nom}`}>
                {episodes.data.map((episode) => {
                  const titre = episode.title ?? `Épisode ${episode.number}`
                  const vu = episode.watched.me
                  // Un épisode à venir n'a pas de case ; déjà coché (un suivi venu d'ailleurs), il la garde pour se décocher.
                  const sansCase = aVenir(episode, aujourdHui) && !vu
                  const leProchain = episode.id === prochainId && !vu
                  const echec = ecritures.echecs[episode.id]
                  return (
                    <li key={episode.id} className={styles.ep} data-prochain={leProchain ? '' : undefined}>
                      <span className={styles.code}>E{episode.number}</span>
                      <span className={styles.nomDEpisode}>
                        {titre}
                        {echec ? (
                          <small role="alert">{echec}</small>
                        ) : sansCase ? (
                          <small>Pas encore diffusé</small>
                        ) : leProchain ? (
                          <small>Le prochain</small>
                        ) : null}
                      </span>
                      {sansCase ? (
                        <span className={styles.date}>le {jourEnLettres(episode.air_date!)}</span>
                      ) : (
                        <button type="button" role="checkbox" aria-checked={vu} aria-label={`E${episode.number} · ${titre}`} className={styles.case} onClick={() => ecritures.cocher(saison.id, episode)}>
                          <span className={styles.coche}>{vu ? <IconCheck aria-hidden="true" className={styles.icone} /> : null}</span>
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  )
}

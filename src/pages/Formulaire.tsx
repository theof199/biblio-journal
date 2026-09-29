import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cles } from '../api/cles'
import { corrigerVisionnage, creerVisionnage, supprimerVisionnage } from '../api/journal'
import { basculerReaction, lireReactions } from '../api/reactions'
import { brouillonInitial, construirePatch } from '../formulaire/patch'
import Affiche from '../ui/Affiche'
import BoutonRetour from '../ui/BoutonRetour'
import { jourLocal, sousTitre } from '../ui/format'
import styles from './Formulaire.module.css'
import type { CandidatFilm } from '../formulaire/candidat'
import type { JournalItem } from '../api/journal'

interface EtatCreation {
  candidat: CandidatFilm
}
interface EtatCorrection {
  item: JournalItem
  /** La page qui avait ouvert la fiche, rendue à la fiche au retour (`Fiche.tsx`). */
  depuis?: string
  /**
   * Où revenir une fois la correction faite, à la place de l'accueil : le rapport d'import qui a
   * ouvert le formulaire (`ImportLetterboxd.tsx`) se retrouve ainsi, ses lignes tranchées comprises.
   */
  retour?: string
}

/**
 * Le film et sa remarque, en création (`/journal/nouveau`, depuis la recherche ou « Ensuite ») et
 * en correction (`/journal/:id/corriger`, depuis la fiche) — reprise de `FormScreen.kt`. L'état de
 * navigation porte le film ou l'entrée : sans lui (accès direct, rechargement de page), la page
 * renvoie vers la recherche ou l'accueil plutôt que de tenter un appel que l'API ne sait pas servir
 * (il n'existe pas de `GET /me/journal/{id}`).
 */
export default function Formulaire() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const naviguer = useNavigate()
  const client = useQueryClient()

  const correction = Boolean(id)
  const etatCorrection = correction ? (location.state as EtatCorrection | null) : null
  const item = etatCorrection?.item
  const candidat = !correction ? (location.state as EtatCreation | null)?.candidat : undefined

  const [brouillon, setBrouillon] = useState(() => brouillonInitial(item, candidat))
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  const reactions = useQuery({ queryKey: cles.reactions, queryFn: ({ signal }) => lireReactions(signal) })
  const catalogue = reactions.data?.reactions ?? []
  const ordre = catalogue.map((r) => r.cle)

  const apresEcriture = () => {
    // Par préfixe : `cles.journal` périme aussi `cles.seances` (« Tes séances », Au ciné), qui
    // commence par lui — le test « périme « Tes séances » » garde ce lien.
    void client.invalidateQueries({ queryKey: cles.journal })
    void client.invalidateQueries({ queryKey: cles.stats })
    void client.invalidateQueries({ queryKey: cles.voyage })
    // Un visionnage change le « vu » des filmographies et sagas suivies : sans ça, le carrousel
    // « Ensuite » reproposerait le film qu'on vient de journaliser.
    void client.invalidateQueries({ queryKey: cles.realisateurs })
    void client.invalidateQueries({ queryKey: cles.sagas })
    naviguer(etatCorrection?.retour ?? '/', { replace: true })
  }

  const creation = useMutation({
    mutationFn: (c: CandidatFilm) =>
      creerVisionnage(
        { source: c.source, external_id: c.external_id, type: 'movie' },
        {
          finished_at: brouillon.date,
          rating: brouillon.note,
          reactions: brouillon.reactions.length > 0 ? brouillon.reactions : undefined,
          comment: brouillon.remarque.trim() || undefined,
        },
      ),
    onSuccess: apresEcriture,
  })

  const correctionMutation = useMutation({
    mutationFn: (courant: JournalItem) => corrigerVisionnage(courant.entry.id, construirePatch(courant, brouillon)),
    onSuccess: apresEcriture,
  })

  const suppression = useMutation({
    mutationFn: (courant: JournalItem) => supprimerVisionnage(courant.entry.id),
    onSuccess: apresEcriture,
  })

  if (correction && !item) {
    return (
      <div className={styles.page}>
        <div className={styles.entete}>
          <BoutonRetour vers="/" />
        </div>
        <p>Ce visionnage n’est plus disponible. Repars de l’accueil.</p>
        <Link to="/">Retour à l’accueil</Link>
      </div>
    )
  }
  if (!correction && !candidat) {
    return (
      <div className={styles.page}>
        <div className={styles.entete}>
          <BoutonRetour vers="/recherche" />
        </div>
        <p>Aucun film choisi. Repars de la recherche.</p>
        <Link to="/recherche">Retour à la recherche</Link>
      </div>
    )
  }

  const titre = correction ? item!.media.title : candidat!.title
  const couverture = correction ? item!.media.cover_url : candidat!.cover_url
  const sous = correction ? sousTitre(item!.media.director, item!.media.year) : sousTitre(candidat!.director, candidat!.year)

  const mutation = correction ? correctionMutation : creation
  const erreur = mutation.error

  const enregistrer = () => {
    if (mutation.isPending) return
    suppression.reset()
    if (correction) correctionMutation.mutate(item!)
    else creation.mutate(candidat!)
  }

  return (
    <div className={styles.page}>
      <div className={styles.entete}>
        {/* La fiche vit de son état de navigation : sans l'entrée, elle répondrait « plus disponible ». */}
        <BoutonRetour
          vers={correction ? `/journal/${id}` : '/recherche'}
          etat={correction ? { item, depuis: etatCorrection?.depuis } : undefined}
        />
      </div>

      <div className={styles.film}>
        <Affiche src={couverture} titre={titre} taille="ligne" />
        <div className={styles.infosFilm}>
          <h1 className={styles.titreFilm}>{titre}</h1>
          {sous ? <p className={styles.sousTitreFilm}>{sous}</p> : null}
        </div>
      </div>

      <label className={styles.champ}>
        <span>Vu le</span>
        <input
          type="date"
          value={brouillon.date}
          max={jourLocal()}
          onChange={(event) => setBrouillon((b) => ({ ...b, date: event.target.value }))}
          className={styles.saisie}
        />
      </label>

      <div>
        <p className={styles.libelle}>Note</p>
        <div className={styles.notes} role="radiogroup" aria-label="Note sur 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={styles.pastille}
              role="radio"
              aria-checked={brouillon.note === n}
              aria-label={`Note ${n} sur 10`}
              onClick={() => setBrouillon((b) => ({ ...b, note: b.note === n ? null : n }))}
            >
              <span className={`${styles.rond} ${brouillon.note === n ? styles.rondActif : ''}`}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={styles.libelle}>Réactions</p>
        <div className={styles.puces}>
          {catalogue.map((r) => {
            const cochee = brouillon.reactions.includes(r.cle)
            return (
              <button
                key={r.cle}
                type="button"
                className={`${styles.puce} ${cochee ? styles.puceActive : ''}`}
                aria-pressed={cochee}
                onClick={() =>
                  setBrouillon((b) => ({ ...b, reactions: basculerReaction(b.reactions, r.cle, ordre) }))
                }
              >
                {`${r.emoji} ${r.phrase}`}
              </button>
            )
          })}
        </div>
      </div>

      <label className={styles.champ}>
        <span>Remarque</span>
        <textarea
          value={brouillon.remarque}
          onChange={(event) => setBrouillon((b) => ({ ...b, remarque: event.target.value }))}
          className={styles.remarque}
        />
        <span className={styles.aide}>Rien qu’à toi</span>
      </label>

      {erreur ? (
        <p role="alert" className={styles.erreur}>
          {erreur.message}
        </p>
      ) : null}

      <button type="button" onClick={enregistrer} disabled={mutation.isPending} className={styles.bouton}>
        {correction ? 'Corriger' : 'Enregistrer'}
      </button>

      {correction ? (
        confirmerSuppression ? (
          <div className={styles.confirmation}>
            <p>Supprimer ce visionnage ? Le commentaire et les réactions partent avec.</p>
            {suppression.error ? (
              <p role="alert" className={styles.erreur}>
                {suppression.error.message}
              </p>
            ) : null}
            <div className={styles.confirmationActions}>
              <button
                type="button"
                className={styles.boutonSecondaire}
                onClick={() => {
                  suppression.reset()
                  setConfirmerSuppression(false)
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.boutonDanger}
                onClick={() => {
                  correctionMutation.reset()
                  suppression.mutate(item!)
                }}
                disabled={suppression.isPending}
              >
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.boutonSupprimer} onClick={() => setConfirmerSuppression(true)}>
            Supprimer
          </button>
        )
      ) : null}
    </div>
  )
}

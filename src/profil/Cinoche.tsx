import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { cles } from '../api/cles'
import { delierCinoche, lireCinoche, relierCinoche } from '../api/cinoche'
import type { EtatCinoche } from '../api/cinoche'
// La même feuille que sa jumelle : les deux liaisons sont deux blocs du même ticket de caisse.
import styles from './SensCritique.module.css'

const notesEnAttente = (n: number) => (n === 1 ? '1 note en attente d’envoi' : `${n} notes en attente d’envoi`)

/**
 * La liaison Cinoche (étape 28 du guide du back), jumelle de `SensCritique.tsx` : c'est l'API qui
 * envoie chez Cinoche (https://cinoche.vercel.app) la note et la date de chaque film noté au
 * journal ; ici, le membre relie son compte, voit ce qui attend, et le délie. Pas d'appariement :
 * Cinoche se sert de l'identifiant TMDB.
 *
 * Tant que l'état n'a pas répondu, ou s'il échoue, rien ne s'affiche, titre compris : sans
 * `CINOCHE_CLE` sur le serveur les routes répondent `503 SERVICE_UNCONFIGURED`, et le guide
 * demande de masquer toute la section. Elle ne dépend pas de celle de SensCritique.
 */
export default function Cinoche() {
  const etat = useQuery({ queryKey: cles.cinoche, queryFn: ({ signal }) => lireCinoche(signal) })
  if (!etat.data) return null

  return (
    <>
      <h2 className={styles.titreSection}>Cinoche</h2>
      {etat.data.connecte ? <Liaison etat={etat.data} /> : <Connexion etat={etat.data} />}
    </>
  )
}

function Connexion({ etat }: { etat: EtatCinoche }) {
  const client = useQueryClient()
  const expiree = etat.session_expiree
  const [ouvert, setOuvert] = useState(false)
  // Session expirée : l'API a gardé l'e-mail du compte, il n'est pas à retaper.
  const [email, setEmail] = useState(expiree ? (etat.email ?? '') : '')
  const [motDePasse, setMotDePasse] = useState('')
  /** Les secondes de `Retry-After` : l'API compte cinq tentatives par quart d'heure, réussies comprises. */
  const [attente, setAttente] = useState<number | null>(null)
  const liaison = useMutation({
    mutationFn: relierCinoche,
    // Le mot de passe est dans les variables de la mutation : elle ne survit pas au formulaire.
    gcTime: 0,
    // La réponse est l'état : pas de relecture.
    onSuccess: (relie) => client.setQueryData(cles.cinoche, relie),
    onError: (erreur) => {
      if (erreur instanceof ApiError && erreur.retryAfterSeconds !== null) setAttente(erreur.retryAfterSeconds)
    },
  })

  useEffect(() => {
    if (attente === null) return
    const minuterie = setTimeout(() => setAttente(null), attente * 1000)
    return () => clearTimeout(minuterie)
  }, [attente])

  const fermer = () => {
    setOuvert(false)
    setMotDePasse('')
    liaison.reset()
  }

  const envoyer = (event: FormEvent) => {
    event.preventDefault()
    if (liaison.isPending || attente !== null) return
    liaison.mutate({ email, mot_de_passe: motDePasse })
  }

  // Cinoche a refusé la session : la liaison reste, la file continue de se remplir et repart à la reconnexion.
  const etatDeLaFile = expiree ? (
    <p role="status">
      Ta session Cinoche a expiré. Tes visionnages attendent en file : ils partiront à la reconnexion.
      {etat.envois_en_attente > 0 ? ` ${notesEnAttente(etat.envois_en_attente)}.` : null}
    </p>
  ) : etat.envois_en_attente > 0 ? (
    <p role="status">{notesEnAttente(etat.envois_en_attente)} : elles partiront une fois ton compte relié.</p>
  ) : null

  if (!ouvert) {
    return (
      <div className={styles.bloc}>
        {expiree && etat.email ? (
          <p className={styles.compte}>
            <span className={styles.entreeTitre}>Session expirée</span>
            <span className={styles.pointilles} aria-hidden="true" />
            <span className={styles.fleche}>{etat.email}</span>
          </p>
        ) : null}
        <button type="button" className={styles.entree} onClick={() => setOuvert(true)}>
          <span className={styles.entreeTitre}>{expiree ? 'Me reconnecter' : 'Relier mon compte'}</span>
          <span className={styles.pointilles} aria-hidden="true" />
          <span className={styles.fleche} aria-hidden="true">
            →
          </span>
          {expiree ? null : (
            <span className={styles.aide}>Chaque film que tu noteras au journal y partira tout seul, avec sa note et sa date</span>
          )}
        </button>
        {etatDeLaFile}
      </div>
    )
  }

  return (
    <form className={styles.bloc} onSubmit={envoyer}>
      {etatDeLaFile}
      {/* `autoComplete="off"` : le navigateur proposerait sinon les identifiants du Journal, qui ne sont pas ceux-là. */}
      <label className={styles.champ}>
        <span>E-mail du compte Cinoche</span>
        <input
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="off"
          className={styles.saisie}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
        />
      </label>
      <label className={styles.champ}>
        <span>Mot de passe Cinoche</span>
        <input
          type="password"
          autoComplete="off"
          className={styles.saisie}
          value={motDePasse}
          onChange={(event) => setMotDePasse(event.target.value)}
          maxLength={256}
          required
        />
      </label>
      <p className={styles.aide}>Le mot de passe ne sert qu’une fois, pour ouvrir la liaison : il n’est gardé nulle part.</p>
      <p className={styles.aide}>
        Compte Cinoche créé avec Google ? Il n’a pas de mot de passe : pose-en d’abord un dans ton profil Cinoche.
      </p>
      {/* Le message de l'API, tel quel : c'est lui qui distingue le refus des identifiants (422) de Cinoche qui ne répond pas (503). */}
      {liaison.error ? (
        <p role="alert" className={styles.erreur}>
          {liaison.error.message}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button type="submit" className={styles.action} disabled={liaison.isPending || attente !== null}>
          {liaison.isPending ? 'Liaison en cours…' : expiree ? 'Reconnecter' : 'Relier'}
        </button>
        <button type="button" className={styles.secondaire} onClick={fermer} disabled={liaison.isPending}>
          Annuler
        </button>
      </div>
    </form>
  )
}

function Liaison({ etat }: { etat: EtatCinoche }) {
  const client = useQueryClient()
  const [aConfirmer, setAConfirmer] = useState(false)
  const retrait = useMutation({
    mutationFn: delierCinoche,
    onSuccess: (delie) => client.setQueryData(cles.cinoche, delie),
  })

  return (
    <div className={styles.bloc}>
      <p className={styles.compte}>
        <span className={styles.entreeTitre}>Compte relié</span>
        <span className={styles.pointilles} aria-hidden="true" />
        <span className={styles.fleche}>{etat.email}</span>
      </p>
      {etat.envois_en_attente > 0 ? <p>{notesEnAttente(etat.envois_en_attente)}</p> : null}
      {retrait.error ? (
        <p role="alert" className={styles.erreur}>
          {retrait.error.message}
        </p>
      ) : null}
      {aConfirmer ? (
        <>
          {/* Une confirmation dans la page, jamais `confirm()` : le `DELETE` efface aussi la file. */}
          <p className={styles.aide}>
            Les notes en attente ne partiront plus. Ton journal ne change pas ; ce qui est déjà chez Cinoche y reste.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.action} disabled={retrait.isPending} onClick={() => retrait.mutate()}>
              {retrait.isPending ? 'Retrait en cours…' : 'Délier'}
            </button>
            <button type="button" className={styles.secondaire} disabled={retrait.isPending} onClick={() => setAConfirmer(false)}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <button type="button" className={styles.secondaire} onClick={() => setAConfirmer(true)}>
          Délier mon compte
        </button>
      )}
    </div>
  )
}

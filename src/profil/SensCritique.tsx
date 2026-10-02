import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { cles } from '../api/cles'
import { delierSensCritique, lireSensCritique, relierSensCritique } from '../api/senscritique'
import type { EtatSensCritique } from '../api/senscritique'
import styles from './SensCritique.module.css'

const notesEnAttente = (n: number) => (n === 1 ? '1 note en attente d’envoi' : `${n} notes en attente d’envoi`)
const filmsAApparier = (n: number) => (n === 1 ? '1 film à apparier' : `${n} films à apparier`)

/**
 * La liaison SensCritique (étape 25 du guide du back) : c'est l'API qui envoie chez SensCritique la
 * note et la date de chaque film noté au journal ; ici, le membre relie son compte, voit ce qui
 * attend, passe aux films à apparier (`pages/AppariementSensCritique.tsx`), et le délie.
 *
 * Tant que l'état n'a pas répondu, ou s'il échoue, rien ne s'affiche, titre compris : sans
 * `SENSCRITIQUE_CLE` sur le serveur les routes répondent `503 SERVICE_UNCONFIGURED`, et le guide
 * demande de masquer toute la section.
 */
export default function SensCritique() {
  const etat = useQuery({ queryKey: cles.senscritique, queryFn: ({ signal }) => lireSensCritique(signal) })
  if (!etat.data) return null

  return (
    <>
      <h2 className={styles.titreSection}>SensCritique</h2>
      {etat.data.connecte ? <Liaison etat={etat.data} /> : <Connexion etat={etat.data} />}
    </>
  )
}

function Connexion({ etat }: { etat: EtatSensCritique }) {
  const client = useQueryClient()
  const expiree = etat.session_expiree
  const [ouvert, setOuvert] = useState(false)
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  /** Les secondes de `Retry-After` : l'API compte cinq tentatives par quart d'heure, réussies comprises. */
  const [attente, setAttente] = useState<number | null>(null)
  const liaison = useMutation({
    mutationFn: relierSensCritique,
    // Le mot de passe est dans les variables de la mutation : elle ne survit pas au formulaire.
    gcTime: 0,
    // La réponse est l'état : pas de relecture.
    onSuccess: (relie) => client.setQueryData(cles.senscritique, relie),
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
    liaison.mutate({ identifiant, mot_de_passe: motDePasse })
  }

  // Non relié, mais des notes attendent : SensCritique a refusé la session, la file repart à la reconnexion.
  const enAttente = expiree ? (
    // Session expirée (étape 28 du guide du back) : la liaison et le pseudo restent, la file se remplit encore.
    <p role="status">
      Ta session SensCritique a expiré. Tes visionnages attendent en file : ils partiront à la reconnexion.
      {etat.envois_en_attente > 0 ? ` ${notesEnAttente(etat.envois_en_attente)}.` : null}
    </p>
  ) : etat.envois_en_attente > 0 ? (
    <p role="status">{notesEnAttente(etat.envois_en_attente)} : elles partiront une fois ton compte relié.</p>
  ) : null

  if (!ouvert) {
    return (
      <div className={styles.bloc}>
        {expiree && etat.pseudo ? (
          <p className={styles.compte}>
            <span className={styles.entreeTitre}>Session expirée</span>
            <span className={styles.pointilles} aria-hidden="true" />
            <span className={styles.fleche}>{etat.pseudo}</span>
          </p>
        ) : null}
        <button type="button" className={styles.entree} onClick={() => setOuvert(true)}>
          <span className={styles.entreeTitre}>{expiree ? 'Me reconnecter' : 'Relier mon compte'}</span>
          <span className={styles.pointilles} aria-hidden="true" />
          <span className={styles.fleche} aria-hidden="true">
            →
          </span>
          {expiree ? null : <span className={styles.aide}>Chaque film noté au journal y part tout seul, avec sa note et sa date</span>}
        </button>
        {enAttente}
        {/* Session expirée, ou file héritée d'une liaison effacée par l'ancien code : sans reconnexion possible, délier arrête la file. */}
        {expiree || etat.envois_en_attente > 0 || etat.a_apparier > 0 ? <Retrait /> : null}
      </div>
    )
  }

  return (
    <form className={styles.bloc} onSubmit={envoyer}>
      {enAttente}
      {/* `autoComplete="off"` : le navigateur proposerait sinon les identifiants du Journal, qui ne sont pas ceux-là. */}
      <label className={styles.champ}>
        <span>Identifiant SensCritique (adresse e-mail)</span>
        <input
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="off"
          className={styles.saisie}
          value={identifiant}
          onChange={(event) => setIdentifiant(event.target.value)}
          maxLength={254}
          required
        />
      </label>
      <label className={styles.champ}>
        <span>Mot de passe SensCritique</span>
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

function Liaison({ etat }: { etat: EtatSensCritique }) {
  return (
    <div className={styles.bloc}>
      <p className={styles.compte}>
        <span className={styles.entreeTitre}>Compte relié</span>
        <span className={styles.pointilles} aria-hidden="true" />
        <span className={styles.fleche}>{etat.pseudo}</span>
      </p>
      {etat.a_apparier > 0 ? (
        <Link to="/profil/senscritique" className={styles.entree}>
          <span className={styles.entreeTitre}>{filmsAApparier(etat.a_apparier)}</span>
          <span className={styles.pointilles} aria-hidden="true" />
          <span className={styles.fleche} aria-hidden="true">
            →
          </span>
        </Link>
      ) : null}
      {etat.envois_en_attente > 0 ? <p>{notesEnAttente(etat.envois_en_attente)}</p> : null}
      <Retrait />
    </div>
  )
}

/** « Délier mon compte » et sa confirmation : dans l'état relié, et quand la session a expiré (le `DELETE` y est permis). */
function Retrait() {
  const client = useQueryClient()
  const [aConfirmer, setAConfirmer] = useState(false)
  const retrait = useMutation({
    mutationFn: delierSensCritique,
    onSuccess: (delie) => {
      client.setQueryData(cles.senscritique, delie)
      // Le `DELETE` efface aussi les films à apparier : la liste gardée en cache n'existe plus.
      client.removeQueries({ queryKey: cles.senscritiqueAApparier })
    },
  })

  return (
    <>
      {retrait.error ? (
        <p role="alert" className={styles.erreur}>
          {retrait.error.message}
        </p>
      ) : null}
      {aConfirmer ? (
        <>
          {/* Une confirmation dans la page, jamais `confirm()` : le `DELETE` efface aussi la file et les choix mémorisés. */}
          <p className={styles.aide}>
            Les notes en attente ne partiront plus, et tes choix de films sont oubliés. Ton journal ne change pas ; ce qui est
            déjà chez SensCritique y reste.
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
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconSearch, IconX } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { ajouterUneSerie, type SerieTrouvee } from '../../api/feuilleton'
import { useValeurDebouncee } from '../../recherche/useValeurDebouncee'
import Affiche from '../../ui/Affiche'
import Attente, { Barre } from '../../ui/Attente'
import { useLaRecherche } from './donnees'
import { Panne } from './VueTelecommande'
import { messageDe } from './vivante'
import styles from './Panneau.module.css'

export interface PropsVueAjouter {
  /** Les séries que la télécommande porte déjà, en cours ou en pause (`media_id`) : « déjà suivie ». */
  suivies: ReadonlySet<string>
  /** La série est ajoutée et la télécommande relue : `serieId` est son `media_id`. */
  onAjoutee: (serieId: string) => void
}

const FANTOMES = 4
const nomDe = (resultat: SerieTrouvee) => (resultat.year ? `${resultat.title} (${resultat.year})` : resultat.title)

/**
 * Ajouter une série (`?telecommande=ajouter`) : un champ, à la frappe retardée (une requête par pause de
 * saisie), `GET /search?type=tv`. Un résultat que la télécommande porte dit « déjà suivie » ; tout autre
 * offre « Ajouter », **série finie ou déjà en bibliothèque comprise** : l'ajout est idempotent côté API
 * (`200`, rien d'un suivi commencé n'est écrasé), il n'y a donc rien à garder ici.
 *
 * « Ajouter » : un seul `POST /media`, qui peut durer (une requête TMDB par saison) : la touche le dit et
 * se verrouille, **résultat par résultat**. Au succès la télécommande est relue, puis `onAjoutee`.
 */
export default function VueAjouter({ suivies, onAjoutee }: PropsVueAjouter) {
  const client = useQueryClient()
  const [saisie, setSaisie] = useState('')
  const tape = saisie.trim()
  const terme = useValeurDebouncee(tape)
  const recherche = useLaRecherche(terme)
  const champ = useRef<HTMLInputElement>(null)

  const verrous = useRef(new Set<string>())
  const [enAjout, setEnAjout] = useState<ReadonlySet<string>>(new Set())
  const [echecs, setEchecs] = useState<Record<string, string>>({})
  const monte = useRef(true)
  useEffect(() => {
    monte.current = true
    return () => {
      monte.current = false
    }
  }, [])
  const ajout = useMutation({
    mutationFn: (resultat: SerieTrouvee) => ajouterUneSerie(resultat.external_id),
    // La télécommande est relue avant de rendre la main : la série ajoutée y est quand on s'y règle.
    onSuccess: () => client.invalidateQueries({ queryKey: cles.telecommande }),
  })

  const ajouter = (resultat: SerieTrouvee) => {
    const cle = resultat.external_id
    if (verrous.current.has(cle)) return
    verrous.current.add(cle)
    setEnAjout((avant) => new Set(avant).add(cle))
    setEchecs(({ [cle]: _oublie, ...autres }) => autres)
    // `mutateAsync` : chaque ajout a sa promesse, même quand un autre part entre-temps.
    ajout
      .mutateAsync(resultat)
      .then((reponse) => {
        if (monte.current) onAjoutee(reponse.media.id)
      })
      .catch((erreur: unknown) => {
        if (monte.current) setEchecs((avant) => ({ ...avant, [cle]: messageDe(erreur) }))
      })
      .finally(() => {
        verrous.current.delete(cle)
        if (monte.current) setEnAjout((avant) => new Set([...avant].filter((autre) => autre !== cle)))
      })
  }

  const enAttente = tape.length > 0 && (tape !== terme || recherche.isPending)
  const resultats = recherche.data ?? []

  return (
    <>
      <h2 className={styles.titreVue}>Ajouter une série</h2>

      <label className={styles.champ} data-piece="champ">
        <IconSearch aria-hidden="true" className={styles.icone} />
        <input ref={champ} type="search" className={styles.saisie} aria-label="Chercher une série" autoComplete="off" enterKeyHint="search" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
        {saisie ? (
          <button
            type="button"
            className={styles.case}
            aria-label="Effacer"
            onClick={() => {
              setSaisie('')
              champ.current?.focus()
            }}
          >
            <IconX aria-hidden="true" className={styles.icone} />
          </button>
        ) : null}
      </label>

      {tape.length === 0 ? (
        <p className={styles.phrase}>Tape le titre d’une série : ajoutée, elle entre dans « En cours ».</p>
      ) : enAttente ? (
        <Attente libelle="La recherche est en cours…" className={`${styles.pile} ${styles.serree}`}>
          {Array.from({ length: FANTOMES }, (_, rang) => (
            <div key={rang} className={styles.resultat} data-piece="ecran" data-etat="attente">
              <Affiche src={null} titre="" taille="ligne" />
              <div className={styles.infos}>
                <Barre largeur="longue" />
                <Barre largeur="courte" />
              </div>
            </div>
          ))}
        </Attente>
      ) : recherche.isError ? (
        <Panne
          titre={recherche.error instanceof ApiError && recherche.error.isSearchUnavailable ? 'Recherche indisponible' : undefined}
          message={messageDe(recherche.error)}
          onReessayer={() => void recherche.refetch()}
        />
      ) : resultats.length === 0 ? (
        <div className={styles.rien} role="status">
          <h3 className={`${styles.titre} ${styles.entier}`}>Aucune série à ce nom</h3>
          <p className={styles.doux}>Essaie un autre titre, ou son titre d’origine.</p>
        </div>
      ) : (
        <ul className={`${styles.pile} ${styles.serree}`} aria-label="Résultats">
          {resultats.map((resultat) => {
            const cle = resultat.external_id
            const deja = resultat.media_id != null && suivies.has(resultat.media_id)
            const part = enAjout.has(cle)
            const echec = echecs[cle]
            return (
              <li key={cle} className={styles.resultat} data-piece="ecran" data-etat="resultat">
                <Affiche src={resultat.cover_url} titre={resultat.title} taille="ligne" chargement="lazy" />
                <div className={styles.infos}>
                  <h3 className={styles.titre}>{resultat.title}</h3>
                  {resultat.year ? <p className={styles.meta}>{resultat.year}</p> : null}
                </div>
                {deja ? (
                  <span className={styles.deja}>
                    <IconCheck aria-hidden="true" className={styles.icone} />
                    déjà suivie
                  </span>
                ) : (
                  <button type="button" className={`${styles.touche} ${styles.principale}`} data-piece="touche-principale" aria-label={`Ajouter ${nomDe(resultat)}`} aria-busy={part} disabled={part} onClick={() => ajouter(resultat)}>
                    {part ? 'Ajout…' : 'Ajouter'}
                  </button>
                )}
                {echec ? (
                  <p className={styles.echec} role="alert">
                    {echec}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

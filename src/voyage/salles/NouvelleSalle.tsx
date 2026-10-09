import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cles } from '../../api/cles'
import { ApiError } from '../../api/client'
import { ouvrirUneSalle, refusVu, renouvelerLesPistes, type DemandeSalle, type FicheAnnee, type FichePrete, type Piste } from '../../api/voyage'
import type { Monde } from '../../mondes/types'
import { useCalque } from '../calque'
import Feuillet from '../Feuillet'
import { gabaritDe } from '../gabarit'
import { RELECTURES } from '../relecture'
import { autresPistes, brouillonSuivant, pistesApresUsage, zoneNouvelleSalle, type Brouillon } from '../salles'
import TenteALouer from './TenteALouer'
import { useGuet } from './useFournee'
import styles from './NouvelleSalle.module.css'

/** La longueur d'une demande (`POST …/salles`, `demande` : 1 à 200 caractères). */
export const DEMANDE_MAX = 200

/**
 * Les refus déjà marqués vus, le temps de l'app : la page qui se démonte (un film, puis le retour)
 * perdrait un `useRef`, et le cache montre encore le refus jusqu'à la relecture.
 */
const REFUS_MARQUES = new Set<string>()

const messageDe = (e: unknown, repli: string) => (e instanceof ApiError ? e.message : repli)

/** La fiche prête en cache, retouchée sans attendre la relecture. */
function majFiche(client: ReturnType<typeof useQueryClient>, annee: number, maj: (f: FichePrete) => FichePrete) {
  client.setQueryData<FicheAnnee>(cles.annee(annee), (f) => (f && 'statut' in f && f.statut === 'prete' ? maj(f) : f))
}

interface Props {
  monde: Monde
  annee: number
  pistes: readonly Piste[]
  demande: DemandeSalle | null
}

/**
 * « Ouvrir une nouvelle salle » (portée de `BlocNouvelleSalle`, `AnneeScreen.kt`), au compte IA
 * seulement : la zone (le bouton, la salle qui s'écrit ou le refus), puis le feuillet « Quelle salle ? ».
 *
 * Le dessin de la zone est une section que le monde peut composer (`gabarits.nouvelleSalle`, par défaut
 * `TenteALouer`). Ce qui lit ou écrit reste ici : le calque `nouvelle-salle` de l'adresse, le guet de la
 * salle qui s'écrit (la fiche relue toutes les cinq secondes), le refus marqué vu une fois par demande,
 * et le feuillet avec son formulaire et ses deux écritures.
 */
export default function NouvelleSalle({ monde, annee, pistes, demande }: Props) {
  const client = useQueryClient()
  const feuillet = useCalque('nouvelle-salle')
  const zone = zoneNouvelleSalle(demande)
  const guet = useGuet(annee, zone === 'fantome', RELECTURES.salle)

  // Un refus se marque vu dès qu'il s'affiche, une fois par demande : ni une relecture, ni la page
  // rouverte avant que la relecture n'ait effacé le refus (le cache le montre encore) ne le remarquent.
  const refusee = zone === 'refus' ? demande?.id : undefined
  useEffect(() => {
    if (!refusee || REFUS_MARQUES.has(refusee)) return
    REFUS_MARQUES.add(refusee)
    void refusVu(refusee).catch(() => undefined)
  }, [refusee])

  const Zone = gabaritDe(monde, 'nouvelleSalle', TenteALouer)

  return (
    <>
      <Zone monde={monde} annee={annee} zone={zone} demande={demande} abandon={guet.abandon} onOuvrir={() => feuillet.ouvrir('ouverte')} onReessayer={guet.reessayer} />

      {feuillet.valeur !== null && zone !== 'fantome' ? (
        <Feuillet monde={monde} titre="Quelle salle ?" onFermer={feuillet.fermer}>
          <Formulaire
            annee={annee}
            pistes={pistes}
            onDemandee={(texte, piste, id) =>
              majFiche(client, annee, (f) => ({
                ...f,
                pistes: pistesApresUsage(f.pistes, piste),
                demande_salle: { id, demande: texte, statut: 'en_cours', motif: null, salle_id: null },
              }))
            }
            onFermer={feuillet.fermer}
            onPistes={(nouvelles) => majFiche(client, annee, (f) => ({ ...f, pistes: nouvelles }))}
          />
        </Feuillet>
      ) : null}
    </>
  )
}

interface PropsFormulaire {
  annee: number
  pistes: readonly Piste[]
  onDemandee: (texte: string, piste: string | null, id: string) => void
  onPistes: (pistes: Piste[]) => void
  onFermer: () => void
}

/**
 * La feuille « Quelle salle ? » (portée de `NouvelleSalleSheet`) : une pastille par piste, qui
 * remplit le champ et reste retenue même si le texte change ensuite (`brouillonSuivant`) ; sans
 * aucune piste, « D’autres pistes » (synchrone) ; « Demander » envoie la piste touchée. Chaque
 * écriture est gardée contre le double toucher.
 */
function Formulaire({ annee, pistes, onDemandee, onPistes, onFermer }: PropsFormulaire) {
  const [brouillon, setBrouillon] = useState<Brouillon>({ texte: '', piste: null })
  const touchee = pistes.find((p) => p.nom === brouillon.piste)

  const envoi = useRef(false)
  const demander = useMutation({
    mutationFn: (b: Brouillon) => ouvrirUneSalle(annee, { demande: b.texte.trim(), ...(b.piste !== null ? { piste: b.piste } : {}) }),
    // La fiche en cache se marque toujours, même feuillet refermé pendant l'envoi.
    onSuccess: (r, b) => onDemandee(b.texte.trim(), b.piste, r.demande_id),
  })
  const soumettre = () => {
    if (envoi.current || brouillon.texte.trim() === '') return
    envoi.current = true
    // Le feuillet ne se referme que s'il est encore là : les rappels de `mutate` se taisent une fois
    // le formulaire démonté (le « retour » du téléphone pendant l'envoi), alors que ceux de
    // `useMutation` survivent et reculeraient une seconde fois, hors de l'année.
    demander.mutate(brouillon, { onSuccess: onFermer, onSettled: () => void (envoi.current = false) })
  }

  const cherche = useRef(false)
  const renouveler = useMutation({
    mutationFn: () => renouvelerLesPistes(annee),
    onSuccess: (r) => onPistes(r.pistes),
  })
  const chercher = () => {
    if (cherche.current) return
    cherche.current = true
    renouveler.mutate(undefined, { onSettled: () => void (cherche.current = false) })
  }

  return (
    <form
      className={styles.formulaire}
      onSubmit={(e) => {
        e.preventDefault()
        soumettre()
      }}
    >
      {pistes.length > 0 ? (
        <div className={styles.pistes} role="group" aria-label="Les pistes du chroniqueur">
          {pistes.map((p) => (
            <button
              key={p.nom}
              type="button"
              className={styles.piste}
              aria-pressed={p.nom === brouillon.piste}
              onClick={() => setBrouillon((b) => brouillonSuivant(b, { type: 'piste', piste: p }))}
            >
              {p.nom}
            </button>
          ))}
        </div>
      ) : null}
      {touchee ? <p className={styles.raisonPiste}>{touchee.raison}</p> : null}
      {autresPistes(pistes) ? (
        <button type="button" className={styles.lien} onClick={chercher} disabled={renouveler.isPending}>
          {renouveler.isPending ? 'Le chroniqueur cherche…' : 'D’autres pistes'}
        </button>
      ) : null}
      {renouveler.error ? (
        <p role="alert" className={styles.erreur}>
          {messageDe(renouveler.error, 'Les pistes n’ont pas pu s’écrire. Réessaie.')}
        </p>
      ) : null}

      <label className={styles.champ}>
        <span>Une phrase suffit</span>
        <input
          type="text"
          value={brouillon.texte}
          maxLength={DEMANDE_MAX}
          placeholder="la comédie italienne cette année-là"
          onChange={(e) => setBrouillon((b) => brouillonSuivant(b, { type: 'ecrire', texte: e.target.value.slice(0, DEMANDE_MAX) }))}
        />
      </label>
      {demander.error ? (
        <p role="alert" className={styles.erreur}>
          {messageDe(demander.error, 'La salle n’a pas pu se demander. Réessaie.')}
        </p>
      ) : null}
      <button type="submit" className={styles.bouton} disabled={brouillon.texte.trim() === '' || demander.isPending}>
        Demander
      </button>
    </form>
  )
}

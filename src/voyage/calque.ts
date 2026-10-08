import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Un calque d'une page du Voyage (la feuille du chroniqueur, le choix d'une marche, la nouvelle
 * salle…) vit dans l'adresse (`?feuille=ouverture`) : le geste « retour » du téléphone le ferme au
 * lieu de quitter la page, et un rechargement le rouvre. Ouvert par la page, il se ferme en reculant
 * dans l'historique ; ouvert d'un lien (l'adresse arrivait déjà avec lui), il se ferme en retirant
 * son paramètre, sans quitter l'app.
 *
 * **Une fermeture par ouverture** : deux fermetures avant le rendu (deux touchers sur « Revenir »,
 * deux Échap dans le même instant) reculeraient de deux entrées et quitteraient la page. La première
 * est retenue (« fermeture partie ») jusqu'à ce que l'adresse ait bougé : la seconde ne fait rien.
 */
export function useCalque(nom: string): { valeur: string | null; ouvrir: (valeur: string) => void; fermer: () => void } {
  const [params, poser] = useSearchParams()
  const naviguer = useNavigate()
  const { state, key } = useLocation()
  const valeur = params.get(nom)
  // Rendue à chaque entrée d'historique, et pas seulement quand la valeur change : la même valeur
  // empilée deux fois se referme deux fois, une entrée à la fois.
  const partie = useRef(false)
  useEffect(() => {
    partie.current = false
  }, [key, valeur])
  const ouvertIci = (state as { calque?: string } | null)?.calque === nom

  const ouvrir = (valeur: string) => {
    const suivants = new URLSearchParams(params)
    suivants.set(nom, valeur)
    naviguer({ search: suivants.toString() }, { state: { calque: nom } })
  }

  const fermer = () => {
    if (partie.current || valeur === null) return
    partie.current = true
    if (ouvertIci) {
      naviguer(-1)
      return
    }
    const suivants = new URLSearchParams(params)
    suivants.delete(nom)
    poser(suivants, { replace: true })
  }

  return { valeur, ouvrir, fermer }
}

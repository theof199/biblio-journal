import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Un calque d'une page du Voyage (la feuille du chroniqueur, le choix d'une marche, la nouvelle
 * salle…) vit dans l'adresse (`?feuille=ouverture`) : le geste « retour » du téléphone le ferme au
 * lieu de quitter la page, et un rechargement le rouvre. Ouvert par la page, il se ferme en reculant
 * dans l'historique ; ouvert d'un lien (l'adresse arrivait déjà avec lui), il se ferme en retirant
 * son paramètre, sans quitter l'app.
 */
export function useCalque(nom: string): { valeur: string | null; ouvrir: (valeur: string) => void; fermer: () => void } {
  const [params, poser] = useSearchParams()
  const naviguer = useNavigate()
  const { state } = useLocation()
  const ouvertIci = (state as { calque?: string } | null)?.calque === nom

  const ouvrir = (valeur: string) => {
    const suivants = new URLSearchParams(params)
    suivants.set(nom, valeur)
    naviguer({ search: suivants.toString() }, { state: { calque: nom } })
  }

  const fermer = () => {
    if (ouvertIci) {
      naviguer(-1)
      return
    }
    const suivants = new URLSearchParams(params)
    suivants.delete(nom)
    poser(suivants, { replace: true })
  }

  return { valeur: params.get(nom), ouvrir, fermer }
}

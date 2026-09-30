import { useEffect, useState } from 'react'
import type { FilmDeSalle } from '../../api/voyage'

/** L'image que projette l'écran de la fiche (décision D1) : le fond TMDB du film, sinon son affiche. */
export const urlProjetee = (film: Pick<FilmDeSalle, 'backdrop_url' | 'cover_url'>): string | null => film.backdrop_url ?? film.cover_url

/**
 * L'image du film, chargée par un `Image` **sans `crossOrigin`** : TMDB ne la sert pas en CORS, et
 * une image demandée en `anonymous` sans en-tête ne se chargerait pas du tout. La toile qui la peint
 * en est teintée ; rien ne la lit jamais (`mondes/1890/scene.ts`). Nulle tant qu'elle charge, en
 * erreur, ou sans adresse : l'écran reste alors blanc de lumière. Une fois chargée, l'état change,
 * la page se rend, et la toile se repeint (même au calme, où elle ne peint qu'au rendu).
 */
export function useImageDuFilm(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<{ url: string; img: HTMLImageElement } | null>(null)
  useEffect(() => {
    if (!url || typeof Image !== 'function') return
    const img = new Image()
    let montee = true
    img.onload = () => {
      if (montee) setImage({ url, img })
    }
    img.src = url
    return () => {
      montee = false
      img.onload = null
    }
  }, [url])
  // Une autre adresse (un autre film, sans démontage) n'hérite jamais de l'image du précédent.
  return image && image.url === url ? image.img : null
}

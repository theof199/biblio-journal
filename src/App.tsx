import { Navigate, Route, Routes } from 'react-router-dom'
import RouteProtegee from './session/RouteProtegee'
import Coque from './coque/Coque'
import Connexion from './pages/Connexion'
import Accueil from './pages/Accueil'
import Recherche from './pages/Recherche'
import Formulaire from './pages/Formulaire'
import Fiche from './pages/Fiche'
import MesFilms from './pages/MesFilms'
import Voyage from './pages/Voyage'
import Suivis from './pages/Suivis'
import PageRealisateur from './pages/PageRealisateur'
import PageSaga from './pages/PageSaga'
import FicheFilm from './pages/FicheFilm'
import AuCine from './pages/AuCine'
import Profil from './pages/Profil'
import ImportLetterboxd from './pages/ImportLetterboxd'

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route element={<RouteProtegee />}>
        {/* Les onglets : leurs chemins sont ceux de `ONGLETS` (`coque/Coque.tsx`). */}
        <Route element={<Coque />}>
          <Route index element={<Accueil />} />
          {/* Sans onglet à elles : la barre reste visible (toujours sous `<Coque />`), le retour
              de chaque page en tient lieu (`ui/BoutonRetour.tsx`). */}
          <Route path="recherche" element={<Recherche />} />
          <Route path="journal/nouveau" element={<Formulaire />} />
          <Route path="journal/:id" element={<Fiche />} />
          <Route path="journal/:id/corriger" element={<Formulaire />} />
          <Route path="voyage" element={<Voyage />} />
          <Route path="suivis" element={<Suivis />} />
          <Route path="suivis/realisateurs/:tmdbId" element={<PageRealisateur />} />
          <Route path="suivis/sagas/:tmdbId" element={<PageSaga />} />
          <Route path="suivis/films/:tmdbId" element={<FicheFilm />} />
          <Route path="au-cine" element={<AuCine />} />
          <Route path="profil" element={<Profil />} />
          {/* Sous-page du profil (README, « La coque à onglets ») : l'onglet Profil reste marqué,
              comme sur l'appli Android où « Mes films » ne se pousse que depuis lui. */}
          <Route path="profil/mes-films" element={<MesFilms />} />
          <Route path="profil/import-letterboxd" element={<ImportLetterboxd />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

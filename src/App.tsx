import { Navigate, Route, Routes } from 'react-router-dom'
import RouteProtegee from './session/RouteProtegee'
import Coque from './coque/Coque'
import Connexion from './pages/Connexion'
import Accueil from './pages/Accueil'
import Recherche from './pages/Recherche'
import Formulaire from './pages/Formulaire'
import Fiche from './pages/Fiche'
import MesFilms from './pages/MesFilms'
import Carte from './pages/Carte'
import VoyageAnnee from './pages/VoyageAnnee'
import VoyageDecennie from './pages/VoyageDecennie'
import VoyageBoite from './pages/VoyageBoite'
import VoyageRecherche from './pages/VoyageRecherche'
import VoyageFilm from './pages/VoyageFilm'
import VoyageBillet from './pages/VoyageBillet'
import Suivis from './pages/Suivis'
import PageRealisateur from './pages/PageRealisateur'
import PageSaga from './pages/PageSaga'
import FicheFilm from './pages/FicheFilm'
import AuCine from './pages/AuCine'
import Profil from './pages/Profil'
import Caisse from './pages/Caisse'
import ImportLetterboxd from './pages/ImportLetterboxd'
import AppariementSensCritique from './pages/AppariementSensCritique'

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
          <Route path="voyage" element={<Carte />} />
          <Route path="voyage/:annee" element={<VoyageAnnee />} />
          {/* La page d'une décennie (plan 2c, décision D5) : on y entre par la plaque du chapitre. */}
          <Route path="voyage/decennies/:decennie" element={<VoyageDecennie />} />
          {/* La boîte à billets d'une décennie (idée 5) : on y entre par la page de la décennie. */}
          <Route path="voyage/decennies/:decennie/billets" element={<VoyageBoite />} />
          {/* Le guichet d'une décennie (décision D7) : on y entre par la page de la décennie. */}
          <Route path="voyage/decennies/:decennie/recherche" element={<VoyageRecherche />} />
          {/* La fiche d'un film du Voyage (décision D5) : l'onglet Voyage reste marqué, d'où qu'on vienne. */}
          <Route path="voyage/:annee/films/:filmId" element={<VoyageFilm />} />
          {/* Le billet de séance : un visionnage à enregistrer (`?bobine=` pour une bobine), ou à corriger (`state.item`). */}
          <Route path="voyage/:annee/films/:filmId/billet" element={<VoyageBillet />} />
          <Route path="voyage/:annee/films/:filmId/billet/corriger" element={<VoyageBillet correction />} />
          <Route path="suivis" element={<Suivis />} />
          <Route path="suivis/realisateurs/:tmdbId" element={<PageRealisateur />} />
          <Route path="suivis/sagas/:tmdbId" element={<PageSaga />} />
          <Route path="suivis/films/:tmdbId" element={<FicheFilm />} />
          <Route path="au-cine" element={<AuCine />} />
          <Route path="profil" element={<Profil />} />
          {/* Sous-page du profil (README, « La coque à onglets ») : l'onglet Profil reste marqué,
              comme sur l'appli Android où « Mes films » ne se pousse que depuis lui. */}
          <Route path="profil/mes-films" element={<MesFilms />} />
          <Route path="profil/reglages" element={<Caisse />} />
          <Route path="profil/import-letterboxd" element={<ImportLetterboxd />} />
          <Route path="profil/senscritique" element={<AppariementSensCritique />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { oublierAmbianceDeLaPage } from '../carte/son'

// `globals` reste à false — on importe `describe`/`it`/`expect` explicitement,
// comme tout le reste du projet. Le nettoyage automatique de Testing Library
// dépend d'un `afterEach` global : sans lui, le DOM d'un test fuiterait dans le
// suivant et `getByRole` trouverait deux fois la même chose.
afterEach(cleanup)

// Un `findBy…` ou un `waitFor` attend une seconde par défaut : sur un poste chargé (la suite lancée
// pendant une construction, plusieurs suites à la fois), le premier rendu d'une page montée dans l'app
// entière la dépasse, et le test tombe puis repasse seul. Mesuré le 9 octobre 2026, douze cœurs
// occupés : dix passes rouges sur dix, 97 échecs, tous à la seconde sauf trois. Cinq secondes : cinq
// fois le défaut, le quart du délai d'un test (`testTimeout`, `vite.config.ts`). Un test qui réussit
// n'attend pas plus qu'avant ; seul un échec met plus longtemps à se dire.
configure({ asyncUtilTimeout: 5_000 })

// Le stockage de session vit autant que le fichier de tests : la première entrée d'un
// `MemoryRouter` porte toujours la clé `default`, et le guichet retenu sous elle par un test
// (`voyage/recherche/memoire.ts`) se rouvrirait dans le suivant.
afterEach(() => window.sessionStorage.clear())

// jsdom n'a pas de canvas : `getContext` y rend `null` en écrivant « Not implemented » dans la
// console. Le moteur de la carte le sait et reste inerte ; on lui épargne le bruit.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

// L'ambiance sonore vit autant que la page (`carte/son.ts`) : un test qui allume le son ne le laisse
// pas allumé au suivant, qui rouvrirait une carte déjà sonore.
afterEach(oublierAmbianceDeLaPage)

import { describe, expect, it } from 'vitest'
import feuille from './Feuillet.module.css?raw'

/**
 * La feuille d'un feuillet est scindée en deux : `.dialogue` tient la place et la hauteur, que tout
 * cadre de monde garde ; `.feuillet`, le cadre par défaut, tient le papier et défile. Les deux
 * moitiés ne valent qu'ensemble, et jsdom ne met rien en page : le test lit le texte de la feuille.
 */
function regle(css: string, selecteur: string) {
  const debut = css.indexOf(`\n${selecteur} {`)
  expect(debut, `la règle ${selecteur}`).toBeGreaterThanOrEqual(0)
  return css.slice(debut, css.indexOf('}', debut))
}

describe('la feuille d’un feuillet', () => {
  // Un feuillet plus haut que l'écran (douze abonnements à choisir) : sans plafond il sort par le
  // haut, sans colonne souple le cadre ne peut pas rétrécir, sans `min-height: 0` il garde la hauteur
  // de son contenu, sans `overflow-y` rien ne défile. Mutations, une par ligne : `max-height: 80%`
  // retiré de `.dialogue` ; `display: flex` retiré de `.dialogue` ; `min-height: 0` retiré de
  // `.feuillet` ; `overflow-y: auto` retiré de `.feuillet`.
  it('le dialogue plafonne sa hauteur en colonne souple, et seul le cadre défile dedans', () => {
    expect(regle(feuille, '.dialogue')).toMatch(/max-height:\s*80%/)
    expect(regle(feuille, '.dialogue')).toMatch(/display:\s*flex/)
    expect(regle(feuille, '.dialogue')).toMatch(/flex-direction:\s*column/)
    expect(regle(feuille, '.dialogue')).not.toMatch(/overflow/)
    expect(regle(feuille, '.feuillet')).toMatch(/min-height:\s*0/)
    expect(regle(feuille, '.feuillet')).toMatch(/overflow-y:\s*auto/)
  })
})

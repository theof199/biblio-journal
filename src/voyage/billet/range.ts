/**
 * Le dernier billet rangé dans la boîte (idée 5 ; maquette 1890 : `S.nouveau`, le billet qui tombe
 * dans la boîte avec son liseré) : confié par le billet de séance au compostage, lu par la boîte à
 * sa prochaine ouverture, qui le montre une fois. Jamais chez un autre membre connecté entre-temps
 * sur le même onglet ; rien n'est écrit sur l'appareil : un rechargement l'oublie.
 */
let range: { membre: string; entree: string } | null = null

export function rangerLeBillet(membre: string, entree: string): void {
  range = { membre, entree }
}

/** Lu sans être pris : la boîte l'oublie une fois montrée (`oublierLeBillet`), comme l'année oublie le retour. */
export const billetRange = (membre: string): string | null => (range !== null && range.membre === membre ? range.entree : null)

export function oublierLeBillet(): void {
  range = null
}

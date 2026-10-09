import type { CartePostaleEnvoyee } from '../../api/voyage'

/**
 * Le mot d'une carte postale à écrire (plan des écrans des lots, brief 14) : ce que l'appli en borne,
 * et rien de plus. **Elle ne refait pas les règles du serveur** (une ligne, aucun caractère de
 * contrôle, un signe qui se voit) : elle borne la longueur et refuse le vide ; le reste revient en
 * `400`, avec son message.
 */
export const MOT_MAX = 140

/** Le serveur compte comme `String.length`, et un champ `maxLength` aussi. Un mot fait d'espaces est vide. */
export const motPostable = (mot: string): boolean => mot.trim() !== '' && mot.length <= MOT_MAX

/**
 * La carte qu'on vient de poster, rangée parmi les envoyées comme le serveur les sert (par gare, de la
 * plus récente à la plus ancienne) : avant la première carte d'une gare plus ancienne. La prochaine
 * lecture de la boîte fait foi.
 */
export function rangerLaPostee(envoyees: readonly CartePostaleEnvoyee[], carte: CartePostaleEnvoyee): CartePostaleEnvoyee[] {
  const autres = envoyees.filter((c) => c.id !== carte.id)
  const place = autres.findIndex((c) => c.annee < carte.annee)
  return place === -1 ? [...autres, carte] : [...autres.slice(0, place), carte, ...autres.slice(place)]
}

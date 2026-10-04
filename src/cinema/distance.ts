export interface Coordonnees {
  latitude: number
  longitude: number
}

const RAYON_TERRE_KM = 6371

const enRadians = (degres: number) => (degres * Math.PI) / 180

/**
 * La distance à vol d'oiseau entre deux points (haversine), en kilomètres. Un cinéma se juge à
 * quelques kilomètres : la ligne droite suffit, et aucun service d'itinéraire n'est appelé — la
 * position du membre ne quitte jamais le téléphone.
 */
export function distanceKm(depart: Coordonnees, arrivee: Coordonnees): number {
  const deltaLatitude = enRadians(arrivee.latitude - depart.latitude)
  const deltaLongitude = enRadians(arrivee.longitude - depart.longitude)
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(enRadians(depart.latitude)) * Math.cos(enRadians(arrivee.latitude)) * Math.sin(deltaLongitude / 2) ** 2
  return 2 * RAYON_TERRE_KM * Math.asin(Math.sqrt(a))
}

/**
 * « à 450 m » sous le kilomètre (arrondi à dix mètres), « à 1,2 km » jusqu'à dix kilomètres, « à 12 km »
 * au-delà : une décimale de plus ne dirait rien à qui cherche une salle. Espaces insécables : « à »,
 * le nombre et l'unité ne se séparent jamais en bout de ligne.
 */
export function distanceAffichee(km: number): string {
  // On arrondit d'abord, on choisit l'unité ensuite : 0,999 km se lit « 1,0 km », jamais « 1000 m ».
  const metres = Math.max(10, Math.round(km * 100) * 10)
  if (metres < 1000) return `à\u00a0${metres}\u00a0m`
  const kilometres = Math.round(km * 10) / 10
  if (kilometres < 10) return `à\u00a0${kilometres.toFixed(1).replace('.', ',')}\u00a0km`
  return `à\u00a0${Math.round(km)}\u00a0km`
}

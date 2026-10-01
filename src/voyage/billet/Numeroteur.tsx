import { NUMERO_EN_ATTENTE, numeroLisible, tirerLeNumero } from '../billets'
import styles from './Numeroteur.module.css'

interface Props {
  /** Le numéro du billet dans la boîte de sa décennie (`billetsDeLaDecennie`), nul tant qu'il n'est pas lu. */
  numero: number | null
  /** Le tirage en cours du numéroteur (de 0 à 9), nul quand il ne roule pas. */
  tirage: number | null
}

/**
 * Le numéroteur de la tête du billet (idée 5, décision D3 ; maquette 1890 : `.entete-billet .numero`,
 * et ses tirages dans `tamponner`). Il roule tant que la page lui donne un tirage, puis pose le
 * numéro, ou « N° ···· » si la boîte n'a pas répondu. Ce qui roule ne se lit pas au lecteur d'écran.
 */
export default function Numeroteur({ numero, tirage }: Props) {
  const roule = tirage !== null
  const texte = roule ? tirerLeNumero(numero, tirage) : numero !== null ? numeroLisible(numero) : NUMERO_EN_ATTENTE
  return (
    <span className={styles.numero} aria-hidden={roule || undefined}>
      {texte}
    </span>
  )
}

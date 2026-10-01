// Manrope, Fraunces et Limelight : les mêmes graisses que
// `biblio-android/app/src/main/res/font/`. Manrope ne sert plus qu'au Voyage
// (le thème général lit Jost et Bodoni Moda, plus bas) ; Fraunces, Limelight et IM Fell English servent au Voyage
// (`voyage.css`, `docs/design.md`, et les jetons des pages de chaque monde,
// `Monde.pages`). Fichiers statiques, jamais téléchargés en ligne.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/fraunces/latin-400.css'
import '@fontsource/fraunces/latin-600.css'
import '@fontsource/fraunces/latin-700.css'
import '@fontsource/limelight/latin-400.css'
// Les pages des années 1890 (plan 2b, décision D4) : le texte d'affiche et ses petites capitales.
import '@fontsource/im-fell-english/latin-400.css'
import '@fontsource/im-fell-english/latin-400-italic.css'
import '@fontsource/im-fell-english-sc/latin-400.css'
// Le fronton de l'accueil : League Gothic pour les lettres, Bodoni Moda pour les titres, Jost pour le texte.
import '@fontsource/league-gothic/latin-400.css'
import '@fontsource/bodoni-moda/latin-500-italic.css'
import '@fontsource/bodoni-moda/latin-800.css'
import '@fontsource/bodoni-moda/latin-800-italic.css'
import '@fontsource/jost/latin-400.css'
import '@fontsource/jost/latin-500.css'
import '@fontsource/jost/latin-600.css'
// Les enseignes du fronton, une police par décennie (`data-decennie` dans `theme.css`) : 1940 est
// League Gothic, déjà chargée plus haut. Une seule graisse chacune, celle que l'enseigne pose.
import '@fontsource/rye/latin-400.css'
import '@fontsource/ribeye/latin-400.css'
import '@fontsource/abril-fatface/latin-400.css'
import '@fontsource/rammetto-one/latin-400.css'
import '@fontsource/bowlby-one-sc/latin-400.css'
import '@fontsource/lobster/latin-400.css'
import '@fontsource/shrikhand/latin-400.css'
import '@fontsource/caprasimo/latin-400.css'
import '@fontsource/russo-one/latin-400.css'
import '@fontsource/cinzel/latin-900.css'
import '@fontsource/orbitron/latin-900.css'
import '@fontsource/montserrat/latin-900.css'
import '@fontsource/unbounded/latin-900.css'
// Le crayon gras du membre sur le ticket de caisse (`--police-crayon`) : la seule écriture manuscrite de l'app.
import '@fontsource/caveat/latin-700.css'

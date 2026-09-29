#!/bin/sh
# La rampe sépia du monde 1890 (maquette du 29 septembre 2026 : `SEP`, et `C` qui mêle 64 % de
# rampe à 36 % de la couleur d'origine), cuite une fois dans une image ou une vidéo d'archive.
# La luminance est celle de la maquette : 0,2126 R + 0,7152 G + 0,0722 B. Le grain n'est pas
# cuit : la pellicule du moteur le pose par-dessus tout.
#   sh virer.sh entree sortie.webp [largeur]   image fixe ou planche, WebP qualité 70
#   sh virer.sh entree sortie.webm [largeur]   extrait, 16 images par seconde, sans son, VP9
set -eu
entree=$1
sortie=$2
largeur=${3:-480}
palier() { echo "if(lt(val\\,85)\\,$1+($2-$1)*val/85\\,if(lt(val\\,170)\\,$2+($3-$2)*(val-85)/85\\,$3+($4-$3)*(val-170)/85))"; }
R=$(palier 18 92 170 247)
G=$(palier 12 62 126 236)
B=$(palier 8 36 80 214)
L=.2126:.7152:.0722:0
RAMPE="format=rgb24,split[a][b];[a]colorchannelmixer=$L:$L:$L,lutrgb=r='$R':g='$G':b='$B'[s];[s][b]blend=all_expr='A*0.64+B*0.36'"
case "$sortie" in
  *.webp) ffmpeg -loglevel error -y -i "$entree" -filter_complex "[0]scale='min($largeur,iw)':-2,$RAMPE" -frames:v 1 -c:v libwebp -quality 70 "$sortie" ;;
  *.webm) ffmpeg -loglevel error -y -i "$entree" -filter_complex "[0]scale='min($largeur,iw)':-2,fps=16,$RAMPE" -an -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 "$sortie" ;;
  *) echo "sortie en .webp ou .webm" >&2; exit 1 ;;
esac

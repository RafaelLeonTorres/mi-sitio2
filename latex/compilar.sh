#!/usr/bin/env bash
# Compila los CV y las cartas de presentación con XeLaTeX y deja los PDF donde
# los publica el sitio (versión para Linux y macOS de compilar.ps1).
#
# Uso, desde la carpeta del repositorio:
#   ./latex/compilar.sh                      # los cuatro documentos
#   ./latex/compilar.sh cv-es carta-es       # solo esos
#   CON_REFERENCIAS=1 ./latex/compilar.sh    # además, CV con referencias en latex/privado/
set -euo pipefail

latex_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sitio_dir="$(dirname "$latex_dir")"
build_dir="$latex_dir/build"
privado_dir="$latex_dir/privado"

# Nombre con el que el sitio publica cada PDF. No lo cambies: hay enlaces que apuntan ahí.
pdf_del_sitio() {
  case "$1" in
    cv-es)    echo Rafael_Leon_Resume_ES.pdf ;;
    cv-en)    echo Rafael_Leon_Resume_EN.pdf ;;
    carta-es) echo Rafael_Leon_Carta_Presentacion_ES.pdf ;;
    carta-en) echo Rafael_Leon_Carta_Presentacion_EN.pdf ;;
    *) return 1 ;;
  esac
}

if ! command -v xelatex > /dev/null; then
  echo "No encuentro xelatex. Instala TeX Live (o MacTeX) y vuelve a intentarlo." >&2
  exit 1
fi
mkdir -p "$build_dir" "$privado_dir"
cd "$latex_dir"

# Compila hasta tres veces: longtable necesita repetir para fijar el ancho de las columnas.
compilar() {  # $1 = jobname, $2 = entrada
  local log="$build_dir/$1.log"
  for _ in 1 2 3; do
    if ! xelatex -interaction=nonstopmode -halt-on-error -file-line-error -synctex=1 \
        -output-directory="$build_dir" -jobname="$1" "$2" > /dev/null; then
      echo "Falló la compilación de $1. Primeros errores:" >&2
      grep -m3 -A2 -E '^!|:[0-9]+: ' "$log" >&2 || true
      echo "Log completo: $log" >&2
      exit 1
    fi
    grep -qE 'Rerun to get|Table widths have changed|Label\(s\) may have changed' "$log" || break
  done
}

# ¿La carta tiene empresa o puesto? (líneas \empresa{...} o \puesto{...} con texto)
carta_personalizada() {
  grep -qE '^[[:space:]]*\\(empresa|puesto)\{[[:space:]]*[^}[:space:]][^}]*\}' "$1"
}

if [ "$#" -gt 0 ]; then docs=("$@"); else docs=(cv-es cv-en carta-es carta-en); fi

for doc in "${docs[@]}"; do
  if ! pdf="$(pdf_del_sitio "$doc")"; then
    echo "Documento desconocido: $doc. Usa: cv-es, cv-en, carta-es o carta-en." >&2
    exit 1
  fi
  echo "Compilando $doc..."
  compilar "$doc" "$doc.tex"

  if [[ $doc == carta-* ]] && carta_personalizada "$doc.tex"; then
    cp "$build_dir/$doc.pdf" "$privado_dir/${pdf%.pdf}_personalizada.pdf"
    echo "  -> latex/privado/${pdf%.pdf}_personalizada.pdf"
    echo "     La carta tiene empresa o puesto: no toqué la versión genérica del sitio."
  else
    cp "$build_dir/$doc.pdf" "$sitio_dir/$pdf"
    echo "  -> $pdf"
  fi

  if [ "${CON_REFERENCIAS:-0}" = 1 ] && [[ $doc == cv-* ]]; then
    idioma="${doc#cv-}"
    if [ -f "$privado_dir/referencias-$idioma.tex" ]; then
      compilar "$doc-referencias" "\\def\\conreferencias{}\\input{$doc}"
      cp "$build_dir/$doc-referencias.pdf" "$privado_dir/${pdf%.pdf}_con_referencias.pdf"
      echo "  -> latex/privado/${pdf%.pdf}_con_referencias.pdf (privado, no se sube a git)"
    else
      echo "  (no existe latex/privado/referencias-$idioma.tex; omito la versión con referencias)"
    fi
  fi
done

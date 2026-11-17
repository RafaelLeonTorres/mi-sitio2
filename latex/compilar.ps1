<#
.SYNOPSIS
  Compila los CV y las cartas de presentación con XeLaTeX y deja los PDF donde
  los publica el sitio.

.DESCRIPTION
  Cada documento se compila en latex\build\ y su PDF se copia a la raíz del
  repositorio con el nombre que usa el sitio, así los enlaces no cambian:

    cv-es.tex     -> Rafael_Leon_Resume_ES.pdf
    cv-en.tex     -> Rafael_Leon_Resume_EN.pdf
    carta-es.tex  -> Rafael_Leon_Carta_Presentacion_ES.pdf
    carta-en.tex  -> Rafael_Leon_Carta_Presentacion_EN.pdf

  Si una carta tiene \empresa{...} o \puesto{...}, su PDF va a latex\privado\
  y la versión genérica del sitio no se toca.

.PARAMETER Documentos
  Qué documentos compilar (sin extensión). Por omisión, los cuatro.

.PARAMETER ConReferencias
  Además genera los CV con referencias en latex\privado\ (no se suben a git).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1 -Documentos cv-es,carta-es

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\latex\compilar.ps1 -ConReferencias
#>
param(
    [string[]] $Documentos = @('cv-es', 'cv-en', 'carta-es', 'carta-en'),
    [switch] $ConReferencias
)

# Sin ErrorActionPreference = 'Stop' a propósito: MiKTeX escribe avisos en stderr y, en
# Windows PowerShell 5.1, eso detendría el script. Los errores se revisan uno por uno.
$latex   = $PSScriptRoot
$sitio   = Split-Path $latex -Parent
$build   = Join-Path $latex 'build'
$privado = Join-Path $latex 'privado'

# Nombre con el que el sitio publica cada PDF. No lo cambies: hay enlaces que apuntan ahí.
$pdfDelSitio = @{
    'cv-es'    = 'Rafael_Leon_Resume_ES.pdf'
    'cv-en'    = 'Rafael_Leon_Resume_EN.pdf'
    'carta-es' = 'Rafael_Leon_Carta_Presentacion_ES.pdf'
    'carta-en' = 'Rafael_Leon_Carta_Presentacion_EN.pdf'
}

if (-not (Get-Command xelatex -ErrorAction SilentlyContinue)) {
    Write-Host 'No encuentro xelatex. Instala MiKTeX (winget install MiKTeX.MiKTeX) y abre una terminal nueva.' -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $build, $privado -ErrorAction Stop | Out-Null

# Compila hasta tres veces: longtable necesita repetir para fijar el ancho de las columnas.
function Invoke-XeLaTeX([string] $jobname, [string] $entrada) {
    $log = Join-Path $build "$jobname.log"
    for ($pasada = 1; $pasada -le 3; $pasada++) {
        & xelatex -interaction=nonstopmode -halt-on-error -file-line-error -synctex=1 `
            "-output-directory=$build" "-jobname=$jobname" $entrada 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Falló la compilación de $jobname. Primeros errores:" -ForegroundColor Red
            if (Test-Path $log) {
                Select-String -Path $log -Pattern '^!|:\d+: ' -Context 0, 2 |
                    Select-Object -First 3 | ForEach-Object { Write-Host $_.ToString() }
            }
            Write-Host "Log completo: $log"
            exit 1
        }
        if (-not (Select-String -Path $log -Pattern 'Rerun to get|Table widths have changed|Label\(s\) may have changed' -Quiet)) {
            break
        }
    }
}

function Copy-Pdf([string] $origen, [string] $destino) {
    try {
        Copy-Item $origen $destino -Force -ErrorAction Stop
    }
    catch {
        Write-Host "No pude escribir $destino. ¿Lo tienes abierto en otro programa? Ciérralo y vuelve a compilar." -ForegroundColor Red
        exit 1
    }
}

# ¿La carta tiene empresa o puesto? (líneas \empresa{...} o \puesto{...} con texto)
function Test-CartaPersonalizada([string] $archivo) {
    $patron = '^\s*\\(empresa|puesto)\{\s*[^}\s][^}]*\}'
    return [bool](Select-String -Path $archivo -Pattern $patron -Encoding UTF8 -Quiet)
}

Push-Location $latex
try {
    foreach ($doc in $Documentos) {
        if (-not $pdfDelSitio.ContainsKey($doc)) {
            Write-Host "Documento desconocido: $doc. Usa: cv-es, cv-en, carta-es o carta-en." -ForegroundColor Red
            exit 1
        }
        Write-Host "Compilando $doc..."
        Invoke-XeLaTeX $doc "$doc.tex"

        $pdf = Join-Path $build "$doc.pdf"
        if ($doc -like 'carta-*' -and (Test-CartaPersonalizada (Join-Path $latex "$doc.tex"))) {
            $destino = Join-Path $privado ($pdfDelSitio[$doc] -replace '\.pdf$', '_personalizada.pdf')
            Copy-Pdf $pdf $destino
            Write-Host "  -> $destino" -ForegroundColor Yellow
            Write-Host '     La carta tiene empresa o puesto: no toqué la versión genérica del sitio.'
        }
        else {
            $destino = Join-Path $sitio $pdfDelSitio[$doc]
            Copy-Pdf $pdf $destino
            Write-Host "  -> $destino" -ForegroundColor Green
        }

        if ($ConReferencias -and $doc -like 'cv-*') {
            $idioma = $doc.Substring(3)
            if (-not (Test-Path (Join-Path $privado "referencias-$idioma.tex"))) {
                Write-Host "  (no existe latex\privado\referencias-$idioma.tex; omito la versión con referencias)"
                continue
            }
            $job = "$doc-referencias"
            Invoke-XeLaTeX $job "\def\conreferencias{}\input{$doc}"
            $destino = Join-Path $privado ($pdfDelSitio[$doc] -replace '\.pdf$', '_con_referencias.pdf')
            Copy-Pdf (Join-Path $build "$job.pdf") $destino
            Write-Host "  -> $destino (privado, no se sube a git)" -ForegroundColor Yellow
        }
    }
}
finally {
    Pop-Location
}

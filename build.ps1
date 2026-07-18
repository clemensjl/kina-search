# Kompletter Refresh: Quellen laden -> parsen -> Thumbnails -> optional deployen.
# Aufruf:  .\build.ps1            (nur bauen)
#          .\build.ps1 -Deploy    (bauen + committen + pushen = live)
param([switch]$Deploy)
$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"
Set-Location $PSScriptRoot

python scripts\fetch.py
python scripts\parse.py
python scripts\thumbs.py

if ($Deploy) {
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit -m "refresh $(Get-Date -Format yyyy-MM-dd)"
        git push
        Write-Host "Gepusht - GitHub Actions deployt in ~1 Minute."
    } else {
        Write-Host "Keine Aenderungen - nichts zu deployen."
    }
}

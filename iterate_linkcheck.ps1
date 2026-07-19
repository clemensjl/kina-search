# Iterativer verteilter Linkcheck: pro Runde 15 frische Runner-IPs, 25-min-Cap,
# Zwischenstand wird gemergt + committet; endet wenn (fast) alles geprueft ist.
# Danach: enrich (Bilder/Preise) -> thumbs -> prune (tote Items) -> Push.
$ErrorActionPreference = "Continue"
$env:PYTHONIOENCODING = "utf-8"
Set-Location "$env:USERPROFILE\Documents\Projekte\kina-search"

$todo = -1
for ($round = 1; $round -le 6; $round++) {
    Write-Output "=== Runde $round ==="
    git add -f data/link_status.json data/item_meta.json 2>$null
    git commit -q -m "linkcheck: Zwischenstand vor Runde $round" 2>$null
    git push 2>&1 | Select-Object -Last 1

    gh workflow run linkcheck.yml
    Start-Sleep 90
    $runid = gh run list --workflow linkcheck.yml --limit 1 --json databaseId --jq '.[0].databaseId'
    Write-Output "Run: $runid"

    $st = ""
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep 300
        $st = gh run view $runid --json status --jq '.status' 2>$null
        Write-Output "  poll $($i): $st"
        if ($st -eq "completed") { break }
    }
    if ($st -ne "completed") { gh run cancel $runid 2>$null; Start-Sleep 90 }

    $art = "$env:TEMP\lc-round$round"
    Remove-Item -Recurse -Force $art -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $art | Out-Null
    gh run download $runid --dir $art 2>$null
    $out = python scripts/merge_linkcheck.py $art
    Write-Output $out
    $m = $out | Select-String "TODO=(\d+)"
    if ($m) { $todo = [int]$m.Matches[0].Groups[1].Value }
    if ($todo -ge 0 -and $todo -lt 400) { break }
}
Write-Output "=== Crawl fertig, TODO=$todo - starte Daten-Pipeline ==="

python scripts/enrich.py
python scripts/thumbs.py | Select-Object -Last 2
python scripts/prune_dead.py
git add -A 2>$null
git commit -q -m "Linkcheck-Ergebnis: tote Items entfernt, Bilder+Preise ergaenzt"
git push 2>&1 | Select-Object -Last 1
Write-Output "=== PIPELINE KOMPLETT ==="

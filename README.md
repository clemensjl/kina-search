# kina-search

Durchsuchbare Datenbank ueber alle China-Agent-Spreadsheets (Insta/TikTok-Quellen).
Aggregiert Items (Name, Preis, Bild, Kauf-Link, Kategorie) aus allen Sheets in eine
statische Website mit Suche und Filtern.

Live: https://clemensjl.github.io/kina-search/

## Refresh (neue Daten holen)

```powershell
.\build.ps1            # nur lokal bauen
.\build.ps1 -Deploy    # bauen + pushen = live
```

## Neue Quelle hinzufuegen

1. Sheet-ID aus der URL in `sources.yaml` eintragen (`docs.google.com/spreadsheets/d/<ID>/...`).
   - Natives Google Sheet (muss oeffentlich lesbar sein): nur `id` + `name`.
   - Hochgeladene xlsx-Datei in Drive: zusaetzlich `type: drive_xlsx`.
2. Nicht oeffentliche Sheets: im Browser oeffnen, Datei > Herunterladen > xlsx,
   Datei nach `data/manual/` legen (wird beim Build mit eingelesen).
3. `.\build.ps1 -Deploy`

## Aufbau

- `scripts/fetch.py` - laedt native Sheets tab-weise als HTML (htmlview-Route,
  behaelt Links + Bild-URLs; funktioniert auch bei Sheets ueber dem Export-Limit)
  und Drive-xlsx-Dateien nach `data/raw/`
- `scripts/parse.py` - heuristische Item-Extraktion (Link-Zelle = Anker, Name/
  Preis/Bild aus Nachbarzellen, Kategorie aus Tab/Sektion/Keywords) -> `site/items.json`
- `scripts/thumbs.py` - laedt alle Produktbilder, 180px WebP nach `site/thumbs/`
  (umgeht Hotlink-Sperren), idempotent
- `site/` - statische Seite (index.html + items.json + thumbs/), deployt via
  GitHub Actions auf Pages
- `data/` - Rohdaten, nicht im Repo

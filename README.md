# Šah – turniri i igrači

Mobilna web aplikacija: šahovski turniri u Hrvatskoj (izvor [chess-results.com](https://chess-results.com/fed.aspx?lan=1&fed=CRO)) po dobnim skupinama i tempu igre, te praćenje odabranih igrača (FIDE rejting, prijave, rezultati).

- `docs/` – aplikacija (GitHub Pages). `docs/players.json` je popis praćenih igrača, `docs/data.json` generira skripta.
- `scripts/update.mjs` – skupljanje podataka (Node 22, bez dodatnih paketa).
- `.github/workflows/update.yml` – pokreće skriptu dvaput dnevno, na gumb ↻ Osvježi i kad se promijeni popis igrača, pa objavljuje stranicu.

Lokalno: `node scripts/update.mjs`

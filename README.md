# Šah – turniri i igrači

Samostalna Next.js aplikacija na Vercelu (https://sah-app.vercel.app) sa zasebnim Supabase projektom **ChessOs**.

- Prijava emailom i lozinkom; nove registracije mora odobriti administrator (stranica `/admin`).
- Turniri u Hrvatskoj s [chess-results.com](https://chess-results.com/fed.aspx?lan=1&fed=CRO) po dobnim skupinama i tempu igre; stranica turnira s poretkom, parovima po kolima i kategorijama, uživo.
- Praćeni igrači (svaki korisnik svoje): FIDE rejting, prijave, rezultati i povijest turnira po godinama s partijama.
- Baza: `supabase/migrations/0001_chessos.sql` (pokrenuti u SQL Editoru projekta ChessOs).
- Osvježavanje: gumb ↻ Osvježi, automatski pri otvaranju ako su podaci stariji od sat vremena, i dnevno u 6/7 h (Vercel cron, `vercel.json`).
- Objava: `npx vercel deploy --prod --scope markovasek-2296`.

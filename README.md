# Šah – turniri i igrači

Next.js aplikacija na Vercelu (https://sah-app.vercel.app) sa Supabase bazom i prijavom kao Dnevnik rada, Projekti i Troškovnici.

- Turniri u Hrvatskoj s [chess-results.com](https://chess-results.com/fed.aspx?lan=1&fed=CRO) po dobnim skupinama i tempu igre.
- Praćeni igrači: FIDE rejting, prijave na turnire i rezultati.
- Osvježavanje: gumb ↻ Osvježi, automatski pri otvaranju ako su podaci stariji od sat vremena, i dnevno u 6/7 h (Vercel cron, `vercel.json`).
- Baza: `supabase/migrations/0001_sah.sql` (pokrenuti u Supabase SQL Editoru).
- Objava: `npx vercel deploy --prod --scope markovasek-2296`.
